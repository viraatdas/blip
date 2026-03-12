export const SERVICE_API_KEY_PREFIX = "blip";

export const EFFORT_TOKEN_BUDGETS = {
  low: 1024,
  medium: 4096,
  high: 8192
} as const;

export const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
export const SESSION_HARD_TIMEOUT_MS = 2 * 60 * 60 * 1000;
export const BOOTSTRAP_TOKEN_TTL_MS = 10 * 60 * 1000;
export const STREAM_TOKEN_TTL_MS = 15 * 60 * 1000;
export const STREAM_HEARTBEAT_MS = 15 * 1000;

export const ACTIVE_SESSION_STATUSES = [
  "awaiting_bootstrap",
  "ready",
  "active"
] as const;

export const RUNNER_PORT = 8080;
