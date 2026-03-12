import { describe, expect, test } from "vitest";
import { HttpError } from "../src/common/errors.js";
import type { ControlPlaneConfig } from "../src/control-plane/config.js";
import { SessionService } from "../src/control-plane/services/session-service.js";
import { SessionTokenService } from "../src/control-plane/services/token-service.js";
import { FakeFlyMachinesClient, InMemorySessionRepository } from "./helpers.js";

function testConfig(): ControlPlaneConfig {
  return {
    apiKeysTableName: "api-keys",
    sessionsTableName: "sessions",
    flyAppName: "blip-runner",
    flyAppBaseUrl: "https://blip-runner.fly.dev",
    flyMachineImage: "registry.fly.io/blip-runner:latest",
    flyApiTokenSecretId: "fly",
    runnerSharedSecretId: "runner",
    sessionTokenSecretId: "session",
    clerkSecretKeySecretId: "clerk-secret",
    usersTableName: undefined,
    stripeSecretKeySecretId: undefined,
    stripeWebhookSecretId: undefined,
    stripeStarterPriceId: undefined,
    stripeProPriceId: undefined,
    region: "us-west-2",
    sessionIdleTimeoutMs: 15 * 60 * 1000,
    sessionHardTimeoutMs: 2 * 60 * 60 * 1000,
    bootstrapTokenTtlMs: 10 * 60 * 1000,
    streamTokenTtlMs: 15 * 60 * 1000,
    runnerWorkspaceRoot: "/workspace",
    runnerPort: 8080,
    flyMachineMemoryMb: 1024,
    flyMachineCpus: 1
  };
}

describe("SessionService", () => {
  test("creates a session and blocks a second active session for the same user", async () => {
    const sessions = new InMemorySessionRepository();
    const fly = new FakeFlyMachinesClient();
    const service = new SessionService(
      sessions,
      fly,
      testConfig(),
      "fly-token",
      "runner-shared",
      new SessionTokenService("session-secret")
    );

    const actor = { userId: "user-1", apiKeyId: "key-1", rawKey: "raw" };

    const created = await service.createSession(actor, {
      model: "claude-sonnet-4-6",
      effort: "medium",
      agent_options: {}
    });

    expect(created.session_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u
    );
    expect(created.bootstrap_url).toContain("/bootstrap?token=");
    expect(created.events_url).toContain("/events?token=");
    expect(fly.createdMachines).toHaveLength(1);

    await expect(
      service.createSession(actor, {
        model: "claude-sonnet-4-6",
        effort: "high",
        agent_options: {}
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "active_session_exists"
    });
  });

  test("sends a message, updates status, and issues fresh stream tokens", async () => {
    const sessions = new InMemorySessionRepository();
    const fly = new FakeFlyMachinesClient();
    const service = new SessionService(
      sessions,
      fly,
      testConfig(),
      "fly-token",
      "runner-shared",
      new SessionTokenService("session-secret")
    );

    const actor = { userId: "user-1", apiKeyId: "key-1", rawKey: "raw" };
    const created = await service.createSession(actor, {
      model: "claude-sonnet-4-6",
      effort: "medium",
      agent_options: {}
    });

    const record = await sessions.getById(created.session_id);
    const machineId = record!.machineId;
    fly.machineState.set(machineId, {
      heartbeat: {
        session_id: created.session_id,
        bootstrapped: true,
        has_conversation: true,
        busy: false,
        last_activity_at: new Date().toISOString()
      },
      messageResponse: new Response(
        JSON.stringify({
          session_id: created.session_id,
          status: "active",
          result: "hello",
          stop_reason: null,
          total_cost_usd: 0.01,
          num_turns: 1
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" }
        }
      )
    });

    const message = await service.sendMessage(actor, created.session_id, "hi");
    expect(message.result).toBe("hello");

    const session = await service.getSession(actor, created.session_id);
    expect(session.status).toBe("active");
    expect(session.bootstrapped).toBe(true);

    const streamToken = await service.issueStreamToken(actor, created.session_id);
    expect(streamToken.events_url).toContain("/events?token=");
  });

  test("destroys expired sessions during cleanup", async () => {
    const sessions = new InMemorySessionRepository();
    const fly = new FakeFlyMachinesClient();
    const service = new SessionService(
      sessions,
      fly,
      testConfig(),
      "fly-token",
      "runner-shared",
      new SessionTokenService("session-secret")
    );

    const actor = { userId: "user-1", apiKeyId: "key-1", rawKey: "raw" };
    const created = await service.createSession(actor, {
      model: "claude-sonnet-4-6",
      effort: "medium",
      agent_options: {}
    });

    const record = (await sessions.getById(created.session_id))!;
    await sessions.save({
      ...record,
      idleExpiresAt: new Date(Date.now() - 60_000).toISOString()
    });

    await service.cleanupExpiredSessions();

    expect(await sessions.getById(created.session_id)).toBeNull();
    expect(fly.destroyedMachineIds).toContain(record.machineId);
  });
});
