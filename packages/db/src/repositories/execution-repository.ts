import type { ExecutionRecord, ExecutionStatus } from "@blip/shared";
import { getSupabaseClient } from "../client";

export async function findExecutionById(
  id: string,
): Promise<ExecutionRecord | null> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("executions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findAllExecutionsByUser(
  userId: string,
  options?: { agent_id?: string; limit?: number; offset?: number },
): Promise<ExecutionRecord[]> {
  const client = getSupabaseClient();
  let query = client
    .from("executions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (options?.agent_id) {
    query = query.eq("agent_id", options.agent_id);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(
      options.offset,
      options.offset + (options.limit ?? 50) - 1,
    );
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createExecution(data: {
  agent_id?: string | null;
  user_id: string;
  prompt: string;
  session_id?: string;
}): Promise<ExecutionRecord> {
  const client = getSupabaseClient();
  const { data: execution, error } = await client
    .from("executions")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return execution;
}

export async function updateExecutionStatus(
  id: string,
  status: ExecutionStatus,
  extra?: Partial<
    Pick<
      ExecutionRecord,
      "sandbox_id" | "session_id" | "result_text" | "cost_usd" | "turns" | "duration_ms"
    >
  >,
): Promise<ExecutionRecord> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("executions")
    .update({
      status,
      ...extra,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Short aliases for namespace imports (e.g., `import * as executionRepo`)
export const findById = findExecutionById;
export const findAllByUser = findAllExecutionsByUser;
export const create = createExecution;
export const updateStatus = updateExecutionStatus;
