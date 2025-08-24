import { startWorker, enqueueReviewJob } from "./queue";

interface ReviewJobData {
  placeId: string;
  cursor?: string;
}

async function processReviewJob(data: ReviewJobData): Promise<void> {
  const { placeId, cursor } = data;
  const startTime = Date.now();
  
  console.log(JSON.stringify({ 
    level: "info", 
    msg: "job_started", 
    placeId, 
    cursor: cursor ?? "start" 
  }));

  try {
    // Simulate review collection logic
    // In real implementation, this would call puppeteer or API
    await simulateReviewCollection(placeId, cursor);
    
    const duration = Date.now() - startTime;
    console.log(JSON.stringify({ 
      level: "info", 
      msg: "job_success", 
      placeId, 
      cursor: cursor ?? "start",
      duration 
    }));
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(JSON.stringify({ 
      level: "error", 
      msg: "job_error", 
      placeId, 
      cursor: cursor ?? "start",
      error: String(error),
      duration 
    }));
    throw error; // Re-throw to trigger retry mechanism
  }
}

async function simulateReviewCollection(placeId: string, cursor?: string): Promise<void> {
  // Simulate API call or web scraping delay
  const delay = Math.random() * 2000 + 1000; // 1-3 seconds
  await new Promise(resolve => setTimeout(resolve, delay));
  
  // Simulate occasional failures for testing retry logic
  if (Math.random() < 0.1) { // 10% failure rate
    throw new Error(`Network timeout for place ${placeId}`);
  }
  
  console.log(JSON.stringify({
    level: "debug",
    msg: "reviews_collected",
    placeId,
    cursor: cursor ?? "start",
    count: Math.floor(Math.random() * 50) + 10 // 10-60 reviews
  }));
}

// Export function for enqueueing jobs
export async function enqueueJob(placeId: string, cursor?: string) {
  try {
    const job = await enqueueReviewJob({ placeId, cursor });
    console.log(JSON.stringify({
      level: "info",
      msg: "job_enqueued",
      jobId: job.id,
      placeId,
      cursor: cursor ?? "start"
    }));
    return job;
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      msg: "enqueue_failed",
      placeId,
      cursor: cursor ?? "start",
      error: String(error)
    }));
    throw error;
  }
}

// Start worker if this file is run directly
if (require.main === module) {
  console.log(JSON.stringify({ 
    level: "info", 
    msg: "worker_starting", 
    concurrency: process.env.WORKER_CONCURRENCY ?? 3 
  }));
  
  const worker = startWorker(processReviewJob);
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log(JSON.stringify({ level: "info", msg: "worker_shutdown_start" }));
    await worker.close();
    console.log(JSON.stringify({ level: "info", msg: "worker_shutdown_complete" }));
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log(JSON.stringify({ level: "info", msg: "worker_shutdown_start" }));
    await worker.close();
    console.log(JSON.stringify({ level: "info", msg: "worker_shutdown_complete" }));
    process.exit(0);
  });

  console.log(JSON.stringify({ level: "info", msg: "worker_ready" }));
}
