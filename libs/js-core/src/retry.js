export class RetryError extends Error {
    constructor(message, lastError, attempts) {
        super(message);
        this.lastError = lastError;
        this.attempts = attempts;
        this.name = 'RetryError';
    }
}
export async function retry(fn, opts) {
    let delay = opts.baseMs;
    const factor = opts.factor ?? 2;
    for (let attempt = 0; attempt <= opts.retries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            // Check if we should retry this error
            if (opts.shouldRetry && !opts.shouldRetry(err, attempt)) {
                throw err;
            }
            // If this was the last attempt, throw a RetryError
            if (attempt === opts.retries) {
                throw new RetryError(`Failed after ${attempt + 1} attempts. Last error: ${err.message}`, err, attempt + 1);
            }
            // Calculate delay with exponential backoff
            const backoffDelay = Math.min(delay, opts.capMs);
            // Add jitter to prevent thundering herd
            const jitter = (opts.jitter ?? 0.1) * Math.random();
            const finalDelay = backoffDelay * (1 + jitter);
            // Call onRetry callback if provided
            if (opts.onRetry) {
                opts.onRetry(attempt + 1, err, finalDelay);
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, finalDelay));
            // Exponential backoff
            delay *= factor;
        }
    }
    throw new Error('Unreachable code');
}
// Predefined retry strategies
export const retryStrategies = {
    // For rate limiting (HTTP 429)
    rateLimit: {
        retries: 5,
        baseMs: 1000,
        capMs: 60000,
        jitter: 0.2,
        factor: 2,
        shouldRetry: (error) => {
            return error.message.includes('429') ||
                error.message.includes('Too Many Requests') ||
                error.message.includes('Rate limit');
        }
    },
    // For network errors
    network: {
        retries: 3,
        baseMs: 500,
        capMs: 10000,
        jitter: 0.1,
        factor: 2,
        shouldRetry: (error) => {
            return error.message.includes('ECONNRESET') ||
                error.message.includes('ETIMEDOUT') ||
                error.message.includes('ENOTFOUND') ||
                error.message.includes('Network Error');
        }
    },
    // For server errors (HTTP 5xx)
    serverError: {
        retries: 3,
        baseMs: 2000,
        capMs: 30000,
        jitter: 0.15,
        factor: 2,
        shouldRetry: (error) => {
            return error.message.includes('500') ||
                error.message.includes('502') ||
                error.message.includes('503') ||
                error.message.includes('504');
        }
    },
    // Aggressive retry for critical operations
    aggressive: {
        retries: 10,
        baseMs: 100,
        capMs: 30000,
        jitter: 0.3,
        factor: 1.5
    }
};
// Convenience function for common retry scenarios
export async function retryWithStrategy(fn, strategy) {
    const options = typeof strategy === 'string' ? retryStrategies[strategy] : strategy;
    return retry(fn, options);
}
//# sourceMappingURL=retry.js.map