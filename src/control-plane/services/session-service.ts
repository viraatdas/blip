import { randomUUID } from "node:crypto";
import {
  createSessionResponseSchema,
  effortBudgetTokens,
  getSessionResponseSchema,
  isActiveSessionStatus,
  sendMessageResponseSchema,
  streamTokenResponseSchema
} from "../../common/contracts.js";
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  GetSessionResponse,
  RunnerHeartbeatResponse,
  SendMessageResponse,
  SessionConfig,
  StreamTokenResponse
} from "../../common/contracts.js";
import { HttpError } from "../../common/errors.js";
import { safeJsonParse, stringifyError } from "../../common/json.js";
import { sha256Hex } from "../../common/crypto.js";
import type { AuthenticatedApiKey, SessionRecord } from "../../common/types.js";
import type { ControlPlaneConfig } from "../config.js";
import type { FlyMachinesClient } from "../adapters/fly-machines-client.js";
import type { SessionRepository } from "../repositories/interfaces.js";
import { SessionTokenService } from "./token-service.js";

type SessionStatusProbe = {
  status: SessionRecord["status"];
  bootstrapped: boolean;
  busy: boolean;
  lastActivityAt: string;
};

export class SessionService {
  public constructor(
    private readonly repository: SessionRepository,
    private readonly flyMachinesClient: FlyMachinesClient,
    private readonly config: ControlPlaneConfig,
    private readonly flyApiToken: string,
    private readonly runnerSharedSecret: string,
    private readonly tokenService: SessionTokenService
  ) {}

  public async createSession(
    actor: AuthenticatedApiKey,
    request: CreateSessionRequest
  ): Promise<CreateSessionResponse> {
    const existingSessions = await this.repository.listByUser(actor.userId);
    const now = new Date();

    for (const existing of existingSessions) {
      if (!isActiveSessionStatus(existing.status)) {
        continue;
      }

      if (new Date(existing.hardExpiresAt).getTime() <= now.getTime()) {
        await this.destroySessionRecord(existing);
        continue;
      }

      if (new Date(existing.idleExpiresAt).getTime() <= now.getTime()) {
        await this.destroySessionRecord(existing);
        continue;
      }

      throw new HttpError(
        409,
        "active_session_exists",
        "Only one active session is allowed per user in v1."
      );
    }

    const sessionId = randomUUID();
    const createdAt = now.toISOString();
    const idleExpiresAt = new Date(now.getTime() + this.config.sessionIdleTimeoutMs).toISOString();
    const hardExpiresAt = new Date(now.getTime() + this.config.sessionHardTimeoutMs).toISOString();

    const sessionConfig: SessionConfig = {
      sessionId,
      model: request.model,
      effort: request.effort,
      agentOptions: request.agent_options,
      workspaceDir: `${this.config.runnerWorkspaceRoot}/${sessionId}`
    };

    const machine = await this.flyMachinesClient.createMachine(
      {
        appName: this.config.flyAppName,
        image: this.config.flyMachineImage,
        internalPort: this.config.runnerPort,
        memoryMb: this.config.flyMachineMemoryMb,
        cpus: this.config.flyMachineCpus,
        env: {
          PORT: String(this.config.runnerPort),
          BLIP_SESSION_CONFIG_B64: Buffer.from(JSON.stringify(sessionConfig), "utf8").toString("base64"),
          BLIP_RUNNER_SHARED_SECRET: this.runnerSharedSecret,
          BLIP_SESSION_TOKEN_SECRET: this.tokenService.secret
        }
      },
      this.flyApiToken
    );

    const record: SessionRecord = {
      sessionId,
      userId: actor.userId,
      apiKeyId: actor.apiKeyId,
      machineId: machine.id,
      status: "awaiting_bootstrap",
      model: request.model,
      effort: request.effort,
      agentOptions: request.agent_options,
      configDigest: sha256Hex(JSON.stringify({ model: request.model, effort: request.effort, agent_options: request.agent_options })),
      createdAt,
      lastActivityAt: createdAt,
      idleExpiresAt,
      hardExpiresAt,
      inFlightTurn: false
    };

    try {
      await this.repository.create(record);
    } catch (error) {
      await this.flyMachinesClient.destroyMachine(this.config.flyAppName, machine.id, this.flyApiToken);
      throw error;
    }

    const bootstrapToken = this.tokenService.mintToken(
      "bootstrap",
      record.sessionId,
      record.machineId,
      this.config.bootstrapTokenTtlMs
    );
    const streamToken = this.tokenService.mintToken(
      "events",
      record.sessionId,
      record.machineId,
      this.config.streamTokenTtlMs
    );

    return createSessionResponseSchema.parse({
      session_id: record.sessionId,
      status: record.status,
      model: record.model,
      effort: record.effort,
      created_at: record.createdAt,
      idle_expires_at: record.idleExpiresAt,
      hard_expires_at: record.hardExpiresAt,
      bootstrap_url: new URL(`/bootstrap?token=${encodeURIComponent(bootstrapToken.token)}`, this.config.flyAppBaseUrl).toString(),
      events_url: new URL(`/events?token=${encodeURIComponent(streamToken.token)}`, this.config.flyAppBaseUrl).toString()
    });
  }

