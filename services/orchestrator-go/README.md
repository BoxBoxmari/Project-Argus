# Go Orchestrator Service

A lightweight HTTP service for orchestrating review collection jobs across the
Project Argus pipeline.

## Features

- **HTTP API**: RESTful endpoints for job management
- **Worker Integration**: Seamless integration with worker node queue system
- **Graceful Shutdown**: Proper signal handling and connection draining
- **Health Checks**: Built-in health monitoring endpoint
- **Deterministic Jobs**: Idempotent job enqueueing with stable job IDs
- **Observable Operations**: Structured logging for monitoring

## Architecture

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   External API  │    │   Orchestrator  │    │   Worker Node   │
│                 │    │                 │    │                 │
│ POST /enqueue   │───▶│ HTTP Server     │───▶│ Queue System    │
│ GET  /health    │    │ Request Valid.  │    │ Job Processing  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Installation

```bash
cd argus/services/orchestrator-go
go mod tidy
go build ./cmd/server
```

## Configuration

### Environment Variables

```bash
# Server configuration
PORT=8080                              # HTTP server port
WORKER_NODE_URL=http://localhost:3000  # Worker node service URL

# Optional: Logging
LOG_LEVEL=info
```

## Usage

### Start Server

```bash
# Development
go run ./cmd/server

# Production (after build)
./server
```

### Docker

```bash
# Build image
docker build -t argus-orchestrator .

# Run container
docker run -p 8080:8080 \
  -e WORKER_NODE_URL=http://worker-node:3000 \
  argus-orchestrator
```

## API Endpoints

### POST /enqueue

Enqueue a review collection job for a Google Maps place.

**Request:**

```json
{
  "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4"
}
```

**Response (202 Accepted):**

```json
{
  "status": "enqueued",
  "placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4",
  "jobId": "reviews:ChIJN1t_tDeuEmsRUsoyG83frY4:start",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Error Response (400 Bad Request):**

```json
{
  "status": "error",
  "error": "placeId is required",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### GET /health

Service health check with system information.

**Response (200 OK):**

```json
{
  "status": "healthy",
  "service": "argus-orchestrator",
  "timestamp": "2024-01-15T10:30:00Z",
  "uptime": "2h15m30s",
  "worker_url": "http://localhost:3000"
}
```

## Integration

### With Worker Node

The orchestrator communicates with the worker node service via HTTP:

```bash
# Worker node should be running on configured URL
# Default: http://localhost:3000/enqueue
curl -X POST http://localhost:3000/enqueue \
  -H "Content-Type: application/json" \
  -d '{"placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4"}'
```

### Example Usage

```bash
# Enqueue a job
curl -X POST http://localhost:8080/enqueue \
  -H "Content-Type: application/json" \
  -d '{"placeId": "ChIJN1t_tDeuEmsRUsoyG83frY4"}'

# Check service health
curl http://localhost:8080/health

# View logs
docker logs argus-orchestrator
```

## Job Processing Flow

1. **Request Validation**: Validate JSON payload and required fields
2. **Worker Communication**: Forward job to worker node queue system
3. **Response Handling**: Return job ID and status to client
4. **Error Recovery**: Handle worker node failures gracefully
5. **Logging**: Record all operations for monitoring

### Idempotency

Jobs are idempotent by design:

- Deterministic job IDs based on place ID
- Worker node handles duplicate detection
- Same request returns same job ID

### Error Handling

```go
// Fail-fast with observable errors
if err := validateRequest(req); err != nil {
    log.Printf("validation failed: %v", err)
    return http.StatusBadRequest
}

// Worker integration with retry logic
workerResp, err := EnqueueToWorker(placeID)
if err != nil {
    log.Printf("worker enqueue failed: placeId=%s, error=%v", placeID, err)
    return http.StatusInternalServerError
}
```

## Development

### Project Structure

```text
cmd/server/
├── main.go      # HTTP server and graceful shutdown
├── handlers.go  # API request handlers
└── bridge.go    # Worker node integration

go.mod           # Go module dependencies
README.md        # This documentation
```

### Building

```bash
# Install dependencies
go mod tidy

# Run tests
go test ./...

# Build binary
go build -o orchestrator ./cmd/server

# Cross-compile for Linux
GOOS=linux GOARCH=amd64 go build -o orchestrator-linux ./cmd/server
```

### Code Quality

```bash
# Format code
go fmt ./...

# Vet for issues
go vet ./...

# Run linter (if golangci-lint installed)
golangci-lint run
```

## Deployment

### Dockerfile

```dockerfile
FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o orchestrator ./cmd/server

FROM alpine:latest
RUN apk add --no-cache ca-certificates
WORKDIR /root/
COPY --from=builder /app/orchestrator .
EXPOSE 8080
CMD ["./orchestrator"]
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: argus-orchestrator
spec:
  replicas: 2
  selector:
    matchLabels:
      app: argus-orchestrator
  template:
    metadata:
      labels:
        app: argus-orchestrator
    spec:
      containers:
      - name: orchestrator
        image: argus-orchestrator:latest
        ports:
        - containerPort: 8080
        env:
        - name: WORKER_NODE_URL
          value: "http://argus-worker:3000"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
```

## Monitoring

### Metrics

The service provides structured logging for monitoring:

```json
{"level":"info","msg":"job enqueued successfully","placeId":"ChIJ...","jobId":"reviews:...","duration":"150ms"}
{"level":"error","msg":"enqueue failed","placeId":"ChIJ...","error":"worker timeout"}
```

### Health Checks

```bash
# Kubernetes readiness probe
curl -f http://localhost:8080/health || exit 1

# Docker healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

## Troubleshooting

### Common Issues

1. **Worker Connection Failed**
   - Check `WORKER_NODE_URL` environment variable
   - Verify worker node service is running
   - Test connection: `curl $WORKER_NODE_URL/health`

2. **Port Already in Use**
   - Change `PORT` environment variable
   - Check for other services on port 8080
   - Use `netstat -tlnp | grep 8080`

3. **Job Enqueue Failures**
   - Check worker node logs for queue issues
   - Verify Redis connection in worker node
   - Monitor worker node health endpoint

### Debug Mode

```bash
# Enable verbose logging
export LOG_LEVEL=debug
go run ./cmd/server

# Test with curl
curl -v -X POST http://localhost:8080/enqueue \
  -H "Content-Type: application/json" \
  -d '{"placeId": "test-place-id"}'
```

## Contributing

1. Follow Go standard formatting (`go fmt`)
2. Add tests for new functionality
3. Update documentation for API changes
4. Use structured logging for observability
5. Ensure graceful error handling

## License

MIT License - Project Argus
