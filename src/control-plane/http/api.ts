import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import {
  createApiKeyRequestSchema,
  createSessionRequestSchema,
  isActiveSessionStatus,
  sendMessageRequestSchema
} from "../../common/contracts.js";
import { HttpError } from "../../common/errors.js";
import { safeJsonParse } from "../../common/json.js";
import { ApiKeyService } from "../services/api-key-service.js";
import { SessionService } from "../services/session-service.js";
import type { BillingService } from "../services/billing-service.js";
import type { UserTokenVerifier } from "../auth/user-auth.js";
import type { SessionRepository } from "../repositories/interfaces.js";
import { errorResponse, jsonResponse, noContentResponse, requireBody } from "./response.js";

type ApiDependencies = {
  apiKeyService: ApiKeyService;
  sessionService: SessionService;
  sessionRepository: SessionRepository;
  userVerifier: UserTokenVerifier;
  billingService: BillingService | null;
};

function header(event: APIGatewayProxyEventV2, name: string): string | undefined {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(event.headers ?? {})) {
    if (key.toLowerCase() === target) {
      return value;
    }
  }
  return undefined;
}

function bearerToken(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const match = /^Bearer\s+(.+)$/iu.exec(value.trim());
  return match?.[1] ?? null;
}

function rawApiKey(event: APIGatewayProxyEventV2): string {
  const xApiKey = header(event, "x-api-key");
  if (xApiKey) {
    return xApiKey;
  }

  const bearer = bearerToken(header(event, "authorization"));
  if (!bearer) {
    throw new HttpError(401, "missing_api_key", "Service API key is required.");
  }

  return bearer;
}

async function requireUser(event: APIGatewayProxyEventV2, verifier: UserTokenVerifier) {
  const token = bearerToken(header(event, "authorization"));
  if (!token) {
    throw new HttpError(401, "missing_user_token", "User access token is required.");
  }

  return verifier.verify(token);
}

function requireBilling(billing: BillingService | null): BillingService {
  if (!billing) {
    throw new HttpError(503, "billing_not_configured", "Billing is not configured on this deployment.");
  }
  return billing;
}

function pathMatch(path: string, expression: RegExp): RegExpExecArray | null {
  return expression.exec(path);
}

