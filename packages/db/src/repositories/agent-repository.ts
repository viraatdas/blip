import type { AgentRecord, TemplateStatus } from "@blip/shared";
import { getSupabaseClient } from "../client";

export async function findAgentById(
  id: string,
  userId: string,
): Promise<AgentRecord | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("agents")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findAllAgentsByUser(
  userId: string,
): Promise<AgentRecord[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("agents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createAgent(
  data: Omit<
    AgentRecord,
    "id" | "created_at" | "updated_at" | "e2b_template_id" | "template_status"
  >,
): Promise<AgentRecord> {
  const client = getSupabaseClient();
  const { data: agent, error } = await client
    .from("agents")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return agent;
}

export async function updateAgent(
  id: string,
  userId: string,
  data: Partial<
    Omit<
      AgentRecord,
      "id" | "user_id" | "created_at" | "updated_at" | "e2b_template_id" | "template_status"
    >
  >,
): Promise<AgentRecord> {
  const client = getSupabaseClient();
  const { data: agent, error } = await client
    .from("agents")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return agent;
}

export async function deleteAgent(
  id: string,
  userId: string,
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client
    .from("agents")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateAgentTemplateStatus(
  id: string,
  status: TemplateStatus,
  templateId?: string,
): Promise<AgentRecord> {
  const client = getSupabaseClient();
  const updateData: Record<string, unknown> = {
    template_status: status,
    updated_at: new Date().toISOString(),
  };
  if (templateId !== undefined) {
    updateData.e2b_template_id = templateId;
  }
  const { data, error } = await client
    .from("agents")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function findOrCreateDefault(
  userId: string,
  defaults?: {
    anthropic_api_key?: string;
    e2b_template_id?: string;
  },
): Promise<AgentRecord> {
  const client = getSupabaseClient();

  // Look for existing default agent
  const { data: existing, error: findError } = await client
    .from("agents")
    .select("*")
    .eq("user_id", userId)
    .eq("name", "__default__")
    .maybeSingle();
  if (findError) throw findError;

  if (existing) {
    // Update API key if provided and not already set
    if (defaults?.anthropic_api_key && !existing.anthropic_api_key) {
      const { data: updated, error: updateError } = await client
        .from("agents")
        .update({
          anthropic_api_key: defaults.anthropic_api_key,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (updateError) throw updateError;
      return updated;
    }
    return existing;
  }

  // Create default agent
  const templateId = defaults?.e2b_template_id ?? process.env.DEFAULT_E2B_TEMPLATE_ID ?? null;
  const { data: agent, error: createError } = await client
    .from("agents")
    .insert({
      user_id: userId,
      name: "__default__",
      settings: { model: "claude-sonnet-4-20250514" },
      ...(defaults?.anthropic_api_key && { anthropic_api_key: defaults.anthropic_api_key }),
      ...(templateId && { e2b_template_id: templateId, template_status: "ready" }),
    })
    .select()
    .single();
  if (createError) throw createError;
  return agent;
}

// Short aliases for namespace imports (e.g., `import * as agentRepo`)
export const findById = findAgentById;
export const findAllByUser = findAllAgentsByUser;
export const create = createAgent;
export const update = updateAgent;
// `delete` is a reserved word but works as a property name on namespace imports
export { deleteAgent as delete };
export const updateTemplateStatus = updateAgentTemplateStatus;
