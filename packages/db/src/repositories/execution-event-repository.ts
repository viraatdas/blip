import type { ExecutionEventRecord } from "@blip/shared";
import { getSupabaseClient } from "../client";

export async function findExecutionEventsByExecutionId(
  executionId: string,
): Promise<ExecutionEventRecord[]> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("execution_events")
    .select("*")
    .eq("execution_id", executionId)
    .order("seq", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createExecutionEvent(data: {
  execution_id: string;
  seq: number;
  event_type: string;
  payload: Record<string, unknown>;
}): Promise<ExecutionEventRecord> {
  const client = getSupabaseClient();
  const { data: event, error } = await client
    .from("execution_events")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return event;
}

// Short aliases for namespace imports (e.g., `import * as executionEventRepo`)
export const findByExecutionId = findExecutionEventsByExecutionId;
export const create = createExecutionEvent;
