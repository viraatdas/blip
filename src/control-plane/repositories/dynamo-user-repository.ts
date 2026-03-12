import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { UserRecord } from "../../common/types.js";
import type { UserRepository } from "./interfaces.js";

export class DynamoUserRepository implements UserRepository {
  private readonly client: DynamoDBDocumentClient;
  private readonly tableName: string;

  public constructor(client: DynamoDBDocumentClient, tableName: string) {
    this.client = client;
    this.tableName = tableName;
  }

  public async create(record: UserRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: record,
        ConditionExpression: "attribute_not_exists(userId)"
      })
    );
  }

  public async getById(userId: string): Promise<UserRecord | null> {
    const result = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { userId }
      })
    );
    return (result.Item as UserRecord) ?? null;
  }

  public async getByStripeCustomerId(customerId: string): Promise<UserRecord | null> {
    const result = await this.client.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: "stripeCustomerId-index",
        KeyConditionExpression: "stripeCustomerId = :cid",
        ExpressionAttributeValues: { ":cid": customerId },
        Limit: 1
      })
    );
    return (result.Items?.[0] as UserRecord) ?? null;
  }

  public async save(record: UserRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: record
      })
    );
  }
}