export function createApiHandler(dependencies: ApiDependencies) {
  return async function handle(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
    try {
      const method = event.requestContext.http.method;
      const path = event.rawPath;

      if (method === "OPTIONS") {
        return { statusCode: 204, body: "" };
      }

      // ── API Keys (user auth) ──

      if (method === "POST" && path === "/v1/api-keys") {
        const user = await requireUser(event, dependencies.userVerifier);
        const body = createApiKeyRequestSchema.parse(safeJsonParse(requireBody(event.body)) ?? {});
        const result = await dependencies.apiKeyService.createKey(user.userId, body.name);
        return jsonResponse(201, {
          ...result.metadata,
          api_key: result.apiKey
        });
      }

      if (method === "GET" && path === "/v1/api-keys") {
        const user = await requireUser(event, dependencies.userVerifier);
        const keys = await dependencies.apiKeyService.listKeys(user.userId);
        return jsonResponse(200, { items: keys });
      }

      const apiKeyDeleteMatch = pathMatch(path, /^\/v1\/api-keys\/([^/]+)$/u);
      if (method === "DELETE" && apiKeyDeleteMatch) {
        const user = await requireUser(event, dependencies.userVerifier);
        await dependencies.apiKeyService.revokeKey(user.userId, apiKeyDeleteMatch[1]!);
        return noContentResponse();
      }

      // ── Usage (Cognito auth) ──

      if (method === "GET" && path === "/v1/usage") {
        const user = await requireUser(event, dependencies.userVerifier);
        const [keys, sessions] = await Promise.all([
          dependencies.apiKeyService.listKeys(user.userId),
          dependencies.sessionRepository.listByUser(user.userId)
        ]);
        return jsonResponse(200, {
          total_sessions: sessions.length,
          active_sessions: sessions.filter((s) => isActiveSessionStatus(s.status)).length,
          api_key_count: keys.filter((k) => !k.revoked_at).length
        });
      }

      // ── Billing (Cognito auth) ──

      if (method === "POST" && path === "/v1/billing/setup") {
        const billing = requireBilling(dependencies.billingService);
        const user = await requireUser(event, dependencies.userVerifier);
        const body = JSON.parse(requireBody(event.body));
        const result = await billing.createSetupSession(
          user.userId,
          body.email,
          body.success_url,
          body.cancel_url
        );
        return jsonResponse(200, result);
      }

      if (method === "POST" && path === "/v1/billing/portal") {
        const billing = requireBilling(dependencies.billingService);
        const user = await requireUser(event, dependencies.userVerifier);
        const body = JSON.parse(requireBody(event.body));
        const result = await billing.createPortalSession(user.userId, body.return_url);
        return jsonResponse(200, result);
      }

      if (method === "GET" && path === "/v1/billing/status") {
        const billing = requireBilling(dependencies.billingService);
        const user = await requireUser(event, dependencies.userVerifier);
        const result = await billing.getStatus(user.userId);
        return jsonResponse(200, result);
      }

      // ── Stripe Webhook (signature auth) ──

      if (method === "POST" && path === "/v1/webhooks/stripe") {
        const billing = requireBilling(dependencies.billingService);
        const signature = header(event, "stripe-signature");
        if (!signature) {
          throw new HttpError(400, "missing_signature", "Stripe signature header is required.");
        }
        const rawBody = event.isBase64Encoded
          ? Buffer.from(event.body ?? "", "base64").toString("utf-8")
          : event.body ?? "";
        await billing.handleWebhook(rawBody, signature);
        return jsonResponse(200, { received: true });
      }

      // ── Sessions (API key auth) ──

      if (method === "POST" && path === "/v1/sessions") {
        const actor = await dependencies.apiKeyService.authenticate(rawApiKey(event));
        const body = createSessionRequestSchema.parse(JSON.parse(requireBody(event.body)));
        const result = await dependencies.sessionService.createSession(actor, body);
        return jsonResponse(201, result);
      }

      const sessionIdMatch = pathMatch(path, /^\/v1\/sessions\/([^/]+)$/u);
      if (method === "GET" && sessionIdMatch) {
        const actor = await dependencies.apiKeyService.authenticate(rawApiKey(event));
        const result = await dependencies.sessionService.getSession(actor, sessionIdMatch[1]!);
        return jsonResponse(200, result);
      }

      if (method === "DELETE" && sessionIdMatch) {
        const actor = await dependencies.apiKeyService.authenticate(rawApiKey(event));
        await dependencies.sessionService.deleteSession(actor, sessionIdMatch[1]!);
        return noContentResponse();
      }

      const messageMatch = pathMatch(path, /^\/v1\/sessions\/([^/]+)\/messages$/u);
      if (method === "POST" && messageMatch) {
        const actor = await dependencies.apiKeyService.authenticate(rawApiKey(event));
        const body = sendMessageRequestSchema.parse(JSON.parse(requireBody(event.body)));
        const result = await dependencies.sessionService.sendMessage(actor, messageMatch[1]!, body.prompt);
        return jsonResponse(200, result);
      }

      const streamTokenMatch = pathMatch(path, /^\/v1\/sessions\/([^/]+)\/stream-token$/u);
      if (method === "POST" && streamTokenMatch) {
        const actor = await dependencies.apiKeyService.authenticate(rawApiKey(event));
        const result = await dependencies.sessionService.issueStreamToken(actor, streamTokenMatch[1]!);
        return jsonResponse(200, result);
      }

      throw new HttpError(404, "not_found", "Route was not found.");
    } catch (error) {
      return errorResponse(error);
    }
  };
}
