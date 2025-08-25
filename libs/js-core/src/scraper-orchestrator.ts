import { RequestQueue, Req } from './request-queue.js';
import { AutoscaledPool } from './autoscale.js';
import { retryWithStrategy, retryStrategies } from './retry.js';
import { extractDomain, getRateLimit, calculateRateLimitDelay } from './domain-utils.js';
import { createWriteStream } from 'fs';
import { dirname } from 'path';

export interface ScraperOptions {
  queueFile: string;
  outputFile: string;
  minConcurrency: number;
  maxConcurrency: number;
  maxRetries: number;
  rateLimitDelay: number;
  logFile?: string;
}

export interface ScrapingResult {
  url: string;
  success: boolean;
  data?: any;
  error?: string;
  retries: number;
  duration: number;
  timestamp: string;
}

export abstract class BaseScraper {
  abstract scrape(url: string): Promise<any>;
  abstract getDomain(): string;
}

export class ScraperOrchestrator {
  private queue: RequestQueue;
  private pool: AutoscaledPool;
  private results: ScrapingResult[] = [];
  private domainTimestamps = new Map<string, number>();
  private domainCounts = new Map<string, number>();
  private outputStream: any;
  private logStream: any;

  constructor(
    private options: ScraperOptions,
    private scraper: BaseScraper
  ) {
    this.queue = new RequestQueue(options.queueFile);
    this.pool = new AutoscaledPool({
      minConcurrency: options.minConcurrency,
      maxConcurrency: options.maxConcurrency,
      maybeRunIntervalMs: 500,
      isBusy: () => this.isSystemBusy()
    }, () => this.processNextRequest());
  }

  async init() {
    await this.queue.init();
    
    // Setup output streams
    await this.setupOutputStreams();
    
    // Start the autoscaling pool
    await this.pool.start();
  }

  private async setupOutputStreams() {
    // Ensure output directory exists
    const outputDir = dirname(this.options.outputFile);
    await this.queue.init(); // This creates directories
    
    // Setup output stream for results
    this.outputStream = createWriteStream(this.options.outputFile, { flags: 'a' });
    
    // Setup log stream if specified
    if (this.options.logFile) {
      this.logStream = createWriteStream(this.options.logFile, { flags: 'a' });
    }
  }

  async addUrls(urls: string[], priority: number = 0) {
    const requests: Req[] = urls.map(url => ({
      url,
      priority,
      domain: extractDomain(url),
      uniqueKey: url, // Use URL as unique key
      rateLimitDelay: this.options.rateLimitDelay
    }));

    for (const req of requests) {
      await this.queue.add(req);
    }

    this.log(`Added ${urls.length} URLs to queue with priority ${priority}`);
  }

  private async processNextRequest() {
    const item = await this.queue.fetchNext();
    if (!item) return;

    const startTime = Date.now();
    const domain = extractDomain(item.url);

    try {
      // Check rate limiting
      await this.checkRateLimit(domain);

      // Process the request with retry logic
      const data = await retryWithStrategy(
        () => this.scraper.scrape(item.url),
        {
          ...retryStrategies.rateLimit,
          retries: this.options.maxRetries,
          onRetry: (attempt, error, delay) => {
            this.log(`Retry ${attempt} for ${item.url}: ${error.message}, waiting ${delay}ms`);
          }
        }
      );

      // Mark as handled
      await this.queue.markHandled(item.id);

      // Record success
      const result: ScrapingResult = {
        url: item.url,
        success: true,
        data,
        retries: item.retries,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      this.recordResult(result);

    } catch (error) {
      // Mark as failed
      await this.queue.markFailed(item.id, error instanceof Error ? error.message : String(error));

      // Record failure
      const result: ScrapingResult = {
        url: item.url,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        retries: item.retries,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      this.recordResult(result);
    }

    // Update domain tracking
    this.updateDomainTracking(domain);
  }

  private async checkRateLimit(domain: string) {
    const lastRequest = this.domainTimestamps.get(domain) || 0;
    const requestCount = this.domainCounts.get(domain) || 0;
    
    const delay = calculateRateLimitDelay(domain, lastRequest, requestCount);
    
    if (delay > 0) {
      this.log(`Rate limiting ${domain}: waiting ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  private updateDomainTracking(domain: string) {
    this.domainTimestamps.set(domain, Date.now());
    this.domainCounts.set(domain, (this.domainCounts.get(domain) || 0) + 1);
  }

  private recordResult(result: ScrapingResult) {
    this.results.push(result);
    
    // Write to output stream
    this.outputStream.write(JSON.stringify(result) + '\n');
    
    // Write to log if available
    if (this.logStream) {
      const logEntry = {
        timestamp: result.timestamp,
        level: result.success ? 'INFO' : 'ERROR',
        url: result.url,
        success: result.success,
        duration: result.duration,
        retries: result.retries,
        error: result.error
      };
      this.logStream.write(JSON.stringify(logEntry) + '\n');
    }
  }

  private isSystemBusy(): boolean {
    // Check if we have too many in-progress requests
    const stats = this.queue.getStats();
    return stats.inProgress >= this.options.maxConcurrency * 0.8;
  }

  private log(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    
    if (this.logStream) {
      this.logStream.write(JSON.stringify({ timestamp, message }) + '\n');
    }
    
    console.log(logMessage);
  }

  async getStats() {
    const queueStats = this.queue.getStats();
    const poolStats = this.pool.getStats();
    
    return {
      queue: queueStats,
      pool: poolStats,
      results: {
        total: this.results.length,
        successful: this.results.filter(r => r.success).length,
        failed: this.results.filter(r => !r.success).length
      },
      domains: Object.fromEntries(this.domainCounts)
    };
  }

  async stop() {
    this.pool.stop();
    await this.queue.close();
    
    if (this.outputStream) {
      this.outputStream.end();
    }
    
    if (this.logStream) {
      this.logStream.end();
    }
  }
}

// ví dụ nơi đang báo TS7006
const onRetryHandler = (attempt: number, error: unknown, delay: number) => {
  // logging hoặc metrics
};

// nơi dùng:
retryWithStrategy(async () => {/* ... */}, {
  ...retryStrategies.network,
  onRetry: onRetryHandler
});
