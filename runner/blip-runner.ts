import { query, type MessageStream } from "@anthropic-ai/claude-agent-sdk";
import { writeFileSync } from "node:fs";

// Read configuration from environment
const prompt = process.env.BLIP_PROMPT;
const claudeMd = process.env.BLIP_CLAUDE_MD;
const mcpConfigStr = process.env.BLIP_MCP_CONFIG;
const settingsStr = process.env.BLIP_SETTINGS;
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

if (!prompt) {
  emitEvent("error", { message: "BLIP_PROMPT is required" });
  process.exit(1);
}

if (!anthropicApiKey) {
  emitEvent("error", { message: "ANTHROPIC_API_KEY is required" });
  process.exit(1);
}

function emitEvent(type: string, data?: Record<string, unknown>) {
  const event = {
    type,
    timestamp: new Date().toISOString(),
    ...(data && { data }),
  };
  process.stdout.write(JSON.stringify(event) + "\n");
}

async function main() {
  // Write CLAUDE.md if provided
  if (claudeMd) {
    writeFileSync("/home/user/CLAUDE.md", claudeMd, "utf-8");
  }

  // Parse optional configs
  const mcpServers = mcpConfigStr ? JSON.parse(mcpConfigStr) : undefined;
  const settings = settingsStr ? JSON.parse(settingsStr) : {};

  emitEvent("status", { status: "started" });

  const startTime = Date.now();
  let totalCost = 0;
  let turnCount = 0;
  let resultText = "";

  try {
    // Find Claude Code CLI - check common global install paths
    const claudeCodePath = [
      "/usr/local/lib/node_modules/@anthropic-ai/claude-code/cli.js",
      "/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js",
    ].find((p) => {
      try { require("node:fs").accessSync(p); return true; } catch { return false; }
    });

    const result = await query({
      prompt,
      options: {
        systemPrompt: { type: "preset", preset: "claude_code" },
        permissionMode: "bypassPermissions",
        allowDangerouslySkipPermissions: true,
        cwd: "/home/user",
        ...(claudeCodePath && { pathToClaudeCodeExecutable: claudeCodePath }),
        tools: [
          "Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep",
          "WebSearch", "WebFetch", "Agent", "TodoWrite", "NotebookEdit",
        ],
        ...(mcpServers && { mcpServers }),
        ...(settings.model && { model: settings.model }),
        ...(settings.max_budget_usd && { maxBudgetUsd: settings.max_budget_usd }),
        ...(settings.max_turns && { maxTurns: settings.max_turns }),
        ...(claudeMd && { settingSources: ["project"] }),
        anthropicApiKey,
      },
      onMessage(message: MessageStream) {
        if (message.type === "assistant") {
          turnCount++;
          if (typeof message.message === "string") {
            emitEvent("assistant_text", { text: message.message });
            resultText += message.message;
          } else if (message.message?.content) {
            for (const block of message.message.content) {
              if (block.type === "text") {
                emitEvent("assistant_text", { text: block.text });
                resultText += block.text;
              }
            }
          }
        } else if (message.type === "tool_use") {
          emitEvent("tool_start", {
            tool: message.tool_name,
            input: message.input,
          });
        } else if (message.type === "tool_result") {
          emitEvent("tool_end", {
            tool: message.tool_name,
            ...(message.error && { error: message.error }),
          });
        }
      },
    });

    const duration = Date.now() - startTime;
    totalCost = result.costUsd ?? 0;

    emitEvent("result", {
      result_text: result.resultText ?? resultText,
      cost_usd: totalCost,
      turns: turnCount,
      duration_ms: duration,
      stop_reason: result.stopReason ?? "end_turn",
    });
    emitEvent("status", { status: "completed" });
  } catch (error) {
    const duration = Date.now() - startTime;
    emitEvent("error", {
      message: error instanceof Error ? error.message : String(error),
      duration_ms: duration,
    });
    emitEvent("status", { status: "failed" });
    process.exit(1);
  }
}

main();
