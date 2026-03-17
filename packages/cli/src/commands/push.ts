import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readConfig, writeConfig, readCredentials, readBlipFile, getBlipDir } from "../lib/config.js";
import { ApiClient } from "../lib/api-client.js";
import { parseDotenv } from "../lib/dotenv-parser.js";
import { Spinner } from "../lib/spinner.js";

export async function push(_flags: Record<string, string | boolean>) {
  const config = readConfig();
  const creds = readCredentials();
  const client = new ApiClient(config.api_url, creds.api_key);

  // Read .blip files
  const dockerfile = readBlipFile("Dockerfile");
  const claudeMd = readBlipFile("CLAUDE.md");

  let mcpConfig: Record<string, unknown> | null = null;
  const mcpRaw = readBlipFile("mcp.json");
  if (mcpRaw) {
    try {
      mcpConfig = JSON.parse(mcpRaw);
    } catch {
      throw new Error(".blip/mcp.json is not valid JSON");
    }
  }

  let envVars: Record<string, string> = {};
  const envRaw = readBlipFile(".env");
  if (envRaw) {
    envVars = parseDotenv(envRaw);
  }

  // Extract ANTHROPIC_API_KEY from env vars
  let anthropicApiKey: string | undefined;
  if (envVars.ANTHROPIC_API_KEY) {
    anthropicApiKey = envVars.ANTHROPIC_API_KEY;
    delete envVars.ANTHROPIC_API_KEY;
  }

  // Build request body
  const body: Record<string, unknown> = {
    name: config.name,
    settings: config.settings,
  };

  if (dockerfile?.trim()) body.dockerfile = dockerfile;
  else body.dockerfile = null;

  if (claudeMd?.trim()) body.claude_md = claudeMd;
  else body.claude_md = null;

  if (mcpConfig && Object.keys(mcpConfig).length > 0) body.mcp_config = mcpConfig;
  else body.mcp_config = null;

  if (Object.keys(envVars).length > 0) body.env_vars = envVars;
  else body.env_vars = null;

  if (anthropicApiKey) body.anthropic_api_key = anthropicApiKey;

  // Create or update agent
  if (!config.agent_id) {
    console.log(`Creating agent "${config.name}"...`);
    const { data } = await client.post("/api/v1/agents", body);
    const agent = data as { id: string };
    config.agent_id = agent.id;
    writeConfig(config);
    console.log(`Agent created: ${agent.id}`);
  } else {
    console.log(`Updating agent "${config.name}" (${config.agent_id})...`);
    await client.patch(`/api/v1/agents/${config.agent_id}`, body);
    console.log("Agent updated.");
  }

  // Trigger build
  console.log("Starting template build...");
  await client.post(`/api/v1/agents/${config.agent_id}/build`);

  // Poll for build status
  const spinner = new Spinner("Building template...");
  spinner.start();

  const startTime = Date.now();
  const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  const POLL_INTERVAL_MS = 3000;

  while (true) {
    if (Date.now() - startTime > TIMEOUT_MS) {
      spinner.stop("Build timed out after 10 minutes.");
      process.exit(1);
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const { data } = await client.get(`/api/v1/agents/${config.agent_id}`);
    const agent = data as { template_status: string };

    if (agent.template_status === "ready") {
      spinner.stop("Template build complete. Agent is ready.");
      break;
    } else if (agent.template_status === "failed") {
      spinner.stop("Template build failed.");
      process.exit(1);
    }

    spinner.update(`Building template... (${Math.round((Date.now() - startTime) / 1000)}s)`);
  }

  // Warn about .gitignore
  const gitignorePath = join(process.cwd(), ".gitignore");
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, "utf-8");
    if (!gitignore.includes(".blip/.env")) {
      console.log("");
      console.log(
        "Warning: .blip/.env is not in .gitignore. Add it to avoid committing secrets.",
      );
    }
  }
}
