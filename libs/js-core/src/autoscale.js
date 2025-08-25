import { performance } from 'perf_hooks';
export class AutoscaledPool {
    constructor(opts, runTask) {
        this.opts = opts;
        this.runTask = runTask;
        this.running = 0;
        this.stopped = false;
        this.lastEventLoopCheck = performance.now();
        this.eventLoopDelays = [];
        this.cpuUsage = 0;
        this.opts.cpuThreshold = this.opts.cpuThreshold ?? 0.8;
        this.opts.eventLoopThreshold = this.opts.eventLoopThreshold ?? 50; // ms
    }
    async start() {
        // Start CPU monitoring
        this.startCpuMonitoring();
        // Start event loop monitoring
        this.startEventLoopMonitoring();
        const tick = async () => {
            if (this.stopped)
                return;
            const canStart = this.canStartNewTask();
            if (canStart) {
                this.running++;
                this.runTask()
                    .catch(() => { })
                    .finally(() => {
                    this.running--;
                });
            }
            setTimeout(tick, this.opts.maybeRunIntervalMs ?? 500);
        };
        // Boot minConcurrency
        for (let i = 0; i < this.opts.minConcurrency; i++) {
            this.running++;
            this.runTask().finally(() => {
                this.running--;
            });
        }
        tick();
    }
    canStartNewTask() {
        // Check if we're at max concurrency
        if (this.running >= this.opts.maxConcurrency)
            return false;
        // Check if system is busy
        if (this.opts.isBusy?.())
            return false;
        // Check CPU usage
        if (this.cpuUsage > this.opts.cpuThreshold)
            return false;
        // Check event loop delays
        if (this.eventLoopDelays.length > 0) {
            const avgDelay = this.eventLoopDelays.reduce((a, b) => a + b, 0) / this.eventLoopDelays.length;
            if (avgDelay > this.opts.eventLoopThreshold)
                return false;
        }
        return true;
    }
    startCpuMonitoring() {
        let lastUsage = process.cpuUsage();
        let lastTime = Date.now();
        setInterval(() => {
            const currentUsage = process.cpuUsage();
            const currentTime = Date.now();
            const timeDiff = currentTime - lastTime;
            const userDiff = currentUsage.user - lastUsage.user;
            const systemDiff = currentUsage.system - lastUsage.system;
            // Calculate CPU usage percentage (rough approximation)
            const totalDiff = userDiff + systemDiff;
            this.cpuUsage = Math.min(1, totalDiff / (timeDiff * 1000)); // Normalize to 0-1
            lastUsage = currentUsage;
            lastTime = currentTime;
        }, 1000);
    }
    startEventLoopMonitoring() {
        setInterval(() => {
            const now = performance.now();
            const delay = now - this.lastEventLoopCheck - 1000; // Should be ~1000ms
            if (delay > 0) {
                this.eventLoopDelays.push(delay);
                // Keep only last 10 measurements
                if (this.eventLoopDelays.length > 10) {
                    this.eventLoopDelays.shift();
                }
            }
            this.lastEventLoopCheck = now;
        }, 1000);
    }
    stop() {
        this.stopped = true;
    }
    getStats() {
        return {
            running: this.running,
            minConcurrency: this.opts.minConcurrency,
            maxConcurrency: this.opts.maxConcurrency,
            cpuUsage: this.cpuUsage,
            eventLoopDelays: this.eventLoopDelays,
            avgEventLoopDelay: this.eventLoopDelays.length > 0
                ? this.eventLoopDelays.reduce((a, b) => a + b, 0) / this.eventLoopDelays.length
                : 0
        };
    }
}
//# sourceMappingURL=autoscale.js.map