import type { UsageRecord } from "@blip/shared";
import { getSupabaseClient } from "../client";

export async function createUsageRecord(data: {
  user_id: string;
  execution_id: string;
  cost_usd: number;
  duration_ms: number;
}): Promise<UsageRecord> {
  const client = getSupabaseClient();
  const { data: record, error } = await client
    .from("usage_records")
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return record;
}

export async function getUsageSummary(
  userId: string,
  since: Date,
): Promise<{ total_cost_usd: number; execution_count: number }> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("usage_records")
    .select("cost_usd")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
  if (error) throw error;

  const totalCost = (data ?? []).reduce(
    (sum, row) => sum + Number(row.cost_usd),
    0,
  );

  return {
    total_cost_usd: totalCost,
    execution_count: data?.length ?? 0,
  };
}

// Short aliases for namespace imports (e.g., `import * as usageRepo`)
export const create = createUsageRecord;
