import { mkdir } from "node:fs/promises";
import { query, type Options, type SDKMessage, type SDKResultError, type SDKResultSuccess } from "@anthropic-ai/claude-agent-sdk";
import express, { type Request, type Response } from "express";
import {
  STREAM_HEARTBEAT_MS
} from "../common/constants.js";
import {
  effortBudgetTokens,
  runnerBootstrapRequestSchema,
  runnerHeartbeatResponseSchema,
  runnerMessageRequestSchema,
  sendMessageResponseSchema,
  sessionConfigSchema
} from "../common/contracts.js";
import type { SessionConfig } from "../common/contracts.js";
import { verifyToken } from "../common/crypto.js";
import { HttpError } from "../common/errors.js";

type SseClient = {
  response: Response;
  timer: NodeJS.Timeout;
};

type RunnerState = {
  bootstrapped: boolean;
  hasConversation: boolean;
  busy: boolean;
  lastActivityAt: string;
};

function sendError(response: Response, error: unknown): void {
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      details: error.details
    });
    return;
  }

  response.status(500).json({
    error: "internal_error",
    message: error instanceof Error ? error.message : "Unexpected runner error."
  });
}

class FlySessionRunner {
  private readonly sseClients = new Set<SseClient>();
  private readonly usedBootstrapNonces = new Set<string>();
  private anthropicApiKey?: string;
  private hasConversation = false;
  private busy = false;
  private lastActivityAt = new Date().toISOString();

  public constructor(
    private readonly config: SessionConfig,
    private readonly sharedSecret: string,
    private readonly tokenSecret: string
  ) {}

  public async initialize(): Promise<void> {
    await mkdir(this.config.workspaceDir, { recursive: true });
  }

  public state(): RunnerState {
    return {
      bootstrapped: Boolean(this.anthropicApiKey),
      hasConversation: this.hasConversation,
      busy: this.busy,
      lastActivityAt: this.lastActivityAt
    };
  }

  public authorizeInternalRequest(request: Request): void {
    if (request.header("x-runner-secret") !== this.sharedSecret) {
      throw new HttpError(401, "invalid_runner_secret", "Runner secret is invalid.");
    }
  }

  public authorizeSignedRequest(request: Request, scope: "bootstrap" | "events", response: Response): void {
    const token = request.query.token;
    if (typeof token !== "string") {
      throw new HttpError(401, "missing_token", "Signed session token is required.");
    }

    const payload = verifyToken(token, this.tokenSecret);
    if (payload.scope !== scope) {
      throw new HttpError(401, "invalid_token_scope", "Signed token scope is invalid.");
    }
    if (payload.session_id !== this.config.sessionId) {
      throw new HttpError(401, "invalid_token_session", "Signed token session is invalid.");
    }

    const currentMachineId = process.env.FLY_MACHINE_ID;
    if (currentMachineId && payload.machine_id !== currentMachineId) {
      response.setHeader("fly-replay", `instance=${payload.machine_id}`);
      throw new HttpError(409, "replay_required", "Request must be replayed to the owning machine.");
    }

    if (scope === "bootstrap") {
      if (this.usedBootstrapNonces.has(payload.nonce)) {
        throw new HttpError(401, "bootstrap_token_replayed", "Bootstrap token was already used.");
      }
      this.usedBootstrapNonces.add(payload.nonce);
    }
  }

  public async bootstrap(apiKey: string): Promise<void> {
    if (this.anthropicApiKey) {
      throw new HttpError(409, "already_bootstrapped", "Session already has a Claude API key.");
    }

    this.anthropicApiKey = apiKey;
    this.touch();
  }

