# @argus/js-core

Advanced JavaScript/TypeScript core library for Project Argus, providing enterprise-grade web scraping capabilities with intelligent queue management, autoscaling, and comprehensive error handling.

## 🚀 Features

### Core Components

- **📋 Request Queue System** - Persistent, idempotent request management
- **⚡ Autoscaling Pool** - CPU and event-loop aware concurrency control
- **🔄 Retry Mechanisms** - Exponential backoff with jitter and strategies
- **🌐 Domain Rate Limiting** - Intelligent domain-aware rate limiting
- **🎯 Scraper Orchestrator** - Unified interface for all components
- **📊 JSON Schema Validation** - Comprehensive data contracts
- **🧪 Test Suite** - Full coverage with edge case testing

### Key Benefits

- **Production Ready**: Built for high-throughput, reliable scraping
- **Intelligent Scaling**: Automatically adjusts based on system capacity
- **Fault Tolerant**: Comprehensive retry and recovery mechanisms
- **Rate Limit Aware**: Prevents blocking with domain-specific limits
- **Idempotent**: Safe retry and recovery operations
- **Observable**: Real-time monitoring and statistics

## 📦 Installation

```bash
# Install dependencies
pnpm install

# Build the library
pnpm run build

# Run tests
pnpm run test

# Lint code
pnpm run lint
```

## 🏗️ Architecture

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Request       │    │   Autoscaling   │    │   Retry         │
│   Queue         │◄──►│   Pool          │◄──►│   Mechanism     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Domain        │    │   Scraper       │    │   JSON Schema   │
│   Utils         │    │   Orchestrator  │    │   Validation    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📚 Usage Examples

### Basic Request Queue

```typescript
import { RequestQueue, Req } from '@argus/js-core';

const queue = new RequestQueue('./data/queue.ndjson');
await queue.init();

// Add requests with priorities
const req: Req = {
  url: 'https://maps.google.com/place/restaurant',
  priority: 10,
  uniqueKey: 'restaurant-123',
  userData: { category: 'restaurant' }
};

await queue.add(req);

// Process requests
const item = await queue.fetchNext();
if (item) {
  try {
    // Process the item
    await processUrl(item.url);
    await queue.markHandled(item.id);
  } catch (error) {
    await queue.markFailed(item.id, error.message);
  }
}
```

### Autoscaling Pool

```typescript
import { AutoscaledPool } from '@argus/js-core';

const pool = new AutoscaledPool({
  minConcurrency: 2,
  maxConcurrency: 10,
  cpuThreshold: 0.8,
  eventLoopThreshold: 50
}, async () => {
  // Your scraping task here
  await scrapeNextUrl();
});

await pool.start();

// Pool automatically scales based on system load
// Monitor performance
const stats = pool.getStats();
console.log('Current concurrency:', stats.currentConcurrency);
```

### Retry with Strategies

```typescript
import { retryWithStrategy, retryStrategies } from '@argus/js-core';

// Use predefined strategies
const result = await retryWithStrategy(
  async () => fetch('https://api.example.com'),
  'rateLimit' // 5 retries, exponential backoff
);

// Custom retry strategy
const result = await retry(
  async () => scrapeUrl(url),
  {
    retries: 3,
    baseMs: 1000,
    capMs: 10000,
    jitter: 0.2,
    shouldRetry: (error) => error.message.includes('429')
  }
);
```

### Domain Rate Limiting

```typescript
import { 
  extractDomain, 
  getRateLimit, 
  calculateRateLimitDelay 
} from '@argus/js-core';

const url = 'https://maps.google.com/place/restaurant';
const domain = extractDomain(url);
const rateLimit = getRateLimit(domain);

console.log(`${domain} allows ${rateLimit.requestsPerSecond} req/sec`);

// Calculate delay for next request
const delay = calculateRateLimitDelay(domain, lastRequestTime, requestCount);
if (delay > 0) {
  await new Promise(resolve => setTimeout(resolve, delay));
}
```

### Complete Scraper Orchestrator

