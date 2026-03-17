import { createInterface } from "node:readline";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { blipDirExists, scaffoldBlipDir } from "../lib/config.js";

const DEFAULT_API_URL = "https://blip-api-exla.fly.dev";

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function init(flags: Record<string, string | boolean>) {
  if (blipDirExists()) {
    console.log(".blip/ directory already exists.");
    return;
  }

  let name = typeof flags.name === "string" ? flags.name : "";
  if (!name) {
    name = await prompt("Agent name: ");
  }

  if (!name) {
    console.error("Agent name is required.");
    process.exit(1);
  }

  const apiUrl =
    typeof flags["api-url"] === "string" ? flags["api-url"] : DEFAULT_API_URL;

  scaffoldBlipDir(name, apiUrl);

  console.log(`Created .blip/ directory for agent "${name}"`);
  console.log("");
  console.log("Files:");
  console.log("  .blip/config.json   - Agent identity and settings");
  console.log("  .blip/Dockerfile    - Custom Docker instructions");
  console.log("  .blip/CLAUDE.md     - Agent instructions");
  console.log("  .blip/mcp.json      - MCP server configuration");
  console.log("  .blip/.env          - Secrets and env vars");

  // Check if .blip/.env is in .gitignore
  const gitignorePath = join(process.cwd(), ".gitignore");
  if (existsSync(gitignorePath)) {
    const gitignore = readFileSync(gitignorePath, "utf-8");
    if (!gitignore.includes(".blip/.env")) {
      console.log("");
      console.log(
        "Warning: Add .blip/.env to your .gitignore to avoid committing secrets:",
      );
      console.log("  echo '.blip/.env' >> .gitignore");
    }
  } else {
    console.log("");
    console.log(
      "Warning: No .gitignore found. Create one and add .blip/.env to avoid committing secrets.",
    );
  }
}
