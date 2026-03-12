import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { ScheduledHandler } from "aws-lambda";
import { HttpFlyMachinesClient } from "../control-plane/adapters/fly-machines-client.js";
import { AwsSecretsProvider } from "../control-plane/adapters/secrets-provider.js";
import { loadControlPlaneConfig } from "../control-plane/config.js";
import { DynamoSessionRepository } from "../control-plane/repositories/dynamo-session-repository.js";
import { SessionService } from "../control-plane/services/session-service.js";
import { SessionTokenService } from "../control-plane/services/token-service.js";

export const handler: ScheduledHandler = async () => {
  const config = loadControlPlaneConfig();
  const ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: config.region }));
  const secretsProvider = new AwsSecretsProvider(new SecretsManagerClient({ region: config.region }));
  const flyApiToken = await secretsProvider.getSecret(config.flyApiTokenSecretId);
  const runnerSharedSecret = await secretsProvider.getSecret(config.runnerSharedSecretId);
  const tokenSecret = await secretsProvider.getSecret(config.sessionTokenSecretId);

  const sessionService = new SessionService(
    new DynamoSessionRepository(ddbClient, config.sessionsTableName),
    new HttpFlyMachinesClient(),
    config,
    flyApiToken,
    runnerSharedSecret,
    new SessionTokenService(tokenSecret)
  );

  await sessionService.cleanupExpiredSessions();
};
