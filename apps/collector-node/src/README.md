# Worker Node Queue System

A robust, queue-based job processing system for Project Argus review collection.

## Features

- **Redis-based Queue**: Uses BullMQ with Redis for reliable job processing
- **Retry Logic**: Exponential backoff with configurable retry attempts
- **Observable Errors**: Structured JSON logging for monitoring
- **Graceful Shutdown**: Clean worker termination with signal handling
- **HTTP API**: Simple REST endpoints for job enqueueing
- **TypeScript**: Full type safety and modern development experience

## Architecture

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Server    │    │   Redis Queue   │    │   Worker Pool   │
│                 │    │                 │    │                 │
│ POST /enqueue   │───▶│ Job Storage     │───▶│ Review Collector│
│ GET  /health    │    │ Retry Logic     │    │ Error Handler   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Setup

### Prerequisites

- Node.js 18+
- Redis server
- TypeScript

### Installation

```bash
cd argus/node
npm install
npm run build
```

### Environment Variables

```bash
# Redis connection
QUEUE_URL=redis://127.0.0.1:6379

# Worker configuration
WORKER_CONCURRENCY=3

# API server
API_PORT=3000
```

## Usage

### Start Worker

```bash
# Development with auto-reload
npm run dev

# Production
npm run start:queue
```

### Start API Server

```bash
# In separate terminal
npx ts-node src/api.ts
```

### Enqueue Jobs via API

```bash
# Enqueue a review collection job
curl -X POST http://localhost:3000/enqueue \
  -H "Content-Type: application/json" \
  -d '{"placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4", "cursor": "start"}'

# Check service health
curl http://localhost:3000/health
```

### Programmatic Usage

```typescript
import { enqueueReviewJob, startWorker } from './queue';

// Enqueue a job
const job = await enqueueReviewJob({
  placeId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
  cursor: "start"
});

// Start worker with custom handler
const worker = startWorker(async (data) => {
  console.log('Processing:', data);
  // Your review collection logic here
});
```

## API Endpoints

### POST /enqueue

Enqueue a review collection job. Returns **HTTP 202 Accepted** on success.

**Request:**

```json
{
  "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
  "cursor": "optional-pagination-cursor"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "jobId": "reviews:ChIJN1t_tDeuEmsRUsoyG83frY4:start",
    "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
    "cursor": "start",
    "enqueueTime": "2024-01-15T10:30:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### GET /health

Service health check with system information.

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "service": "argus-worker-node",
    "uptime": 3600.5,
    "memory": {...},
    "env": {
      "nodeVersion": "v18.19.0",
      "queueUrl": "redis://127.0.0.1:6379",
      "workerConcurrency": 3
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Job Processing

### Job Flow

1. **Enqueue**: Jobs are added to Redis queue with unique IDs
2. **Process**: Workers pick up jobs and execute review collection
3. **Retry**: Failed jobs are retried with exponential backoff (5 attempts)
4. **Cleanup**: Completed/failed jobs are cleaned up automatically

### Job Configuration

```typescript
const opts: JobsOptions = {
  jobId: "reviews:placeId:cursor",    // Unique identifier
  attempts: 5,                        // Retry attempts
  backoff: {                         // Exponential backoff
    type: "exponential",
    delay: 1000
  },
  removeOnComplete: 1000,            // Keep last 1000 completed
  removeOnFail: 1000                 // Keep last 1000 failed
};
```

## Monitoring

### Structured Logging

All operations are logged in JSON format for easy parsing:

```json
{"level":"info","msg":"job_started","placeId":"ChIJN1t_tDeuEmsRUsoyG83frY4","cursor":"start"}
{"level":"info","msg":"job_success","placeId":"ChIJN1t_tDeuEmsRUsoyG83frY4","duration":1250}
{"level":"error","msg":"job_error","placeId":"ChIJN1t_tDeuEmsRUsoyG83frY4","error":"Network timeout"}
```

### Key Metrics

- `job_started`: Job processing begins
- `job_success`: Job completed successfully
- `job_error`: Job failed (will retry)
- `job_failed`: Job permanently failed after retries
- `job_completed`: Job finished processing
- `api_request`: HTTP API calls
- `worker_ready`: Worker pool initialized

## Development

### Scripts

```bash
npm run build         # Compile TypeScript
npm run build:watch   # Watch mode compilation
npm run dev           # Development with auto-reload
npm run lint          # Code linting
npm run test          # Run tests
```

### Testing

```bash
# Unit tests
npm test

# Integration testing with Redis
docker run -d -p 6379:6379 redis:alpine
npm test
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/worker.js"]
```

### Production Considerations

- Use Redis Cluster for high availability
- Configure proper log aggregation (ELK, Fluentd)
- Set up monitoring (Prometheus, Grafana)
- Use process managers (PM2, systemd)
- Implement health checks and circuit breakers

## Troubleshooting

### Common Issues

1. **Redis Connection Errors**
   - Check `QUEUE_URL` environment variable
   - Verify Redis server is running
   - Test connection: `redis-cli ping`

2. **Jobs Not Processing**
   - Check worker is running: `npm run start:queue`
   - Verify queue has jobs: Redis CLI `LLEN bull:reviews:waiting`
   - Check worker logs for errors

3. **High Memory Usage**
   - Reduce `removeOnComplete` and `removeOnFail` values
   - Implement job data compression
   - Monitor Redis memory usage

### Debug Mode

```bash
DEBUG=bull* npm run dev
```

## Contributing

1. Follow TypeScript strict mode
2. Add tests for new features
3. Use structured logging
4. Document API changes
5. Ensure graceful error handling

## License

MIT License - Project Argus
