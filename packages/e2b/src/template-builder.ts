import { Sandbox } from "e2b";

const BASE_DOCKERFILE = `FROM e2bdev/code-interpreter:latest

# Install Node.js dependencies for the runner
RUN npm install -g @anthropic-ai/claude-agent-sdk

# Copy the runner script
COPY runner/blip-runner.js /opt/blip/runner.js
`;

export function generateDockerfile(customDockerfile?: string | null): string {
  if (!customDockerfile) {
    return BASE_DOCKERFILE;
  }
  return `${BASE_DOCKERFILE}
# User-defined Dockerfile instructions
${customDockerfile}
`;
}

// Template building uses the E2B CLI or Build API
// For now, we provide the Dockerfile generation and a build trigger
export async function buildTemplate(
  agentId: string,
  dockerfile: string,
): Promise<string> {
  // In production, this would call the E2B Build System 2.0 API
  // or shell out to `e2b template build`
  // For now, return a placeholder
  // The actual implementation would:
  // 1. Write Dockerfile to a temp dir
  // 2. Call e2b template build --dockerfile <path> --name blip-<agentId>
  // 3. Return the template ID
  throw new Error("Template building requires E2B CLI setup - implement with E2B Build API");
}
