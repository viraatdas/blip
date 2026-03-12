import { describe, expect, test } from "vitest";
import { ApiKeyService } from "../src/control-plane/services/api-key-service.js";
import { HttpError } from "../src/common/errors.js";
import { InMemoryApiKeyRepository } from "./helpers.js";

describe("ApiKeyService", () => {
  test("creates, lists, authenticates, and revokes keys", async () => {
    const repository = new InMemoryApiKeyRepository();
    const service = new ApiKeyService(repository);

    const created = await service.createKey("user-1", "primary");
    expect(created.apiKey).toMatch(/^blip_/u);

    const authenticated = await service.authenticate(created.apiKey);
    expect(authenticated.userId).toBe("user-1");

    const listed = await service.listKeys("user-1");
    expect(listed).toHaveLength(1);
    expect(listed[0]?.name).toBe("primary");

    await service.revokeKey("user-1", listed[0]!.key_id);

    await expect(service.authenticate(created.apiKey)).rejects.toMatchObject({
      statusCode: 401,
      code: "invalid_api_key"
    });
  });
});
