import { readConfig, readCredentials } from "../lib/config.js";
import { ApiClient } from "../lib/api-client.js";
import { Spinner } from "../lib/spinner.js";

type Execution = {
  id: string;
  status: string;
  result_text: string | null;
  cost_usd: number | null;
  turns: number | null;
  duration_ms: number | null;
};

type ExecutionEvent = {
  id: string;
  event_type: string;
  data: Record<string, unknown>;
  seq: number;
  created_at: string;
};

type ExecutionResponse = Execution & {
  events: ExecutionEvent[];
};

export async function run(prompt: string, flags: Record<string, string | boolean>) {
  if (!prompt) {
    console.error("Usage: blip run <prompt>");
    process.exit(1);
  }

  const config = readConfig();
  const creds = readCredentials();

  if (!config.agent_id) {
    console.error("No agent_id in config. Run `blip push` first.");
    process.exit(1);
  }

  const client = new ApiClient(config.api_url, creds.api_key);

  // Create execution
  console.log(`Running prompt against agent "${config.name}"...`);
  console.log("");

  const { data: execData } = await client.post("/api/v1/executions", {
    agent_id: config.agent_id,
    prompt,
  });
  const execution = execData as Execution;
  const executionId = execution.id;

  // Poll for events
  const spinner = new Spinner("Waiting for execution to start...");
  spinner.start();

  let lastSeq = 0;
  const POLL_INTERVAL_MS = 2000;

  while (true) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const { data } = await client.get(`/api/v1/executions/${executionId}`);
    const result = data as ExecutionResponse;

    // Print new events
    const newEvents = result.events.filter((e) => e.seq > lastSeq);
    if (newEvents.length > 0) {
      spinner.stop();

      for (const event of newEvents) {
        printEvent(event);
        lastSeq = event.seq;
      }
    }

    // Check if done
    if (result.status === "completed" || result.status === "failed" || result.status === "cancelled") {
      spinner.stop();
      console.log("");
      console.log("---");
      console.log(`Status: ${result.status}`);
      if (result.cost_usd != null) {
        console.log(`Cost: $${result.cost_usd.toFixed(4)}`);
      }
      if (result.turns != null) {
        console.log(`Turns: ${result.turns}`);
      }
      if (result.duration_ms != null) {
        console.log(`Duration: ${(result.duration_ms / 1000).toFixed(1)}s`);
      }
      if (result.result_text) {
        console.log("");
        console.log("Result:");
        console.log(result.result_text);
      }
      break;
    }

    if (newEvents.length === 0 && (result.status === "queued" || result.status === "running")) {
      if (result.status === "running") {
        spinner.update("Executing...");
      }
    }
  }
}

function printEvent(event: ExecutionEvent) {
  switch (event.event_type) {
    case "status":
      console.log(`[status] ${event.data.message ?? event.data.status ?? ""}`);
      break;
    case "assistant_text":
      process.stdout.write(String(event.data.text ?? ""));
      break;
    case "tool_start":
      console.log(`\n[tool] ${event.data.tool_name ?? "unknown"}${event.data.input ? `: ${truncate(JSON.stringify(event.data.input), 100)}` : ""}`);
      break;
    case "tool_end":
      if (event.data.error) {
        console.log(`[tool error] ${event.data.error}`);
      }
      break;
    case "result":
      console.log(`\n[result] ${event.data.text ?? ""}`);
      break;
    case "error":
      console.log(`[error] ${event.data.message ?? JSON.stringify(event.data)}`);
      break;
    case "warning":
      console.log(`[warning] ${event.data.message ?? JSON.stringify(event.data)}`);
      break;
    default:
      console.log(`[${event.event_type}] ${JSON.stringify(event.data)}`);
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "..." : str;
}
