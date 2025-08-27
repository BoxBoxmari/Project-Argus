import { createWriteStream, promises as fs } from 'fs';
import { createHash } from 'crypto';
import { dirname } from 'path';

export type Req = { url: string; method?: string; userData?: any; uniqueKey?: string; priority?: number; domain?: string };
type State = 'queued' | 'in-progress' | 'handled' | 'failed';
type Item = Req & { id: string; state: State; retries: number; lastError?: string; createdAt?: Date; updatedAt?: Date };
export type QueueStats = { total: number; queued: number; inProgress: number; handled: number; failed: number };
type Opts = { resetOnStart?: boolean };

export class RequestQueue {
  private file: string; private w: any; private opts: Opts;
  private items = new Map<string, Item>();
  private _stats: QueueStats = { total: 0, queued: 0, inProgress: 0, handled: 0, failed: 0 };

  constructor(file: string, opts: Opts = {}) { this.file = file; this.opts = opts; }

  async init() {
    await fs.mkdir(dirname(this.file), { recursive: true });
    if (this.opts.resetOnStart) { try { await fs.writeFile(this.file, ''); } catch { } }
    this.w = createWriteStream(this.file, { flags: 'a' });
    try {
      const txt = await fs.readFile(this.file, 'utf8');
      for (const line of txt.split('\n')) if (line) {
        const it: Item = JSON.parse(line);
        this.items.set(it.id, it);
        this._stats.total++;
        if (it.state === 'queued') this._stats.queued++;
        else if (it.state === 'in-progress') this._stats.inProgress++;
        else if (it.state === 'handled') this._stats.handled++;
        else if (it.state === 'failed') this._stats.failed++;
      }
    } catch { }
  }

  private static keyOf(r: Req) { return r.uniqueKey ?? createHash('sha1').update(r.url).digest('hex'); }

  async add(r: Req) {
    const id = RequestQueue.keyOf(r);
    const existed = this.items.get(id);
    if (existed) {
      if ((r.priority ?? 0) > (existed.priority ?? 0)) {
        existed.priority = r.priority;
        this.w.write(JSON.stringify(existed) + '\n');
      }
      return existed;
    }
    const now = new Date();
    const it: Item = { ...r, id, state: 'queued', retries: 0, createdAt: now, updatedAt: now };
    this.items.set(id, it);
    this._stats.total++;
    this._stats.queued++;
    this.w.write(JSON.stringify(it) + '\n');
    return it;
  }

  async addOrRequeue(r: Req) {
    const id = RequestQueue.keyOf(r);
    const existed = this.items.get(id);
    if (existed) {
      existed.state = 'queued';
      existed.retries = 0;
      existed.lastError = undefined;
      if ((r.priority ?? 0) > (existed.priority ?? 0)) existed.priority = r.priority;
      this.w.write(JSON.stringify(existed) + '\n');
      return existed;
    }
    return this.add(r);
  }

  async fetchNext() {
    const next = [...this.items.values()].filter(x => x.state === 'queued')
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))[0];
    if (!next) return null;

    const updatedItem = {
      ...next,
      state: 'in-progress' as const,
      updatedAt: new Date()
    };

    this.items.set(next.id, updatedItem);
    this._stats.queued--;
    this._stats.inProgress++;

    this.w.write(JSON.stringify(updatedItem) + '\n');
    return updatedItem;
  }

  async markHandled(id: string) {
    const it = this.items.get(id);
    if (it) {
      const updatedItem = {
        ...it,
        state: 'handled' as const,
        updatedAt: new Date()
      };

      this.items.set(id, updatedItem);
      this._stats.handled++;
      this._stats.queued--;
      this.w.write(JSON.stringify(updatedItem) + '\n');
    }
  }

  async markFailed(id: string, err: string) {
    const it = this.items.get(id);
    if (it) {
      const updatedItem = {
        ...it,
        state: 'failed' as const,
        lastError: err,
        updatedAt: new Date()
      };

      this.items.set(id, updatedItem);
      this._stats.failed++;
      this._stats.queued--;
      this.w.write(JSON.stringify(updatedItem) + '\n');
    }
  }

  async retry(id: string): Promise<Item | undefined> {
    const item = this.items.get(id);
    if (!item) return undefined;

    // Reset state and increment retries
    const now = new Date();
    const updatedItem = {
      ...item,
      state: 'queued' as const,
      retries: item.retries + 1,
      updatedAt: now,
      lastError: undefined
    };

    this.items.set(id, updatedItem);
    this._stats.queued++;
    this._stats.failed--;

    this.w.write(JSON.stringify(updatedItem) + '\n');
    return updatedItem;
  }

  getStats(): QueueStats {
    return { ...this._stats };
  }

  async close() { await new Promise<void>(res => { try { this.w?.end(() => res()); } catch { res(); } }); }

  private async persist() {
    try {
      await fs.writeFile(this.file, [...this.items.values()].map(it => JSON.stringify(it)).join('\n'));
    } catch (error) {
      console.error('Failed to persist queue:', error);
    }
  }
}
