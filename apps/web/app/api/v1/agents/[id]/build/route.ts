import { NextRequest } from "next/server";
import { authenticateRequest } from "../../../../../../lib/api-auth";
import { jsonResponse, errorResponse } from "../../../../../../lib/api-helpers";
import { HttpError } from "@blip/shared";
import * as agentRepo from "@blip/db/repositories/agent-repository";
import { generateDockerfile, buildTemplate } from "@blip/e2b";

type Params = { params: Promise<{ id: string }> };

// POST /v1/agents/:id/build - Build E2B template
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await authenticateRequest(req);
    const { id } = await params;

    const agent = await agentRepo.findById(id, userId);
    if (!agent) throw new HttpError(404, "not_found", "Agent not found");

    // Update status to building
    await agentRepo.updateTemplateStatus(id, "building");

    // Generate Dockerfile and build template (async)
    const dockerfile = generateDockerfile(agent.dockerfile);

    // Start build in background
    buildTemplate(id, dockerfile)
      .then(async (templateId) => {
        await agentRepo.updateTemplateStatus(id, "ready", templateId);
      })
      .catch(async (err) => {
        console.error(`[build] Failed to build template for agent ${id}:`, err);
        await agentRepo.updateTemplateStatus(id, "failed");
      });

    return jsonResponse({ status: "building", message: "Template build started" }, 202);
  } catch (error) {
    return errorResponse(error);
  }
}
