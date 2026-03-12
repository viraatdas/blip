import type { ServiceApiKeyRecord, SessionRecord, UserRecord } from "../../common/types.js";

export interface ApiKeyRepository {
  create(record: ServiceApiKeyRecord): Promise<void>;
  getById(keyId: string): Promise<ServiceApiKeyRecord | null>;
  listByUser(userId: string): Promise<ServiceApiKeyRecord[]>;
  revoke(keyId: string, revokedAt: string): Promise<void>;
}

export interface SessionRepository {
  create(record: SessionRecord): Promise<void>;
  getById(sessionId: string): Promise<SessionRecord | null>;
  listByUser(userId: string): Promise<SessionRecord[]>;
  listAll(): Promise<SessionRecord[]>;
  save(record: SessionRecord): Promise<void>;
  acquireTurnLock(sessionId: string): Promise<boolean>;
  releaseTurnLock(sessionId: string): Promise<void>;
  delete(sessionId: string): Promise<void>;
}

export interface UserRepository {
  create(record: UserRecord): Promise<void>;
  getById(userId: string): Promise<UserRecord | null>;
  getByStripeCustomerId(customerId: string): Promise<UserRecord | null>;
  save(record: UserRecord): Promise<void>;
}
