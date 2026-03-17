import { NextRequest } from "next/server";
import { authenticateRequest } from "../../../../../lib/api-auth";
import { jsonResponse, errorResponse } from "../../../../../lib/api-helpers";

import * as apiKeyRepo from "@blip/db/repositories/api-key-repository";

type Params = { params: Promise<{ id: string }> };

// DELETE /v1/api-keys/:id - Revoke key
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const { userId } = await authenticateRequest(req);
    const { id } = await params;
    await apiKeyRepo.revoke(id, userId);
    return jsonResponse({ revoked: true });
  } catch (error) {
    return errorResponse(error);
  }
}