```typescript
import { ScraperOrchestrator, BaseScraper } from '@argus/js-core';

class MyScraper extends BaseScraper {
  async scrape(url: string): Promise<any> {
    // Implement your scraping logic
    const response = await fetch(url);
    return await response.json();
  }

  getDomain(): string {
    return 'example.com';
  }
}

const orchestrator = new ScraperOrchestrator({
  queueFile: './data/queue.ndjson',
  outputFile: './data/results.ndjson',
  minConcurrency: 2,
  maxConcurrency: 5,
  maxRetries: 3
}, new MyScraper());

await orchestrator.init();

// Add URLs to scrape
await orchestrator.addUrls([
  'https://example.com/page1',
  'https://example.com/page2'
], 5);

// Let it run
await new Promise(resolve => setTimeout(resolve, 10000));

// Get statistics
const stats = await orchestrator.getStats();
console.log('Scraped:', stats.handled, 'Failed:', stats.failed);

await orchestrator.stop();
```

## 🔧 Configuration

### Environment Variables

```bash
# Rate limiting
ARGUS_RATE_LIMIT_PER_SEC=1
ARGUS_MAX_CONCURRENCY=5
ARGUS_RETRY_MAX=3

# Queue settings
ARGUS_QUEUE_FILE=./data/queue.ndjson
ARGUS_OUTPUT_FILE=./data/results.ndjson

# Autoscaling
ARGUS_CPU_THRESHOLD=0.8
ARGUS_EVENT_LOOP_THRESHOLD=50
```

### Rate Limit Configuration

```typescript
import { defaultRateLimits } from '@argus/js-core';

// Customize rate limits for specific domains
defaultRateLimits['myapi.com'] = {
  requestsPerSecond: 2,
  requestsPerMinute: 100,
  burstSize: 5,
  cooldownMs: 500
};
```

## 📊 Monitoring & Statistics

### Queue Statistics

```typescript
const stats = queue.getStats();
console.log({
  total: stats.total,
  queued: stats.queued,
  inProgress: stats.inProgress,
  handled: stats.handled,
  failed: stats.failed
});
```

### Pool Performance

```typescript
const poolStats = pool.getStats();
console.log({
  currentConcurrency: poolStats.currentConcurrency,
  cpuUsage: poolStats.cpuUsage,
  eventLoopDelay: poolStats.eventLoopDelay,
  tasksCompleted: poolStats.tasksCompleted
});
```

### Orchestrator Metrics

```typescript
const orchestratorStats = await orchestrator.getStats();
console.log({
  urlsAdded: orchestratorStats.urlsAdded,
  urlsProcessed: orchestratorStats.urlsProcessed,
  successRate: orchestratorStats.successRate,
  averageProcessingTime: orchestratorStats.averageProcessingTime
});
```

## 🧪 Testing

### Run All Tests

```bash
pnpm run test
```

### Run Specific Test Suites

```bash
# Test request queue
pnpm test request-queue.test.ts

# Test retry mechanisms
pnpm test retry.test.ts

# Test domain utilities
pnpm test domain-utils.test.ts
```

### Test Coverage

```bash
pnpm run test:coverage
```

## 📁 File Structure

```text
├── src/
│   ├── request-queue.ts      # Persistent request queue
│   ├── autoscale.ts          # Autoscaling pool
│   ├── retry.ts              # Retry mechanisms
│   ├── domain-utils.ts       # Domain utilities
│   ├── scraper-orchestrator.ts # Main orchestrator
│   ├── example-usage.ts      # Usage examples
│   └── __tests__/            # Test suite
├── package.json
├── tsconfig.json
└── README.md
```

## 🔍 Troubleshooting

### Common Issues

Queue not processing items

- Check if items are in correct state
- Verify domain concurrency limits
- Check for rate limiting delays

High CPU usage

- Adjust `cpuThreshold` in autoscaling options
- Reduce `maxConcurrency`
- Check for infinite loops in scraping logic

Rate limiting issues

- Verify domain extraction is correct
- Check rate limit configuration
- Increase delays between requests

Memory leaks

- Ensure proper cleanup in `close()` methods
- Monitor queue size and clear old items
- Check for circular references

### Debug Mode

```typescript
// Enable debug logging
process.env.DEBUG = 'argus:*';

// Or enable specific components
process.env.DEBUG = 'argus:queue,argus:autoscale';
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Development Setup

```bash
# Clone and setup
git clone <repository>
cd libs/js-core
pnpm install

# Development mode
pnpm run dev

# Build and test
pnpm run build
pnpm run test
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [Crawlee](https://crawlee.dev/) and [Apify](https://apify.com/) architectures
- Built with modern TypeScript and Node.js best practices
- Designed for production-scale web scraping operations
