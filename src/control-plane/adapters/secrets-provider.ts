import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

export interface SecretsProvider {
  getSecret(secretId: string): Promise<string>;
}

export class AwsSecretsProvider implements SecretsProvider {
  private readonly cache = new Map<string, string>();

  public constructor(private readonly client: SecretsManagerClient) {}

  public async getSecret(secretId: string): Promise<string> {
    const cached = this.cache.get(secretId);
    if (cached) {
      return cached;
    }

    const response = await this.client.send(
      new GetSecretValueCommand({
        SecretId: secretId
      })
    );

    if (!response.SecretString) {
      throw new Error(`Secret ${secretId} is missing SecretString.`);
    }

    this.cache.set(secretId, response.SecretString);
    return response.SecretString;
  }
}
