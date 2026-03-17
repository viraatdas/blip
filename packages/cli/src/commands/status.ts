import { readConfig, readCredentials } from "../lib/config.js";
import { ApiClient } from "../lib/api-client.js";

type AgentResponse = {
  id: string;
  name: string;
  template_status: string;
  e2b_template_id: string | null;
  created_at: string;
  updated_at: string;
};

function printStatus(agent: AgentResponse) {
  const statusIcon: Record<string, string> = {
    pending: "○",
    building: "◐",
    ready: "●",
    failed: "✕",
  };

  console.log(`Agent:    ${agent.name}`);
  console.log(`ID:       ${agent.id}`);
  console.log(`Status:   ${statusIcon[agent.template_status] ?? "?"} ${agent.template_status}`);
  if (agent.e2b_template_id) {
    console.log(`Template: ${agent.e2b_template_id}`);
  }
  console.log(`Updated:  ${new Date(agent.updated_at).toLocaleString()}`);
}

export async function status(flags: Record<string, string | boolean>) {
  const config = readConfig();
  const creds = readCredentials();

  if (!config.agent_id) {
    console.error("No agent_id in config. Run `blip push` first.");
    process.exit(1);
  }

  const client = new ApiClient(config.api_url, creds.api_key);
  const { data } = await client.get(`/api/v1/agents/${config.agent_id}`);
  const agent = data as AgentResponse;

  printStatus(agent);

  if (flags.watch) {
    const POLL_INTERVAL_MS = 3000;
    while (true) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const { data: updated } = await client.get(`/api/v1/agents/${config.agent_id}`);
      const updatedAgent = updated as AgentResponse;

      // Clear and reprint
      process.stdout.write("\x1B[2J\x1B[0f");
      printStatus(updatedAgent);

      if (
        updatedAgent.template_status === "ready" ||
        updatedAgent.template_status === "failed"
      ) {
        break;
      }
    }
  }
}
