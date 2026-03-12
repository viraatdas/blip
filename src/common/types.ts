import type { EffortLevel, SerializedAgentOptions, SessionStatus } from "./contracts.js";

export type ServiceApiKeyRecord = {
  keyId: string;
  keyPrefix: string;
  userId: string;
  name: string | null;
  secretSalt: string;
  secretHash: string;
  createdAt: string;
  revokedAt: string | null;
};

export type SessionRecord = {
  sessionId: string;
  userId: string;
  apiKeyId: string;
  machineId: string;
  status: SessionStatus;
  model: string;
  effort: EffortLevel;
  agentOptions: SerializedAgentOptions;
  configDigest: string;
  createdAt: string;
  lastActivityAt: string;
  idleExpiresAt: string;
  hardExpiresAt: string;
  inFlightTurn: boolean;
};

export type AuthenticatedUser = {
  userId: string;
  token: string;
};

export type AuthenticatedApiKey = {
  userId: string;
  apiKeyId: string;
  rawKey: string;
};

export type UserRecord = {
  userId: string;
  email: string;
  stripeCustomerId: string | null;
  hasPaymentMethod: boolean;
  createdAt: string;
};
