import type { ExecutionStatus, TemplateStatus, RunnerEventType } from "./schemas";

export type UserRecord = {
  id: string;
  clerk_user_id: string;
  email: string;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AgentRecord = {
  id: string;
  user_id: string;
  name: string;
  dockerfile: string | null;
  claude_md: string | null;
  mcp_config: Record<string, unknown> | null;
  settings: AgentSettings;
  env_vars: Record<string, string> | null;
  anthropic_api_key: string | null;
  e2b_template_id: string | null;
  template_status: TemplateStatus;
  created_at: string;
  updated_at: string;
};

export type AgentSettings = {
  model?: string;
  max_turns?: number;
  max_budget_usd?: number;
};

export type ApiKeyRecord = {
  id: string;
  user_id: string;
  key_id: string;
  key_prefix: string;
  name: string | null;
  secret_salt: string;
  secret_hash: string;
  created_at: string;
  revoked_at: string | null;
};

export type ExecutionRecord = {
  id: string;
  agent_id: string | null;
  user_id: string;
  prompt: string;
  session_id: string | null;
  status: ExecutionStatus;
  sandbox_id: string | null;
  result_text: string | null;
  cost_usd: number | null;
  turns: number | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
};

export type ExecutionEventRecord = {
  id: string;
  execution_id: string;
  seq: number;
  event_type: RunnerEventType;
  payload: Record<string, unknown>;
  created_at: string;
};

export type UsageRecord = {
  id: string;
  user_id: string;
  execution_id: string;
  cost_usd: number;
  duration_ms: number;
  created_at: string;
};
