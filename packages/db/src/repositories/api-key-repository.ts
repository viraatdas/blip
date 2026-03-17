import type { ApiKeyRecord } from "@blip/shared";
import { getSupabaseClient } from "../client";

export async function findApiKeyBySecretHash(
  secretHash: string,
): Promise<ApiKeyRecord | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("api_keys")
    .select("*")
    .eq("secret_hash", secretHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findAllApiKeysByUser(
  userId: string,
): Promise<ApiKeyRecord[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("api_keys")
    .select("*")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createApiKey(data: {
  user_id: string;
  key_id: string;
  key_prefix: string;
  name: string | null;
  secret_salt: string;
  secret_hash: string;
}): Promise<ApiKeyRecord> {
  const client = getSupabaseClient();
  const { data: key, error } = await client
    .from("api_keys")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return key;
}

export async function revokeApiKey(
  id: string,
  userId: string,
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

// Short aliases for namespace imports (e.g., `import * as apiKeyRepo`)
export const findBySecretHash = findApiKeyBySecretHash;
export const findAllByUser = findAllApiKeysByUser;
export const create = createApiKey;
export const revoke = revokeApiKey;
