import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type BlipConfig = {
  name: string;
  agent_id: string | null;
  api_url: string;
  settings: {
    model?: string;
    max_turns?: number;
    max_budget_usd?: number;
  };
};

export type Credentials = {
  api_key: string;
};

const BLIP_DIR = ".blip";
const CONFIG_FILE = "config.json";
const CREDENTIALS_DIR = join(homedir(), ".blip");
const CREDENTIALS_FILE = join(CREDENTIALS_DIR, "credentials.json");

export function getBlipDir(): string {
  return join(process.cwd(), BLIP_DIR);
}

export function blipDirExists(): boolean {
  return existsSync(getBlipDir());
}

export function readConfig(): BlipConfig {
  const configPath = join(getBlipDir(), CONFIG_FILE);
  if (!existsSync(configPath)) {
    throw new Error("No .blip/config.json found. Run `blip init` first.");
  }
  return JSON.parse(readFileSync(configPath, "utf-8"));
}

export function writeConfig(config: BlipConfig): void {
  const configPath = join(getBlipDir(), CONFIG_FILE);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}

export function readBlipFile(filename: string): string | null {
  const filePath = join(getBlipDir(), filename);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath, "utf-8");
}

export function readCredentials(): Credentials {
  if (!existsSync(CREDENTIALS_FILE)) {
    throw new Error("Not logged in. Run `blip login` first.");
  }
  return JSON.parse(readFileSync(CREDENTIALS_FILE, "utf-8"));
}

export function writeCredentials(creds: Credentials): void {
  mkdirSync(CREDENTIALS_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2) + "\n");
  chmodSync(CREDENTIALS_FILE, 0o600);
}

export function scaffoldBlipDir(name: string, apiUrl: string): void {
  const dir = getBlipDir();
  mkdirSync(dir, { recursive: true });

  const config: BlipConfig = {
    name,
    agent_id: null,
    api_url: apiUrl,
    settings: {
      model: "claude-sonnet-4-20250514",
      max_turns: 10,
      max_budget_usd: 1.0,
    },
  };

  writeFileSync(join(dir, CONFIG_FILE), JSON.stringify(config, null, 2) + "\n");

  if (!existsSync(join(dir, "Dockerfile"))) {
    writeFileSync(
      join(dir, "Dockerfile"),
      "# Custom Dockerfile instructions (appended to base image)\n# RUN apt-get update && apt-get install -y ...\n",
    );
  }

  if (!existsSync(join(dir, "CLAUDE.md"))) {
    writeFileSync(
      join(dir, "CLAUDE.md"),
      "# Agent Instructions\n\nYou are a helpful coding assistant.\n",
    );
  }

  if (!existsSync(join(dir, "mcp.json"))) {
    writeFileSync(
      join(dir, "mcp.json"),
      JSON.stringify({ mcpServers: {} }, null, 2) + "\n",
    );
  }

  if (!existsSync(join(dir, ".env"))) {
    writeFileSync(
      join(dir, ".env"),
      "# Secrets and environment variables\n# ANTHROPIC_API_KEY=sk-ant-...\n",
    );
  }
}
