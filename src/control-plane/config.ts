import { z } from "zod";
import {
  BOOTSTRAP_TOKEN_TTL_MS,
  RUNNER_PORT,
  SESSION_HARD_TIMEOUT_MS,
  SESSION_IDLE_TIMEOUT_MS,
  STREAM_TOKEN_TTL_MS
} from "../common/constants.js";

const envSchema = z.object({
  API_KEYS_TABLE_NAME: z.string().min(1),
  SESSIONS_TABLE_NAME: z.string().min(1),
  USERS_TABLE_NAME: z.string().optional().transform((v) => v || undefined),
  FLY_APP_NAME: z.string().min(1),
  FLY_APP_BASE_URL: z.string().url().optional(),
  FLY_MACHINE_IMAGE: z.string().min(1),
  FLY_API_TOKEN_SECRET_ID: z.string().min(1),
  RUNNER_SHARED_SECRET_ID: z.string().min(1),
  SESSION_TOKEN_SECRET_ID: z.string().min(1),
  STRIPE_SECRET_KEY_SECRET_ID: z.string().optional().transform((v) => v || undefined),
  STRIPE_WEBHOOK_SECRET_ID: z.string().optional().transform((v) => v || undefined),
  STRIPE_STARTER_PRICE_ID: z.string().optional().transform((v) => v || undefined),
  STRIPE_PRO_PRICE_ID: z.string().optional().transform((v) => v || undefined),
  CLERK_SECRET_KEY_SECRET_ID: z.string().min(1),
  AWS_REGION: z.string().min(1).optional(),
  AWS_DEFAULT_REGION: z.string().min(1).optional(),
  SESSION_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  SESSION_HARD_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
  BOOTSTRAP_TOKEN_TTL_MS: z.coerce.number().int().positive().optional(),
  STREAM_TOKEN_TTL_MS: z.coerce.number().int().positive().optional(),
  RUNNER_WORKSPACE_ROOT: z.string().min(1).default("/workspace"),
  RUNNER_PORT: z.coerce.number().int().positive().default(RUNNER_PORT),
  FLY_MACHINE_MEMORY_MB: z.coerce.number().int().positive().default(1024),
  FLY_MACHINE_CPUS: z.coerce.number().int().positive().default(1)
});

export type ControlPlaneConfig = {
  apiKeysTableName: string;
  sessionsTableName: string;
  usersTableName: string | undefined;
  flyAppName: string;
  flyAppBaseUrl: string;
  flyMachineImage: string;
  flyApiTokenSecretId: string;
  runnerSharedSecretId: string;
  sessionTokenSecretId: string;
  stripeSecretKeySecretId: string | undefined;
  stripeWebhookSecretId: string | undefined;
  stripeStarterPriceId: string | undefined;
  stripeProPriceId: string | undefined;
  clerkSecretKeySecretId: string;
  region: string;
  sessionIdleTimeoutMs: number;
  sessionHardTimeoutMs: number;
  bootstrapTokenTtlMs: number;
  streamTokenTtlMs: number;
  runnerWorkspaceRoot: string;
  runnerPort: number;
  flyMachineMemoryMb: number;
  flyMachineCpus: number;
};

export function loadControlPlaneConfig(environment: NodeJS.ProcessEnv = process.env): ControlPlaneConfig {
  const parsed = envSchema.parse(environment);
  const region = parsed.AWS_REGION ?? parsed.AWS_DEFAULT_REGION;
  if (!region) {
    throw new Error("AWS region is required via AWS_REGION or AWS_DEFAULT_REGION.");
  }

  return {
    apiKeysTableName: parsed.API_KEYS_TABLE_NAME,
    sessionsTableName: parsed.SESSIONS_TABLE_NAME,
    usersTableName: parsed.USERS_TABLE_NAME,
    flyAppName: parsed.FLY_APP_NAME,
    flyAppBaseUrl: parsed.FLY_APP_BASE_URL ?? `https://${parsed.FLY_APP_NAME}.fly.dev`,
    flyMachineImage: parsed.FLY_MACHINE_IMAGE,
    flyApiTokenSecretId: parsed.FLY_API_TOKEN_SECRET_ID,
    runnerSharedSecretId: parsed.RUNNER_SHARED_SECRET_ID,
    sessionTokenSecretId: parsed.SESSION_TOKEN_SECRET_ID,
    stripeSecretKeySecretId: parsed.STRIPE_SECRET_KEY_SECRET_ID,
    stripeWebhookSecretId: parsed.STRIPE_WEBHOOK_SECRET_ID,
    stripeStarterPriceId: parsed.STRIPE_STARTER_PRICE_ID,
    stripeProPriceId: parsed.STRIPE_PRO_PRICE_ID,
    clerkSecretKeySecretId: parsed.CLERK_SECRET_KEY_SECRET_ID,
    region,
    sessionIdleTimeoutMs: parsed.SESSION_IDLE_TIMEOUT_MS ?? SESSION_IDLE_TIMEOUT_MS,
    sessionHardTimeoutMs: parsed.SESSION_HARD_TIMEOUT_MS ?? SESSION_HARD_TIMEOUT_MS,
    bootstrapTokenTtlMs: parsed.BOOTSTRAP_TOKEN_TTL_MS ?? BOOTSTRAP_TOKEN_TTL_MS,
    streamTokenTtlMs: parsed.STREAM_TOKEN_TTL_MS ?? STREAM_TOKEN_TTL_MS,
    runnerWorkspaceRoot: parsed.RUNNER_WORKSPACE_ROOT,
    runnerPort: parsed.RUNNER_PORT,
    flyMachineMemoryMb: parsed.FLY_MACHINE_MEMORY_MB,
    flyMachineCpus: parsed.FLY_MACHINE_CPUS
  };
}
