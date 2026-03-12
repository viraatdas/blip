import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, GetCommand, PutCommand, ScanCommand, UpdateCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { SessionRecord } from "../../common/types.js";
import type { SessionRepository } from "./interfaces.js";

export class DynamoSessionRepository implements SessionRepository {
  public constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  public async create(record: SessionRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: record,
        ConditionExpression: "attribute_not_exists(sessionId)"
      })
    );
  }

  public async getById(sessionId: string): Promise<SessionRecord | null> {
    const response = await this.client.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { sessionId }
      })
    );

    return (response.Item as SessionRecord | undefined) ?? null;
  }

  public async listByUser(userId: string): Promise<SessionRecord[]> {
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

    return (response.Items as SessionRecord[] | undefined) ?? [];
  }

  public async listAll(): Promise<SessionRecord[]> {
    const response = await this.client.send(
      new ScanCommand({
        TableName: this.tableName
      })
    );

    return (response.Items as SessionRecord[] | undefined) ?? [];
  }

  public async save(record: SessionRecord): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: record
      })
    );
  }

  public async acquireTurnLock(sessionId: string): Promise<boolean> {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { sessionId },
          UpdateExpression: "SET inFlightTurn = :locked",
          ConditionExpression: "attribute_exists(sessionId) AND inFlightTurn = :unlocked",
          ExpressionAttributeValues: {
            ":locked": true,
            ":unlocked": false
          }
        })
      );
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return false;
      }
      throw error;
    }
  }

  public async releaseTurnLock(sessionId: string): Promise<void> {
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { sessionId },
          UpdateExpression: "SET inFlightTurn = :unlocked",
          ConditionExpression: "attribute_exists(sessionId)",
          ExpressionAttributeValues: {
            ":unlocked": false
          }
        })
      );
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) {
        return;
      }
      throw error;
    }
  }

  public async delete(sessionId: string): Promise<void> {
    await this.client.send(new DeleteCommand({ TableName: this.tableName, Key: { sessionId } }));
  }
}