  public async getSession(actor: AuthenticatedApiKey, sessionId: string): Promise<GetSessionResponse> {
    const record = await this.requireOwnedSession(actor, sessionId);
    const probe = await this.probeSession(record);
    const updatedRecord = await this.updateSessionState(record, probe);

    return getSessionResponseSchema.parse({
      session_id: updatedRecord.sessionId,
      status: updatedRecord.status,
      model: updatedRecord.model,
      effort: updatedRecord.effort,
      created_at: updatedRecord.createdAt,
      last_activity_at: updatedRecord.lastActivityAt,
      idle_expires_at: updatedRecord.idleExpiresAt,
      hard_expires_at: updatedRecord.hardExpiresAt,
      bootstrapped: probe.bootstrapped,
      busy: probe.busy
    });
  }

  public async issueStreamToken(actor: AuthenticatedApiKey, sessionId: string): Promise<StreamTokenResponse> {
    const record = await this.requireOwnedSession(actor, sessionId);
    const token = this.tokenService.mintToken(
      "events",
      record.sessionId,
      record.machineId,
      this.config.streamTokenTtlMs
    );

    return streamTokenResponseSchema.parse({
      session_id: record.sessionId,
      events_url: new URL(`/events?token=${encodeURIComponent(token.token)}`, this.config.flyAppBaseUrl).toString(),
      expires_at: token.expiresAt
    });
  }

  public async sendMessage(
    actor: AuthenticatedApiKey,
    sessionId: string,
    prompt: string
  ): Promise<SendMessageResponse> {
    const record = await this.requireOwnedSession(actor, sessionId);
    const lockAcquired = await this.repository.acquireTurnLock(record.sessionId);
    if (!lockAcquired) {
      throw new HttpError(409, "session_busy", "A turn is already running for this session.");
    }

    let destroyed = false;
    try {
      const response = await this.flyMachinesClient.requestMachine(this.config.flyAppBaseUrl, record.machineId, "/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-runner-secret": this.runnerSharedSecret
        },
        body: JSON.stringify({ prompt })
      });

      if (response.status === 409) {
        throw new HttpError(409, "runner_rejected_message", await response.text());
      }

      if (!response.ok) {
        const details = await response.text();
        throw new HttpError(
          502,
          "runner_message_failed",
          `Fly session returned ${response.status}.`,
          details
        );
      }

      const body = (await response.json()) as SendMessageResponse;
      const now = new Date();
      record.status = "active";
      record.lastActivityAt = now.toISOString();
      record.idleExpiresAt = new Date(now.getTime() + this.config.sessionIdleTimeoutMs).toISOString();
      record.inFlightTurn = false;
      await this.repository.save(record);

