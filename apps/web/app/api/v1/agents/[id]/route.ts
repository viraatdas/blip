import { NextRequest } from "next/server";
import { authenticateRequest } from "../../../../../lib/api-auth";
import { jsonResponse, errorResponse, parseBody } from "../../../../../lib/api-helpers";
import { updateAgentSchema, HttpError, encrypt } from "@blip/shared";
import * as agentRepo from "@blip/db/repositories/agent-repository";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? "default-dev-key";

type Params = { params: Promise<{ id: string }> };

// GET /v1/agents/:id
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await authenticateRequest(req);
    const { id } = await params;
    const agent = await agentRepo.findById(id, userId);
    if (!agent) throw new HttpError(404, "not_found", "Agent not found");
    const { anthropic_api_key, ...rest } = agent;
    return jsonResponse({ ...rest, has_anthropic_key: !!anthropic_api_key });
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /v1/agents/:id
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await authenticateRequest(req);
    const { id } = await params;
    const body = await parseBody(req, updateAgentSchema);

    const updateData: Record<string, unknown> = { ...body };
    if (body.anthropic_api_key !== undefined) {
      updateData.anthropic_api_key = body.anthropic_api_key
        ? encrypt(body.anthropic_api_key, ENCRYPTION_KEY)
        : null;
    }

    const agent = await agentRepo.update(id, userId, updateData);
    if (!agent) throw new HttpError(404, "not_found", "Agent not found");
    const { anthropic_api_key, ...rest } = agent;
    return jsonResponse({ ...rest, has_anthropic_key: !!anthropic_api_key });
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /v1/agents/:id
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await authenticateRequest(req);
    const { id } = await params;
    await agentRepo.delete(id, userId);
    return jsonResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
