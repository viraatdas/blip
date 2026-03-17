import { NextRequest } from "next/server";
import { authenticateRequest } from "../../../../lib/api-auth";
import { jsonResponse, errorResponse, parseBody } from "../../../../lib/api-helpers";
import { createAgentSchema } from "@blip/shared";
import * as agentRepo from "@blip/db/repositories/agent-repository";
import { encrypt } from "@blip/shared";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? "default-dev-key";

// POST /v1/agents - Create agent
export async function POST(req: NextRequest) {
  try {
    const { userId } = await authenticateRequest(req);
    const body = await parseBody(req, createAgentSchema);

    const agent = await agentRepo.create({
      user_id: userId,
      name: body.name,
      dockerfile: body.dockerfile ?? null,
      claude_md: body.claude_md ?? null,
      mcp_config: body.mcp_config ?? null,
      settings: body.settings ?? {},
      env_vars: body.env_vars ?? null,
      anthropic_api_key: body.anthropic_api_key
        ? encrypt(body.anthropic_api_key, ENCRYPTION_KEY)
        : null,
    });

    return jsonResponse(agent, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

// GET /v1/agents - List agents
export async function GET(req: NextRequest) {
  try {
    const { userId } = await authenticateRequest(req);
    const agents = await agentRepo.findAllByUser(userId);
    // Strip encrypted API keys from response
    const sanitized = agents.map(({ anthropic_api_key, ...rest }) => ({
      ...rest,
      has_anthropic_key: !!anthropic_api_key,
    }));
    return jsonResponse(sanitized);
  } catch (error) {
    return errorResponse(error);
  }
}
