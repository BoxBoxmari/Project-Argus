export interface RetryOptions {
    retries: number;
    baseMs: number;
    capMs: number;
    jitter?: number;
    factor?: number;
    onRetry?: (attempt: number, error: Error, delay: number) => void;
    shouldRetry?: (error: Error, attempt: number) => boolean;
}
export declare class RetryError extends Error {
    readonly lastError: Error;
    readonly attempts: number;
    constructor(message: string, lastError: Error, attempts: number);
}
export declare function retry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T>;
export declare const retryStrategies: {
    rateLimit: {
        retries: number;
        baseMs: number;
        capMs: number;
        jitter: number;
        factor: number;
        shouldRetry: (error: Error) => boolean;
    };
    network: {
        retries: number;
        baseMs: number;
        capMs: number;
        jitter: number;
        factor: number;
        shouldRetry: (error: Error) => boolean;
    };
    serverError: {
        retries: number;
        baseMs: number;
        capMs: number;
        jitter: number;
        factor: number;
        shouldRetry: (error: Error) => boolean;
    };
    aggressive: {
        retries: number;
        baseMs: number;
        capMs: number;
        jitter: number;
        factor: number;
    };
};
export declare function retryWithStrategy<T>(fn: () => Promise<T>, strategy: keyof typeof retryStrategies | RetryOptions): Promise<T>;
//# sourceMappingURL=retry.d.ts.map