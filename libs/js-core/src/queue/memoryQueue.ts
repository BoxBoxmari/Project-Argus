export interface QueueItem { url: string; key: string; priority: number; retries: number; addedAt: number; }
export class MemoryQueue {
    private q: QueueItem[] = [];
    private seen = new Set<string>();
    enqueue(urls: string[], priority = 0) {
        for (const url of urls) {
            const key = new URL(url).toString();
            if (this.seen.has(key)) continue;
            this.seen.add(key);
            this.q.push({ url, key, priority, retries: 0, addedAt: Date.now() });
        }
        this.q.sort((a, b) => b.priority - a.priority || a.addedAt - b.addedAt);
    }
    dequeue(batch = 1) { return this.q.splice(0, batch); }
    size() { return this.q.length; }
    has(key: string) { return this.seen.has(key); }
}