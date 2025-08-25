export type Req = {
    url: string;
    method?: string;
    userData?: any;
    uniqueKey?: string;
    priority?: number;
    domain?: string;
    rateLimitDelay?: number;
};
type Item = Req & {
    id: string;
    state: 'queued' | 'in-progress' | 'handled' | 'failed';
    retries: number;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
};
export declare class RequestQueue {
    private file;
    private w;
    private mem;
    private domainCounts;
    private maxConcurrencyPerDomain;
    constructor(file: string);
    init(): Promise<void>;
    private static keyOf;
    private updateDomainCount;
    add(r: Req): Promise<Item>;
    private persistItem;
    fetchNext(): Promise<Item | null>;
    markHandled(id: string): Promise<void>;
    markFailed(id: string, err: string): Promise<void>;
    retry(id: string): Promise<Item | null>;
    getStats(): {
        total: number;
        queued: number;
        inProgress: number;
        handled: number;
        failed: number;
        byDomain: {
            [k: string]: number;
        };
    };
    close(): Promise<void>;
}
export {};
//# sourceMappingURL=request-queue.d.ts.map