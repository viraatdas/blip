import { NextRequest } from "next/server";
import { authenticateRequest } from "../../../../lib/api-auth";
import { jsonResponse, errorResponse, parseBody } from "../../../../lib/api-helpers";
import { createApiKeySchema, API_KEY_PREFIX, randomToken, generateSalt, hashWithSalt } from "@blip/shared";
import * as apiKeyRepo from "@blip/db/repositories/api-key-repository";

// POST /v1/api-keys - Create API key
export async function POST(req: NextRequest) {
  try {
    const { userId } = await authenticateRequest(req);
    const body = await parseBody(req, createApiKeySchema);

    const keyId = randomToken(8);
    const secret = randomToken(32);
    const salt = generateSalt();
    const hash = hashWithSalt(secret, salt);
    const fullKey = `${API_KEY_PREFIX}_${keyId}_${secret}`;

    const apiKey = await apiKeyRepo.create({
      user_id: userId,
      key_id: keyId,
      key_prefix: `${API_KEY_PREFIX}_${keyId}_${secret.slice(0, 4)}...`,
      name: body.name ?? null,
      secret_salt: salt,
      secret_hash: hash,
    });

    // Return the full key only on creation
    return jsonResponse({
      ...apiKey,
      key: fullKey,
    }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

// GET /v1/api-keys - List API keys
export async function GET(req: NextRequest) {
  try {
    const { userId } = await authenticateRequest(req);
    const keys = await apiKeyRepo.findAllByUser(userId);
    return jsonResponse(keys);
  } catch (error) {
    return errorResponse(error);
  }
}
