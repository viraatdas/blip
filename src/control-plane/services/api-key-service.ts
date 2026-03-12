import { randomToken, sha256Hex, constantTimeEquals } from "../../common/crypto.js";
import { HttpError } from "../../common/errors.js";
import { SERVICE_API_KEY_PREFIX } from "../../common/constants.js";
import type { AuthenticatedApiKey, ServiceApiKeyRecord } from "../../common/types.js";
import type { ApiKeyResponse } from "../../common/contracts.js";
import type { ApiKeyRepository } from "../repositories/interfaces.js";

function formatKey(record: ServiceApiKeyRecord): ApiKeyResponse {
  return {
    key_id: record.keyId,
    key_prefix: record.keyPrefix,
    name: record.name,
    created_at: record.createdAt,
    revoked_at: record.revokedAt
  };
}

export class ApiKeyService {
  public constructor(private readonly repository: ApiKeyRepository) {}

  public async createKey(userId: string, name?: string): Promise<{ apiKey: string; metadata: ApiKeyResponse }> {
    const keyId = randomToken(9).replace(/[^A-Za-z0-9]/gu, "").slice(0, 16);
    const secret = randomToken(24);
    const secretSalt = randomToken(12);
    const createdAt = new Date().toISOString();
    const rawKey = `${SERVICE_API_KEY_PREFIX}_${keyId}_${secret}`;
    const record: ServiceApiKeyRecord = {
      keyId,
      keyPrefix: rawKey.slice(0, 18),
      userId,
      name: name ?? null,
      secretSalt,
      secretHash: sha256Hex(`${secretSalt}:${secret}`),
      createdAt,
      revokedAt: null
    };

    await this.repository.create(record);

    return {
      apiKey: rawKey,
      metadata: formatKey(record)
    };
  }

  public async listKeys(userId: string): Promise<ApiKeyResponse[]> {
    const records = await this.repository.listByUser(userId);
    return records
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((record) => formatKey(record));
  }

  public async revokeKey(userId: string, keyId: string): Promise<void> {
    const record = await this.repository.getById(keyId!);
    if (!record || record.userId !== userId) {
      throw new HttpError(404, "api_key_not_found", "API key was not found.");
    }

    if (record.revokedAt) {
      return;
    }

    await this.repository.revoke(keyId, new Date().toISOString());
  }

  public async authenticate(rawKey: string): Promise<AuthenticatedApiKey> {
    const match = new RegExp(`^${SERVICE_API_KEY_PREFIX}_([^_]+)_(.+)$`, "u").exec(rawKey.trim());
    if (!match) {
      throw new HttpError(401, "invalid_api_key", "Service API key format is invalid.");
    }

    const keyId = match[1]!;
    const secret = match[2]!;
    const record = await this.repository.getById(keyId);
    if (!record || record.revokedAt) {
      throw new HttpError(401, "invalid_api_key", "Service API key is invalid.");
    }

    const computedHash = sha256Hex(`${record.secretSalt}:${secret}`);
    if (!constantTimeEquals(computedHash, record.secretHash)) {
      throw new HttpError(401, "invalid_api_key", "Service API key is invalid.");
    }

    return {
      userId: record.userId,
      apiKeyId: record.keyId,
      rawKey
    };
  }
}
