/**
 * Simple retry utility with backoff
 * Wrapper around the main retry functionality
 */

export interface SimpleRetryConfig {
    retries: number;
    baseMs: number;
    factor: number;
    maxMs: number;
    jitter?: number;
}

/**
 * Simple retry with exponential backoff and jitter
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    config: SimpleRetryConfig
): Promise<T> {
    let attempt = 0;
    let lastError: any;

    while (attempt <= config.retries) {
        try {
            return await fn();
        } catch (e) {
            lastError = e;

            if (attempt === config.retries) {
                break; // Last attempt failed
            }

            // Calculate delay with exponential backoff
            const baseDelay = config.baseMs * Math.pow(config.factor, attempt);
            const cappedDelay = Math.min(baseDelay, config.maxMs);

            // Add jitter to prevent thundering herd
            const jitter = config.jitter ?? 0.1;
            const jitterAmount = cappedDelay * jitter * (Math.random() * 2 - 1);
            const finalDelay = Math.max(100, cappedDelay + jitterAmount);

            console.log(`[retry] Attempt ${attempt + 1}/${config.retries + 1} failed, retrying in ${Math.round(finalDelay)}ms`);

            await new Promise(resolve => setTimeout(resolve, finalDelay));
            attempt++;
        }
    }

    // All attempts failed
    throw new Error(`Failed after ${config.retries + 1} attempts. Last error: ${String(lastError)}`);
}