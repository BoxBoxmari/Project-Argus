/**
 * Scheduler for controlling extraction timing and performance
 */

export interface SchedulerConfig {
  debounceMs: number;
  maxConcurrency: number;
  extractionInterval: number;
  idleThreshold: number;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  debounceMs: 300,
  maxConcurrency: 2,
  extractionInterval: 2000,
  idleThreshold: 5000
};

export class Scheduler {
  private config: SchedulerConfig;
  private debounceTimeout: number | null = null;
  private extractionTimer: number | null = null;
  private lastActivity: number = 0;
  private activeJobs = 0;

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Schedule extraction with debouncing
   */
  public scheduleExtraction(callback: () => void): void {
    // Clear existing timeout
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    // Update activity timestamp
    this.lastActivity = Date.now();

    // Debounce the extraction
    this.debounceTimeout = window.setTimeout(() => {
      if (this.canExecute()) {
        this.executeJob(callback);
      }
    }, this.config.debounceMs);
  }

  /**
   * Start periodic extraction
   */
  public startPeriodicExtraction(callback: () => void): void {
    if (this.extractionTimer) {
      this.stopPeriodicExtraction();
    }

    this.extractionTimer = window.setInterval(() => {
      if (this.isIdle() && this.canExecute()) {
        this.executeJob(callback);
      }
    }, this.config.extractionInterval);
  }

  /**
   * Stop periodic extraction
   */
  public stopPeriodicExtraction(): void {
    if (this.extractionTimer) {
      clearInterval(this.extractionTimer);
      this.extractionTimer = null;
    }
  }

  /**
   * Check if scheduler can execute more jobs
   */
  private canExecute(): boolean {
    return this.activeJobs < this.config.maxConcurrency;
  }

  /**
   * Check if user is idle
   */
  private isIdle(): boolean {
    return Date.now() - this.lastActivity > this.config.idleThreshold;
  }

  /**
   * Execute job with concurrency control
   */
  private async executeJob(callback: () => void | Promise<void>): Promise<void> {
    this.activeJobs++;

    try {
      await callback();
    } catch (error) {
      console.error('Scheduled job failed:', error);
    } finally {
      this.activeJobs--;
    }
  }

  /**
   * Update activity timestamp
   */
  public recordActivity(): void {
    this.lastActivity = Date.now();
  }

  /**
   * Get scheduler statistics
   */
  public getStats(): { activeJobs: number; isIdle: boolean; lastActivity: number } {
    return {
      activeJobs: this.activeJobs,
      isIdle: this.isIdle(),
      lastActivity: this.lastActivity
    };
  }

  /**
   * Cleanup scheduler
   */
  public cleanup(): void {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = null;
    }

    this.stopPeriodicExtraction();
  }
}