  public attachEvents(response: Response): void {
    response.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    });

    response.write(`event: ready\ndata: ${JSON.stringify({ session_id: this.config.sessionId })}\n\n`);
    const timer = setInterval(() => {
      response.write(`event: heartbeat\ndata: {}\n\n`);
    }, STREAM_HEARTBEAT_MS);

    const client: SseClient = { response, timer };
    this.sseClients.add(client);
    response.on("close", () => {
      clearInterval(timer);
      this.sseClients.delete(client);
    });
  }

  public async processMessage(prompt: string): Promise<ReturnType<typeof sendMessageResponseSchema.parse>> {
    if (!this.anthropicApiKey) {
      throw new HttpError(409, "not_bootstrapped", "Session requires Claude API key bootstrap before messaging.");
    }

    if (this.busy) {
      throw new HttpError(409, "session_busy", "Session is already processing a turn.");
    }

    this.busy = true;
    this.touch();

    try {
      const options: Options = {
        ...(this.config.agentOptions as Options),
        cwd: this.config.workspaceDir,
        persistSession: true,
        includePartialMessages: true,
        settingSources: [],
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: this.anthropicApiKey,
          CLAUDE_AGENT_SDK_CLIENT_APP: "blip/0.1.0"
        },
        effort: this.config.effort,
        thinking: {
          type: "enabled",
          budgetTokens: effortBudgetTokens(this.config.effort)
        },
        sessionId: this.hasConversation ? undefined : this.config.sessionId,
        resume: this.hasConversation ? this.config.sessionId : undefined
      };

      const stream = query({
        prompt,
        options
      });

      let finalResult: SDKResultSuccess | SDKResultError | undefined;
      for await (const message of stream) {
        this.touch();
        this.broadcast("sdk-message", message);
        if (message.type === "result") {
          finalResult = message;
        }
      }

      this.hasConversation = true;

      if (!finalResult) {
        throw new HttpError(500, "missing_result", "Agent SDK finished without emitting a result.");
      }

      if (finalResult.subtype !== "success") {
        throw new HttpError(500, "agent_execution_failed", "Claude Agent SDK reported a failed execution.", {
          subtype: finalResult.subtype,
          errors: finalResult.errors
        });
      }

      const response = sendMessageResponseSchema.parse({
        session_id: this.config.sessionId,
        status: "active",
        result: finalResult.result,
        stop_reason: finalResult.stop_reason,
        total_cost_usd: finalResult.total_cost_usd,
        num_turns: finalResult.num_turns,
        structured_output: finalResult.structured_output
      });

      this.broadcast("result", response);
      return response;
    } finally {
      this.busy = false;
      this.touch();
    }
  }

  private touch(): void {
    this.lastActivityAt = new Date().toISOString();
  }

  private broadcast(eventName: string, payload: unknown): void {
    const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.sseClients) {
      client.response.write(frame);
    }
  }
}

export async function createRunnerApp(): Promise<express.Express> {
  const encodedConfig = process.env.BLIP_SESSION_CONFIG_B64;
  const sharedSecret = process.env.BLIP_RUNNER_SHARED_SECRET;
  const tokenSecret = process.env.BLIP_SESSION_TOKEN_SECRET;

  if (!encodedConfig || !sharedSecret || !tokenSecret) {
    throw new Error("Runner is missing required environment variables.");
  }

  const config = sessionConfigSchema.parse(
    JSON.parse(Buffer.from(encodedConfig, "base64").toString("utf8"))
  );

  const runner = new FlySessionRunner(config, sharedSecret, tokenSecret);
  await runner.initialize();

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.status(200).json({ ok: true, session_id: config.sessionId });
  });

  app.post("/bootstrap", async (request, response) => {
    try {
      runner.authorizeSignedRequest(request, "bootstrap", response);
      const body = runnerBootstrapRequestSchema.parse(request.body);
      await runner.bootstrap(body.api_key);
      response.status(204).end();
    } catch (error) {
      sendError(response, error);
    }
  });

  app.get("/events", (request, response) => {
    try {
      runner.authorizeSignedRequest(request, "events", response);
      runner.attachEvents(response);
    } catch (error) {
      sendError(response, error);
    }
  });

  app.get("/heartbeat", (request, response) => {
    try {
      runner.authorizeInternalRequest(request);
      response.status(200).json(
        runnerHeartbeatResponseSchema.parse({
          session_id: config.sessionId,
          ...runner.state()
        })
      );
    } catch (error) {
      sendError(response, error);
    }
  });

  app.post("/messages", async (request, response) => {
    try {
      runner.authorizeInternalRequest(request);
      const body = runnerMessageRequestSchema.parse(request.body);
      const result = await runner.processMessage(body.prompt);
      response.status(200).json(result);
    } catch (error) {
      sendError(response, error);
    }
  });

  return app;
}