      return sendMessageResponseSchema.parse(body);
    } catch (error) {
      const isRuntimeFailure =
        error instanceof HttpError &&
        error.code === "runner_message_failed";

      if (isRuntimeFailure) {
        await this.failAndDestroySession(record, error);
        destroyed = true;
      } else {
        record.inFlightTurn = false;
        await this.repository.save(record);
      }

      throw error;
    } finally {
      if (!destroyed) {
        await this.repository.releaseTurnLock(record.sessionId);
      }
    }
  }

  public async deleteSession(actor: AuthenticatedApiKey, sessionId: string): Promise<void> {
    const record = await this.requireOwnedSession(actor, sessionId);
    await this.destroySessionRecord(record);
  }

  public async cleanupExpiredSessions(): Promise<void> {
    const sessions = await this.repository.listAll();
    const now = Date.now();

    for (const session of sessions) {
      if (!isActiveSessionStatus(session.status)) {
        continue;
      }

      const idleExpired = new Date(session.idleExpiresAt).getTime() <= now;
      const hardExpired = new Date(session.hardExpiresAt).getTime() <= now;
      if (idleExpired || hardExpired) {
        await this.destroySessionRecord({
          ...session,
          status: "expired"
        });
      }
    }
  }

  private async requireOwnedSession(actor: AuthenticatedApiKey, sessionId: string): Promise<SessionRecord> {
    const record = await this.repository.getById(sessionId);
    if (!record || record.userId !== actor.userId) {
      throw new HttpError(404, "session_not_found", "Session was not found.");
    }

    return record;
  }

  private async probeSession(record: SessionRecord): Promise<SessionStatusProbe> {
    try {
      const response = await this.flyMachinesClient.requestMachine(
        this.config.flyAppBaseUrl,
        record.machineId,
        "/heartbeat",
        {
          headers: {
            "x-runner-secret": this.runnerSharedSecret
          }
        }
      );

      if (!response.ok) {
        return {
          status: record.status,
          bootstrapped: false,
          busy: false,
          lastActivityAt: record.lastActivityAt
        };
      }

      const heartbeat = (await response.json()) as RunnerHeartbeatResponse;
      if (!heartbeat.bootstrapped) {
        return {
          status: "awaiting_bootstrap",
          bootstrapped: false,
          busy: heartbeat.busy,
          lastActivityAt: heartbeat.last_activity_at
        };
      }

      return {
        status: heartbeat.has_conversation || heartbeat.busy ? "active" : "ready",
        bootstrapped: heartbeat.bootstrapped,
        busy: heartbeat.busy,
        lastActivityAt: heartbeat.last_activity_at
      };
    } catch {
      return {
        status: record.status,
        bootstrapped: false,
        busy: false,
        lastActivityAt: record.lastActivityAt
      };
    }
  }

  private async updateSessionState(record: SessionRecord, probe: SessionStatusProbe): Promise<SessionRecord> {
    const now = new Date();
    const next = {
      ...record,
      status: probe.status,
      lastActivityAt: probe.lastActivityAt,
      idleExpiresAt: new Date(now.getTime() + this.config.sessionIdleTimeoutMs).toISOString()
    };

    await this.repository.save(next);
    return next;
  }

  private async destroySessionRecord(record: SessionRecord): Promise<void> {
    try {
      await this.flyMachinesClient.destroyMachine(this.config.flyAppName, record.machineId, this.flyApiToken);
    } finally {
      await this.repository.delete(record.sessionId);
    }
  }

  private async failAndDestroySession(record: SessionRecord, error: unknown): Promise<void> {
    const failed: SessionRecord = {
      ...record,
      status: "failed",
      lastActivityAt: new Date().toISOString()
    };

    try {
      await this.repository.save(failed);
    } finally {
      await this.destroySessionRecord(failed).catch(() => {
        console.error(
          JSON.stringify({
            level: "error",
            message: "Failed to destroy Fly machine after runtime failure.",
            sessionId: failed.sessionId,
            machineId: failed.machineId,
            error: stringifyError(error)
          })
        );
      });
    }
  }
}
