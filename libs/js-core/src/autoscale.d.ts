type Options = {
    minConcurrency: number;
    maxConcurrency: number;
    maybeRunIntervalMs?: number;
    isBusy?: () => boolean;
    cpuThreshold?: number;
    eventLoopThreshold?: number;
};
export declare class AutoscaledPool {
    private opts;
    private runTask;
    private running;
    private stopped;
    private lastEventLoopCheck;
    private eventLoopDelays;
    private cpuUsage;
    constructor(opts: Options, runTask: () => Promise<void>);
    start(): Promise<void>;
    private canStartNewTask;
    private startCpuMonitoring;
    private startEventLoopMonitoring;
    stop(): void;
    getStats(): {
        running: number;
        minConcurrency: number;
        maxConcurrency: number;
        cpuUsage: number;
        eventLoopDelays: number[];
        avgEventLoopDelay: number;
    };
}
export {};
//# sourceMappingURL=autoscale.d.ts.map