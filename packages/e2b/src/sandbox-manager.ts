import { Sandbox } from "e2b";

export type SandboxEnvVars = {
  BLIP_PROMPT: string;
  ANTHROPIC_API_KEY: string;
  BLIP_CLAUDE_MD?: string;
  BLIP_MCP_CONFIG?: string;
  BLIP_SETTINGS?: string;
};

export type RunResult = {
  exitCode: number;
  events: string[];  // raw stdout lines
};

export async function createSandbox(
  templateId: string,
  envs: Record<string, string>,
  timeoutMs: number = 10 * 60 * 1000,
): Promise<Sandbox> {
  const sandbox = await Sandbox.create(templateId, {
    envs,
    timeoutMs,
  });
  return sandbox;
}

export async function resumeSandbox(sandboxId: string): Promise<Sandbox> {
  // Sandbox.connect auto-resumes paused sandboxes
  const sandbox = await Sandbox.connect(sandboxId);
  return sandbox;
}

export async function runAgent(
  sandbox: Sandbox,
  onStdoutLine: (line: string) => void,
  timeoutMs: number = 10 * 60 * 1000,
): Promise<{ exitCode: number }> {
  let buffer = "";

  const result = await sandbox.commands.run("cd /opt/blip && node runner.mjs", {
    timeoutMs,
    onStdout: (data) => {
      // Handle line buffering - E2B may chunk stdout mid-line
      buffer += data;
      const lines = buffer.split("\n");
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.trim()) {
          onStdoutLine(line);
        }
      }
    },
    onStderr: (data) => {
      // Log stderr but don't treat as events
      console.error(`[sandbox stderr] ${data}`);
    },
  });

  // Flush remaining buffer
  if (buffer.trim()) {
    onStdoutLine(buffer);
  }

  return { exitCode: result.exitCode };
}

export async function pauseSandbox(sandbox: Sandbox): Promise<string> {
  const sandboxId = sandbox.sandboxId;
  // pause() may not be available in all E2B SDK versions — try it, fall back to keeping alive
  if (typeof (sandbox as any).pause === "function") {
    await (sandbox as any).pause();
  }
  return sandboxId;
}

export async function killSandbox(sandbox: Sandbox): Promise<void> {
  await sandbox.kill();
}
