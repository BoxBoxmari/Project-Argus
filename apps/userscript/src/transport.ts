/**
 * Transport layer for batching and sending review data
 */

import { RawReview } from './normalize';

export interface TransportConfig {
  batchSize: number;
  maxRetries: number;
  retryDelay: number;
  endpoint?: string;
}

const DEFAULT_CONFIG: TransportConfig = {
  batchSize: 50,
  maxRetries: 3,
  retryDelay: 1000
};

export class Transport {
  private config: TransportConfig;
  private pending: RawReview[] = [];
  private retryQueue: RawReview[] = [];

  constructor(config: Partial<TransportConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Add review to pending batch
   */
  public add(review: RawReview): void {
    this.pending.push(review);

    if (this.pending.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush pending reviews
   */
  public async flush(): Promise<void> {
    if (this.pending.length === 0) return;

    const batch = this.pending.splice(0);
    await this.sendBatch(batch);
  }

  /**
   * Send batch with retry logic
   */
  private async sendBatch(reviews: RawReview[], attempt = 1): Promise<void> {
    try {
      await this.saveBatch(reviews);
      console.log(`Sent batch of ${reviews.length} reviews`);
    } catch (error: unknown) {
      console.error(`Failed to send batch (attempt ${attempt}):`, error);

      if (attempt < this.config.maxRetries) {
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
        await this.sleep(delay);
        return this.sendBatch(reviews, attempt + 1);
      } else {
        // Add to retry queue for later
        this.retryQueue.push(...reviews);
        console.error(`Batch failed after ${this.config.maxRetries} attempts, added to retry queue`);
      }
    }
  }

  /**
   * Save batch using available methods
   */
  private async saveBatch(reviews: RawReview[]): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `argus_reviews_${timestamp}.ndjson`;

    // Save as NDJSON
    const ndjsonContent = reviews.map(review => JSON.stringify(review)).join('\\n');

    // Try to use GM_download if available
    if (typeof GM_download !== 'undefined') {
      const blob = new Blob([ndjsonContent], { type: 'application/x-ndjson' });
      const url = URL.createObjectURL(blob);

      return new Promise((resolve, reject) => {
        GM_download({
          url,
          name: filename,
          onload: () => {
            URL.revokeObjectURL(url);
            resolve();
          },
          onerror: (error: unknown) => {
            URL.revokeObjectURL(url);
            reject(error);
          }
        });
      });
    }

    // Fallback to localStorage
    const storageKey = `argus_batch_${timestamp}`;
    localStorage.setItem(storageKey, ndjsonContent);
  }

  /**
   * Process retry queue
   */
  public async processRetryQueue(): Promise<void> {
    if (this.retryQueue.length === 0) return;

    const retryBatch = this.retryQueue.splice(0);
    await this.sendBatch(retryBatch);
  }

  /**
   * Get statistics
   */
  public getStats(): { pending: number; retrying: number } {
    return {
      pending: this.pending.length,
      retrying: this.retryQueue.length
    };
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
