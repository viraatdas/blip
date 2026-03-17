import { auth } from "@clerk/nextjs/server";
import { sha256Hex, constantTimeEquals } from "@blip/shared";
import * as apiKeyRepo from "@blip/db/repositories/api-key-repository";
import * as userRepo from "@blip/db/repositories/user-repository";
import { NextRequest } from "next/server";

// Import the shared types
import type { UserRecord } from "@blip/shared";

export type AuthResult = {
  userId: string;  // internal user ID (uuid)
  authType: "clerk" | "api_key";
};

// Authenticate via Clerk session (dashboard) or API key
export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  // Try API key auth first (x-api-key header or Authorization: Bearer)
  const apiKey = req.headers.get("x-api-key") ?? extractBearerToken(req);

  if (apiKey) {
    return authenticateApiKey(apiKey);
  }

  // Fall back to Clerk session auth
  return authenticateClerk();
}

async function authenticateApiKey(rawKey: string): Promise<AuthResult> {
  // Parse the key format: blip_{keyId}_{secret}
  const parts = rawKey.split("_");
  if (parts.length < 3 || parts[0] !== "blip") {
    throw new AuthError(401, "Invalid API key format");
  }

  const keyId = parts[1];
  const secret = parts.slice(2).join("_");

  // Look up all keys with this key_id to find matching hash
  // We need to check against stored hash
  const { data: keys } = await (await import("@blip/db")).getSupabaseClient()
    .from("api_keys")
    .select("*")
    .eq("key_id", keyId)
    .is("revoked_at", null);

  if (!keys || keys.length === 0) {
    throw new AuthError(401, "Invalid API key");
  }

  for (const key of keys) {
    const hash = sha256Hex(`${key.secret_salt}:${secret}`);
    if (constantTimeEquals(hash, key.secret_hash)) {
      return { userId: key.user_id, authType: "api_key" };
    }
  }

  throw new AuthError(401, "Invalid API key");
}

async function authenticateClerk(): Promise<AuthResult> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    throw new AuthError(401, "Authentication required");
  }

  const user = await userRepo.findByClerkId(clerkUserId);
  if (!user) {
    throw new AuthError(401, "User not found");
  }

  return { userId: user.id, authType: "clerk" };
}

function extractBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

export class AuthError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
