import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { ServiceApiKeyRecord } from "../../common/types.js";
import type { ApiKeyRepository } from "./interfaces.js";

export class DynamoApiKeyRepository implements ApiKeyRepository {
  public constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  public async create(record: ServiceApiKeyRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: record,
        ConditionExpression: "attribute_not_exists(keyId)"
      })
    );
  }

  public async getById(keyId: string): Promise<ServiceApiKeyRecord | null> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { keyId }
      })
    );

    return (response.Item as ServiceApiKeyRecord | undefined) ?? null;
  }

  public async listByUser(userId: string): Promise<ServiceApiKeyRecord[]> {
    const response = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "userId-index",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId
        }
      })
    );

    return (response.Items as ServiceApiKeyRecord[] | undefined) ?? [];
  }

  public async revoke(keyId: string, revokedAt: string): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { keyId },
        UpdateExpression: "SET revokedAt = :revokedAt",
        ExpressionAttributeValues: {
          ":revokedAt": revokedAt
        }
      })
    );
  }
}
