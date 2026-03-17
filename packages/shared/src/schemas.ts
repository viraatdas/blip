import { z } from "zod";
import {
  EXECUTION_STATUSES,
  TEMPLATE_STATUSES,
  RUNNER_EVENT_TYPES,
} from "./constants";

// Enums
export const executionStatusSchema = z.enum(EXECUTION_STATUSES);
export type ExecutionStatus = z.infer<typeof executionStatusSchema>;

export const templateStatusSchema = z.enum(TEMPLATE_STATUSES);
export type TemplateStatus = z.infer<typeof templateStatusSchema>;

export const runnerEventTypeSchema = z.enum(RUNNER_EVENT_TYPES);
export type RunnerEventType = z.infer<typeof runnerEventTypeSchema>;

// Agent settings
export const agentSettingsSchema = z.object({
  model: z.string().optional(),
  max_turns: z.number().int().positive().optional(),
  max_budget_usd: z.number().positive().optional(),
});

// API request schemas
export const createAgentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  dockerfile: z.string().optional(),
  claude_md: z.string().optional(),
  mcp_config: z.record(z.unknown()).optional(),
  settings: agentSettingsSchema.optional(),
  env_vars: z.record(z.string()).optional(),
  anthropic_api_key: z.string().min(1).optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  dockerfile: z.string().nullable().optional(),
  claude_md: z.string().nullable().optional(),
  mcp_config: z.record(z.unknown()).nullable().optional(),
  settings: agentSettingsSchema.optional(),
  env_vars: z.record(z.string()).nullable().optional(),
  anthropic_api_key: z.string().min(1).nullable().optional(),
});

export const createExecutionSchema = z.object({
  agent_id: z.string().uuid().optional(),
  prompt: z.string().trim().min(1),
  session_id: z.string().optional(),
  anthropic_api_key: z.string().min(1).optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
});

// Runner event schemas
export const runnerEventSchema = z.object({
  type: runnerEventTypeSchema,
  timestamp: z.string(),
  data: z.record(z.unknown()).optional(),
});
export type RunnerEvent = z.infer<typeof runnerEventSchema>;
