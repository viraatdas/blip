import { getSupabaseClient } from "@blip/db";
import * as executionRepo from "@blip/db/repositories/execution-repository";
import * as executionEventRepo from "@blip/db/repositories/execution-event-repository";
import * as agentRepo from "@blip/db/repositories/agent-repository";
import * as usageRepo from "@blip/db/repositories/usage-repository";
import { createSandbox, resumeSandbox, runAgent, pauseSandbox, killSandbox } from "@blip/e2b";
import { decrypt } from "@blip/shared";
import { reportUsage } from "./billing.js";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? "default-dev-key";

export async function processJob(executionId: string): Promise<void> {
  // 1. Load execution and agent
  const execution = await executionRepo.findById(executionId);
  if (!execution) throw new Error(`Execution ${executionId} not found`);

  if (!execution.agent_id) throw new Error(`Execution ${executionId} has no agent`);

  const agent = await agentRepo.findById(execution.agent_id, execution.user_id);
  if (!agent) throw new Error(`Agent ${execution.agent_id} not found`);

  if (!agent.e2b_template_id || agent.template_status !== "ready") {
    throw new Error(`Agent ${agent.id} template not ready`);
  }

  if (!agent.anthropic_api_key) {
    throw new Error(`Agent ${agent.id} has no Anthropic API key configured`);
  }

  // 2. Update status to running
  await executionRepo.updateStatus(executionId, "running");

  let sandbox;
  try {
    // 3. Create or resume sandbox
    const envVars: Record<string, string> = {
      BLIP_PROMPT: execution.prompt,
      ANTHROPIC_API_KEY: decrypt(agent.anthropic_api_key, ENCRYPTION_KEY),
      ...(agent.claude_md && { BLIP_CLAUDE_MD: agent.claude_md }),
      ...(agent.mcp_config && { BLIP_MCP_CONFIG: JSON.stringify(agent.mcp_config) }),
      ...(agent.settings && { BLIP_SETTINGS: JSON.stringify(agent.settings) }),
      ...(agent.env_vars && { ...agent.env_vars }),
    };

    if (execution.session_id) {
      // Resume existing sandbox for session continuity
      sandbox = await resumeSandbox(execution.session_id);
      // Set new prompt env var
      await sandbox.commands.run(`export BLIP_PROMPT='${execution.prompt.replace(/'/g, "'\\''")}'`);
    } else {
      sandbox = await createSandbox(agent.e2b_template_id, envVars);
    }

    // 4. Run the agent and collect events
    let seq = 0;
    let resultData: Record<string, unknown> = {};

    const { exitCode } = await runAgent(sandbox, async (line) => {
      try {
        const event = JSON.parse(line);
        seq++;
        await executionEventRepo.create({
          execution_id: executionId,
          seq,
          event_type: event.type,
          payload: event.data ?? {},
        });

        if (event.type === "result") {
          resultData = event.data ?? {};
        }
      } catch {
        console.warn(`[job] Failed to parse event line: ${line}`);
      }
    });

    // 5. Pause sandbox for session continuity
    const sandboxId = await pauseSandbox(sandbox);

    // 6. Update execution record
    const status = exitCode === 0 ? "completed" : "failed";
    await executionRepo.updateStatus(executionId, status, {
      sandbox_id: sandboxId,
      session_id: sandboxId,
      result_text: (resultData.result_text as string) ?? null,
      cost_usd: (resultData.cost_usd as number) ?? null,
      turns: (resultData.turns as number) ?? null,
      duration_ms: (resultData.duration_ms as number) ?? null,
    });

    // 7. Insert usage record
    if (resultData.cost_usd || resultData.duration_ms) {
      await usageRepo.create({
        user_id: execution.user_id,
        execution_id: executionId,
        cost_usd: (resultData.cost_usd as number) ?? 0,
        duration_ms: (resultData.duration_ms as number) ?? 0,
      });
    }

    // 8. Report to Stripe
    await reportUsage(execution.user_id, executionId, resultData);
  } catch (error) {
    // On failure: update execution with error, kill sandbox
    await executionRepo.updateStatus(executionId, "failed", {
      result_text: error instanceof Error ? error.message : String(error),
    });

    if (sandbox) {
      try {
        await killSandbox(sandbox);
      } catch {
        // Best effort cleanup
      }
    }

    throw error;
  }
}
