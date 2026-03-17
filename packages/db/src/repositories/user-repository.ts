import type { UserRecord } from "@blip/shared";
import { getSupabaseClient } from "../client";

export async function findUserByClerkId(
  clerkUserId: string,
): Promise<UserRecord | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("users")
    .select("*")
    .eq("clerk_user_id", clerkUserId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createUser(data: {
  clerk_user_id: string;
  email: string;
}): Promise<UserRecord> {
  const client = getSupabaseClient();
  const { data: user, error } = await client
    .from("users")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return user;
}

export async function updateStripeCustomerId(
  id: string,
  stripeCustomerId: string,
): Promise<UserRecord> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("users")
    .update({
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Short aliases for namespace imports (e.g., `import * as userRepo`)
export const findByClerkId = findUserByClerkId;
export const create = createUser;
