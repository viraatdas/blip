import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyHandlerV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { HttpFlyMachinesClient } from "../control-plane/adapters/fly-machines-client.js";
import { AwsSecretsProvider } from "../control-plane/adapters/secrets-provider.js";
import { ClerkUserTokenVerifier } from "../control-plane/auth/user-auth.js";
import { loadControlPlaneConfig } from "../control-plane/config.js";
import { createApiHandler } from "../control-plane/http/api.js";
import { DynamoApiKeyRepository } from "../control-plane/repositories/dynamo-api-key-repository.js";
import { DynamoSessionRepository } from "../control-plane/repositories/dynamo-session-repository.js";
import { DynamoUserRepository } from "../control-plane/repositories/dynamo-user-repository.js";
import { ApiKeyService } from "../control-plane/services/api-key-service.js";
import { BillingService } from "../control-plane/services/billing-service.js";
import { SessionService } from "../control-plane/services/session-service.js";
import { SessionTokenService } from "../control-plane/services/token-service.js";

type LambdaHttpHandler = () => Promise<(event: Parameters<APIGatewayProxyHandlerV2>[0]) => Promise<APIGatewayProxyStructuredResultV2>>;

let cachedHandler:
  | ((event: Parameters<APIGatewayProxyHandlerV2>[0]) => Promise<APIGatewayProxyStructuredResultV2>)
  | undefined;

async function buildHandler(): ReturnType<LambdaHttpHandler> {
  const config = loadControlPlaneConfig();
  const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }));
  const secretsProvider = new AwsSecretsProvider(new SecretsManagerClient({ region: config.region }));
  const flyApiToken = await secretsProvider.getSecret(config.flyApiTokenSecretId);
  const runnerSharedSecret = await secretsProvider.getSecret(config.runnerSharedSecretId);
  const tokenSecret = await secretsProvider.getSecret(config.sessionTokenSecretId);
  const clerkSecretKey = await secretsProvider.getSecret(config.clerkSecretKeySecretId);

  const apiKeyRepository = new DynamoApiKeyRepository(ddbClient, config.apiKeysTableName);
  const sessionRepository = new DynamoSessionRepository(ddbClient, config.sessionsTableName);

  const apiKeyService = new ApiKeyService(apiKeyRepository);
  const tokenService = new SessionTokenService(tokenSecret);
  const sessionService = new SessionService(
    sessionRepository,
    new HttpFlyMachinesClient(),
    config,
    flyApiToken,
    runnerSharedSecret,
    tokenService
  );
  const userVerifier = new ClerkUserTokenVerifier(clerkSecretKey);

  let billingService: BillingService | null = null;
  if (config.stripeSecretKeySecretId && config.stripeWebhookSecretId && config.usersTableName) {
    const stripeSecretKey = await secretsProvider.getSecret(config.stripeSecretKeySecretId);
    const stripeWebhookSecret = await secretsProvider.getSecret(config.stripeWebhookSecretId);
    const userRepository = new DynamoUserRepository(ddbClient, config.usersTableName);
    billingService = new BillingService(stripeSecretKey, stripeWebhookSecret, userRepository);
  }

  return createApiHandler({
    apiKeyService,
    sessionService,
    sessionRepository,
    userVerifier,
    billingService
  });
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  if (!cachedHandler) {
    cachedHandler = await buildHandler();
  }

  return cachedHandler(event);
};
