import { createWriteStream, promises as fs } from 'fs';
import { createHash } from 'crypto';
import { dirname } from 'path';
export class RequestQueue {
    constructor(file) {
        this.mem = new Map();
        this.domainCounts = new Map();
        this.maxConcurrencyPerDomain = 2; // Prevent rate limiting
        this.file = file;
    }
    async init() {
        await fs.mkdir(dirname(this.file), { recursive: true });
        this.w = createWriteStream(this.file, { flags: 'a' });
        // Warmup: load existing items from NDJSON
        try {
            const txt = await fs.readFile(this.file, 'utf8');
            for (const line of txt.split('\n')) {
                if (line.trim()) {
                    const it = JSON.parse(line);
                    this.mem.set(it.id, it);
                    this.updateDomainCount(it.domain || 'default', 1);
                }
            }
        }
        catch (error) {
            // File doesn't exist yet, that's fine
        }
    }
    static keyOf(r) {
        return r.uniqueKey ?? createHash('sha1').update(r.url).digest('hex');
    }
    updateDomainCount(domain, delta) {
        const current = this.domainCounts.get(domain) || 0;
        this.domainCounts.set(domain, current + delta);
    }
    async add(r) {
        const id = RequestQueue.keyOf(r);
        // Check if already exists
        if (this.mem.has(id)) {
            const existing = this.mem.get(id);
            // Update if higher priority
            if ((r.priority || 0) > (existing.priority || 0)) {
                existing.priority = r.priority;
                existing.updatedAt = new Date().toISOString();
                this.persistItem(existing);
            }
            return existing;
        }
        const it = {
            ...r,
            id,
            state: 'queued',
            retries: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        this.mem.set(id, it);
        this.persistItem(it);
        return it;
    }
    persistItem(item) {
        this.w.write(JSON.stringify(item) + '\n');
    }
    async fetchNext() {
        // Priority-based selection with domain concurrency limits
        const available = [...this.mem.values()]
            .filter(x => x.state === 'queued')
            .filter(x => {
            const domain = x.domain || 'default';
            const currentCount = this.domainCounts.get(domain) || 0;
            return currentCount < this.maxConcurrencyPerDomain;
        })
            .sort((a, b) => (b.priority || 0) - (a.priority || 0));
        if (available.length === 0)
            return null;
        const next = available[0];
        next.state = 'in-progress';
        next.updatedAt = new Date().toISOString();
        this.updateDomainCount(next.domain || 'default', 1);
        this.persistItem(next);
        return next;
    }
    async markHandled(id) {
        const it = this.mem.get(id);
        if (it) {
            it.state = 'handled';
            it.updatedAt = new Date().toISOString();
            this.updateDomainCount(it.domain || 'default', -1);
            this.persistItem(it);
        }
    }
    async markFailed(id, err) {
        const it = this.mem.get(id);
        if (it) {
            it.state = 'failed';
            it.lastError = err;
            it.updatedAt = new Date().toISOString();
            this.updateDomainCount(it.domain || 'default', -1);
            this.persistItem(it);
        }
    }
    async retry(id) {
        const it = this.mem.get(id);
        if (it && it.state === 'failed') {
            it.state = 'queued';
            it.retries++;
            it.lastError = undefined;
            it.updatedAt = new Date().toISOString();
            this.persistItem(it);
            return it;
        }
        return null;
    }
    getStats() {
        const stats = {
            total: this.mem.size,
            queued: 0,
            inProgress: 0,
            handled: 0,
            failed: 0,
            byDomain: Object.fromEntries(this.domainCounts)
        };
        for (const item of this.mem.values()) {
            if (item.state === 'in-progress') {
                stats.inProgress++;
            }
            else {
                stats[item.state]++;
            }
        }
        return stats;
    }
    async close() {
        if (this.w) {
            this.w.end();
        }
    }
}
//# sourceMappingURL=request-queue.js.map