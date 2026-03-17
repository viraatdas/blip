import { queue } from "@blip/db";
import { PGMQ_VISIBILITY_TIMEOUT_S } from "@blip/shared";
import { processJob } from "./job-consumer.js";

const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT ?? "5", 10);
const POLL_INTERVAL_MS = parseInt(process.env.PGMQ_POLL_INTERVAL_MS ?? "1000", 10);

let activeJobs = 0;

async function poll() {
  if (activeJobs >= MAX_CONCURRENT) return;

  const msg = await queue.readMessage<{ execution_id: string }>(
    "execution_jobs",
    PGMQ_VISIBILITY_TIMEOUT_S,
  );

  if (!msg) return;

  activeJobs++;
  console.log(`[worker] Processing job msg_id=${msg.msg_id} execution_id=${msg.message.execution_id}`);

  // Process asynchronously so we can continue polling
  processJob(msg.message.execution_id)
    .then(async () => {
      await queue.archiveMessage("execution_jobs", msg.msg_id);
      console.log(`[worker] Completed job msg_id=${msg.msg_id}`);
    })
    .catch(async (err) => {
      console.error(`[worker] Failed job msg_id=${msg.msg_id}:`, err);
      // Message will become visible again after visibility timeout
    })
    .finally(() => {
      activeJobs--;
    });
}

async function main() {
  console.log(`[worker] Starting with MAX_CONCURRENT=${MAX_CONCURRENT}`);

  // Poll loop
  while (true) {
    try {
      await poll();
    } catch (err) {
      console.error("[worker] Poll error:", err);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
