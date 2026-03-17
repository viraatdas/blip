export const API_KEY_PREFIX = "blip";

export const EXECUTION_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;

export const TEMPLATE_STATUSES = [
  "pending",
  "building",
  "ready",
  "failed",
] as const;

export const RUNNER_EVENT_TYPES = [
  "status",
  "assistant_text",
  "tool_start",
  "tool_end",
  "result",
  "error",
  "warning",
] as const;

export const MAX_CONCURRENT_EXECUTIONS = 5;
export const PGMQ_POLL_INTERVAL_MS = 1000;
export const PGMQ_VISIBILITY_TIMEOUT_S = 300;
export const SANDBOX_TIMEOUT_MS = 10 * 60 * 1000;
