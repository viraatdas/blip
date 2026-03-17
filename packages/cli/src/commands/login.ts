import { createInterface } from "node:readline";
import { writeCredentials } from "../lib/config.js";
import { ApiClient } from "../lib/api-client.js";

const DEFAULT_API_URL = "https://blip-api-exla.fly.dev";
const KEY_PATTERN = /^blip_[A-Za-z0-9_-]+_[A-Za-z0-9_-]+$/;

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function login(flags: Record<string, string | boolean>) {
  let apiKey = typeof flags["api-key"] === "string" ? flags["api-key"] : "";

  if (!apiKey) {
    apiKey = await prompt("API key: ");
  }

  if (!apiKey) {
    console.error("API key is required.");
    process.exit(1);
  }

  if (!KEY_PATTERN.test(apiKey)) {
    console.error(
      "Invalid API key format. Expected: blip_{keyId}_{secret}",
    );
    process.exit(1);
  }

  const apiUrl =
    typeof flags["api-url"] === "string" ? flags["api-url"] : DEFAULT_API_URL;

  // Validate key by hitting the API
  console.log("Verifying API key...");
  const client = new ApiClient(apiUrl, apiKey);

  try {
    await client.get("/api/v1/agents");
  } catch (err) {
    console.error(
      `Authentication failed: ${err instanceof Error ? err.message : err}`,
    );
    process.exit(1);
  }

  writeCredentials({ api_key: apiKey });
  console.log("Logged in successfully. Credentials saved to ~/.blip/credentials.json");
}
