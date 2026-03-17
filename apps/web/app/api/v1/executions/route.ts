import { NextRequest } from "next/server";
import { authenticateRequest } from "../../../../lib/api-auth";
import { jsonResponse, errorResponse, parseBody } from "../../../../lib/api-helpers";
import { createExecutionSchema, HttpError, encrypt } from "@blip/shared";
import * as executionRepo from "@blip/db/repositories/execution-repository";
import * as agentRepo from "@blip/db/repositories/agent-repository";
import { queue } from "@blip/db";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? "default-dev-key";

// POST /v1/executions - Create execution (enqueue to pgmq)
export async function POST(req: NextRequest) {
  try {
    const { userId } = await authenticateRequest(req);
    const body = await parseBody(req, createExecutionSchema);

    let agentId: string;

    if (body.agent_id) {
      // Explicit agent — verify it exists and belongs to user
      const agent = await agentRepo.findById(body.agent_id, userId);
      if (!agent) throw new HttpError(404, "not_found", "Agent not found");

      if (agent.template_status !== "ready") {
        throw new HttpError(400, "template_not_ready", "Agent template is not ready. Build it first.");
      }

      // If they passed an API key, update it on the agent
      if (body.anthropic_api_key) {
        await agentRepo.update(agent.id, userId, {
          anthropic_api_key: encrypt(body.anthropic_api_key, ENCRYPTION_KEY),
        });
      }

      agentId = agent.id;
    } else {
      // No agent specified — use or create default agent
      const encryptedKey = body.anthropic_api_key
        ? encrypt(body.anthropic_api_key, ENCRYPTION_KEY)
        : undefined;

      const defaultAgent = await agentRepo.findOrCreateDefault(userId, {
        anthropic_api_key: encryptedKey,
        e2b_template_id: process.env.DEFAULT_E2B_TEMPLATE_ID,
      });

      // If they passed an API key and the default agent already existed, update it
      if (encryptedKey && defaultAgent.anthropic_api_key !== encryptedKey) {
        await agentRepo.update(defaultAgent.id, userId, {
          anthropic_api_key: encryptedKey,
        });
      }

      if (!defaultAgent.anthropic_api_key && !encryptedKey) {
        throw new HttpError(400, "missing_api_key", "Provide anthropic_api_key or create an agent with one configured.");
      }

      if (defaultAgent.template_status !== "ready") {
        throw new HttpError(400, "template_not_ready", "Default agent template is not ready. Please contact support or create an agent manually.");
      }

      agentId = defaultAgent.id;
    }

    // Create execution record
    const execution = await executionRepo.create({
      agent_id: agentId,
      user_id: userId,
      prompt: body.prompt,
      session_id: body.session_id,
    });

    // Enqueue job
    await queue.sendMessage("execution_jobs", { execution_id: execution.id });

    return jsonResponse(execution, 201);
  } catch (error) {
    console.error("[POST /v1/executions] error:", error);
    return errorResponse(error);
  }
}

// GET /v1/executions - List executions
export async function GET(req: NextRequest) {
  try {
    const { userId } = await authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agent_id") ?? undefined;
    const limit = parseInt(searchParams.get("limit") ?? "50", 10);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    const executions = await executionRepo.findAllByUser(userId, { agent_id: agentId, limit, offset });
    return jsonResponse(executions);
  } catch (error) {
    return errorResponse(error);
  }
}
