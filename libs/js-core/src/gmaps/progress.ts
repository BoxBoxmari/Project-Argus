/**
 * Unified progress tracking facade
 * Based on Project Argus Master Scraper progress coordination
 */

export interface ProgressUpdate {
    url: string;
    count: number;
    timestamp: number;
    meta?: {
        source?: string;
        phase?: string;
        eta?: number;
        rpm?: number;
        sessionId?: string;
    };
}

export interface ProgressStats {
    totalLinks: number;
    totalReviews: number;
    expectedReviews: number;
    activeSessions: number;
    completedSessions: number;
}

/**
 * Simple progress facade for Playwright environment
 * For userscript functionality, implement GM_* functions separately
 */
export class ProgressFacade {
    private sessionId: string;
    private lastEmitTime?: number;
    private lastEmitCount?: number;

    constructor() {
        this.sessionId = this.generateSessionId();
    }

    /**
     * Set total expected reviews (no-op in Playwright)
     */
    setTotalExpected(count: number, url?: string): void {
        console.log(`[progress] Total expected: ${count} reviews`);
    }

    /**
     * Update link count (no-op in Playwright)
     */
    updateLinks(count: number, operation: 'add' | 'remove' | 'set' = 'set'): void {
        console.log(`[progress] Links ${operation}: ${count}`);
    }

    /**
     * Update review count for a specific URL
     */
    updateReviews(url: string, count: number, meta?: ProgressUpdate['meta']): void {
        console.log(`[progress] Reviews for ${url}: ${count} (${meta?.rpm?.toFixed(1) || 0} rpm)`);
    }

    /**
     * Emit chunk progress (for streaming scenarios)
     */
    emitChunk(count: number, meta?: { phase?: string;[key: string]: any }): void {
        const timestamp = Date.now();

        // Calculate RPM if we have previous data
        let rpm = 0;
        if (this.lastEmitTime && this.lastEmitCount) {
            const timeDiffMinutes = (timestamp - this.lastEmitTime) / (1000 * 60);
            const countDiff = count - this.lastEmitCount;
            if (timeDiffMinutes > 0 && countDiff > 0) {
                rpm = countDiff / timeDiffMinutes;
            }
        }

        this.lastEmitTime = timestamp;
        this.lastEmitCount = count;

        console.log(`[progress] Chunk: ${count} reviews (${rpm.toFixed(1)} rpm) ${meta?.phase || ''}`);
    }

    /**
     * Get current progress stats (basic implementation)
     */
    async getStats(): Promise<ProgressStats> {
        return {
            totalLinks: 0,
            totalReviews: 0,
            expectedReviews: 0,
            activeSessions: 0,
            completedSessions: 0
        };
    }

    /**
     * Clear all progress data (no-op in Playwright)
     */
    async clearAll(): Promise<void> {
        console.log('[progress] Clear all (no-op in Playwright)');
    }

    private generateSessionId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}

// Export singleton instance for convenience
export const progress = new ProgressFacade();

// Progress event types for BroadcastChannel
export interface ProgressEvent {
    type: 'progress' | 'chunk' | 'start' | 'complete' | 'error';
    url?: string;
    count?: number;
    timestamp: number;
    sessionId: string;
    meta?: Record<string, any>;
}