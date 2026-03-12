import { z } from "zod";
import { ACTIVE_SESSION_STATUSES, EFFORT_TOKEN_BUDGETS } from "./constants.js";

export const effortSchema = z.enum(["low", "medium", "high"]);
export type EffortLevel = z.infer<typeof effortSchema>;

export const sessionStatusSchema = z.enum([
  "awaiting_bootstrap",
  "ready",
  "active",
  "failed",
  "deleting",
  "expired"
]);
export type SessionStatus = z.infer<typeof sessionStatusSchema>;

const disallowedAgentOptionKeys = new Set([
  "abortController",
  "continue",
  "resume",
  "resumeSessionAt",
  "sessionId",
  "forkSession",
  "env",
  "canUseTool",
  "hooks",
  "onElicitation",
  "spawnClaudeCodeProcess",
  "thinking",
  "maxThinkingTokens"
]);

export const serializedAgentOptionsSchema = z
  .record(z.string(), z.unknown())
  .superRefine((value, ctx) => {
    for (const key of Object.keys(value)) {
      if (disallowedAgentOptionKeys.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `agent_options.${key} is not allowed via the public API.`
        });
      }
    }

    const permissionMode = value.permissionMode;
    if (permissionMode === "bypassPermissions" && value.allowDangerouslySkipPermissions !== true) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "agent_options.allowDangerouslySkipPermissions must be true when permissionMode is bypassPermissions."
      });
    }
  });
export type SerializedAgentOptions = z.infer<typeof serializedAgentOptionsSchema>;

export const createApiKeyRequestSchema = z.object({
  name: z.string().trim().min(1).max(120).optional()
});
export type CreateApiKeyRequest = z.infer<typeof createApiKeyRequestSchema>;

export const apiKeyResponseSchema = z.object({
  key_id: z.string(),
  key_prefix: z.string(),
  name: z.string().nullable(),
  created_at: z.string(),
  revoked_at: z.string().nullable()
});
export type ApiKeyResponse = z.infer<typeof apiKeyResponseSchema>;

export const createSessionRequestSchema = z.object({
  model: z.string().trim().min(1),
  effort: effortSchema.default("medium"),
  agent_options: serializedAgentOptionsSchema.default({})
});
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;

export const createSessionResponseSchema = z.object({
  session_id: z.string().uuid(),
  status: sessionStatusSchema,
  model: z.string(),
  effort: effortSchema,
  created_at: z.string(),
  idle_expires_at: z.string(),
  hard_expires_at: z.string(),
  bootstrap_url: z.string().url(),
  events_url: z.string().url()
});
export type CreateSessionResponse = z.infer<typeof createSessionResponseSchema>;

export const getSessionResponseSchema = z.object({
  session_id: z.string().uuid(),
  status: sessionStatusSchema,
  model: z.string(),
  effort: effortSchema,
  created_at: z.string(),
  last_activity_at: z.string(),
  idle_expires_at: z.string(),
  hard_expires_at: z.string(),
  bootstrapped: z.boolean(),
  busy: z.boolean()
});
export type GetSessionResponse = z.infer<typeof getSessionResponseSchema>;

export const sendMessageRequestSchema = z.object({
  prompt: z.string().trim().min(1)
});
export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const sendMessageResponseSchema = z.object({
  session_id: z.string().uuid(),
  status: sessionStatusSchema,
  result: z.string(),
  stop_reason: z.string().nullable(),
  total_cost_usd: z.number(),
  num_turns: z.number().int().nonnegative(),
  structured_output: z.unknown().optional()
});
export type SendMessageResponse = z.infer<typeof sendMessageResponseSchema>;

export const streamTokenResponseSchema = z.object({
  session_id: z.string().uuid(),
  events_url: z.string().url(),
  expires_at: z.string()
});
export type StreamTokenResponse = z.infer<typeof streamTokenResponseSchema>;

export const runnerBootstrapRequestSchema = z.object({
  api_key: z.string().trim().min(1)
});
export type RunnerBootstrapRequest = z.infer<typeof runnerBootstrapRequestSchema>;

export const runnerMessageRequestSchema = z.object({
  prompt: z.string().trim().min(1)
});
export type RunnerMessageRequest = z.infer<typeof runnerMessageRequestSchema>;

export const runnerHeartbeatResponseSchema = z.object({
  session_id: z.string().uuid(),
  bootstrapped: z.boolean(),
  has_conversation: z.boolean(),
  busy: z.boolean(),
  last_activity_at: z.string()
});
export type RunnerHeartbeatResponse = z.infer<typeof runnerHeartbeatResponseSchema>;

export const sessionConfigSchema = z.object({
  sessionId: z.string().uuid(),
  model: z.string().min(1),
  effort: effortSchema,
  agentOptions: serializedAgentOptionsSchema.default({}),
  workspaceDir: z.string().min(1)
});
export type SessionConfig = z.infer<typeof sessionConfigSchema>;

export function isActiveSessionStatus(status: SessionStatus): boolean {
  return (ACTIVE_SESSION_STATUSES as readonly string[]).includes(status);
}

export function effortBudgetTokens(effort: EffortLevel): number {
  return EFFORT_TOKEN_BUDGETS[effort];
}
