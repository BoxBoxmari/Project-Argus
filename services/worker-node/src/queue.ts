import { Queue, Worker, QueueScheduler, JobsOptions } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.QUEUE_URL || "redis://127.0.0.1:6379");
export const reviewsQueue = new Queue("reviews", { connection });
new QueueScheduler("reviews", { connection });

export function enqueueReviewJob(payload: { placeId: string; cursor?: string }) {
  const jobId = `reviews:${payload.placeId}:${payload.cursor ?? "start"}`;
  const opts: JobsOptions = {
    jobId,
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 1000,
    removeOnFail: 1000
  };
  return reviewsQueue.add("collect", payload, opts);
}

export function startWorker(handler: (data: any) => Promise<void>) {
  const worker = new Worker("reviews", async job => {
    await handler(job.data);
  }, { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3) });

  worker.on("failed", (job, err) => {
    console.error(JSON.stringify({ level: "error", msg: "job_failed", jobId: job?.id, err: String(err) }));
  });
  worker.on("completed", job => {
    console.log(JSON.stringify({ level: "info", msg: "job_completed", jobId: job.id }));
  });
  return worker;
}
