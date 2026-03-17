import { getSupabaseClient } from "./client";

export type QueueMessage<T = Record<string, unknown>> = {
  msg_id: number;
  read_ct: number;
  enqueued_at: string;
  vt: string;
  message: T;
};

export async function sendMessage(
  queueName: string,
  message: Record<string, unknown>,
): Promise<number> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("pgmq_send", {
    queue_name: queueName,
    message: message,
  });
  if (error) throw error;
  return data;
}

export async function readMessage<T = Record<string, unknown>>(
  queueName: string,
  visibilityTimeoutSeconds: number,
): Promise<QueueMessage<T> | null> {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc("pgmq_read", {
    queue_name: queueName,
    vt: visibilityTimeoutSeconds,
    qty: 1,
  });
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0] as QueueMessage<T>;
}

export async function archiveMessage(
  queueName: string,
  msgId: number,
): Promise<void> {
  const client = getSupabaseClient();
  const { error } = await client.rpc("pgmq_archive", {
    queue_name: queueName,
    msg_id: msgId,
  });
  if (error) throw error;
}
