import { RequestQueue, Req } from '../request-queue';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('RequestQueue', () => {
  let queue: RequestQueue;
  let tempFile: string;

  beforeEach(async () => {
    tempFile = join(tmpdir(), `test-queue-${Date.now()}.ndjson`);
    queue = new RequestQueue(tempFile);
    await queue.init();
  });

  afterEach(async () => {
    await queue.close();
    try {
      await fs.unlink(tempFile);
    } catch {
      // File might not exist
    }
  });

  describe('add', () => {
    it('should add new requests with unique IDs', async () => {
      const req: Req = { url: 'https://example.com' };
      const item = await queue.add(req);

      expect(item.id).toBeDefined();
      expect(item.url).toBe(req.url);
      expect(item.state).toBe('queued');
      expect(item.retries).toBe(0);
      expect(item.createdAt).toBeDefined();
      expect(item.updatedAt).toBeDefined();
    });

    it('should use custom uniqueKey if provided', async () => {
      const req: Req = { 
        url: 'https://example.com', 
        uniqueKey: 'custom-key-123' 
      };
      const item = await queue.add(req);

      expect(item.id).toBe('custom-key-123');
    });

    it('should not duplicate requests with same uniqueKey', async () => {
      const req1: Req = { 
        url: 'https://example.com', 
        uniqueKey: 'same-key' 
      };
      const req2: Req = { 
        url: 'https://different.com', 
        uniqueKey: 'same-key' 
      };

      const item1 = await queue.add(req1);
      const item2 = await queue.add(req2);

      expect(item1.id).toBe(item2.id);
      expect(item1.url).toBe(req1.url); // Should keep first URL
    });

    it('should update priority for existing requests', async () => {
      const req1: Req = { 
        url: 'https://example.com', 
        uniqueKey: 'test-key',
        priority: 1
      };
      const req2: Req = { 
        url: 'https://example.com', 
        uniqueKey: 'test-key',
        priority: 10
      };

      await queue.add(req1);
      const item2 = await queue.add(req2);

      expect(item2.priority).toBe(10);
    });
  });

  describe('fetchNext', () => {
    it('should return null when no queued items', async () => {
      const next = await queue.fetchNext();
      expect(next).toBeNull();
    });

    it('should return queued items in priority order', async () => {
      const req1: Req = { url: 'https://example1.com', priority: 1 };
      const req2: Req = { url: 'https://example2.com', priority: 10 };
      const req3: Req = { url: 'https://example3.com', priority: 5 };

      await queue.add(req1);
      await queue.add(req2);
      await queue.add(req3);

      const next = await queue.fetchNext();
      expect(next?.priority).toBe(10);
      expect(next?.state).toBe('in-progress');
    });

    it('should respect domain concurrency limits', async () => {
      const req1: Req = { url: 'https://example.com/page1', domain: 'example.com' };
      const req2: Req = { url: 'https://example.com/page2', domain: 'example.com' };
      const req3: Req = { url: 'https://example.com/page3', domain: 'example.com' };

      await queue.add(req1);
      await queue.add(req2);
      await queue.add(req3);

      // First two should be fetchable
      const next1 = await queue.fetchNext();
      const next2 = await queue.fetchNext();
      expect(next1).toBeDefined();
      expect(next2).toBeDefined();

      // Third should not be fetchable due to domain limit
      const next3 = await queue.fetchNext();
      expect(next3).toBeNull();
    });
  });

  describe('state management', () => {
    it('should mark items as handled', async () => {
      const req: Req = { url: 'https://example.com' };
      const item = await queue.add(req);
      
      await queue.markHandled(item.id);
      
      const stats = queue.getStats();
      expect(stats.handled).toBe(1);
      expect(stats.queued).toBe(0);
    });

    it('should mark items as failed', async () => {
      const req: Req = { url: 'https://example.com' };
      const item = await queue.add(req);
      
      await queue.markFailed(item.id, 'Test error');
      
      const stats = queue.getStats();
      expect(stats.failed).toBe(1);
      expect(stats.queued).toBe(0);
    });

    it('should retry failed items', async () => {
      const req: Req = { url: 'https://example.com' };
      const item = await queue.add(req);
      
      await queue.markFailed(item.id, 'Test error');
      const retried = await queue.retry(item.id);
      
      expect(retried).toBeDefined();
      expect(retried?.state).toBe('queued');
      expect(retried?.retries).toBe(1);
      expect(retried?.lastError).toBeUndefined();
    });
  });

  describe('persistence', () => {
    it('should persist items to NDJSON file', async () => {
      const req: Req = { url: 'https://example.com' };
      await queue.add(req);
      
      await queue.close();
      
      const content = await fs.readFile(tempFile, 'utf8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(1);
      
      const parsed = JSON.parse(lines[0]);
      expect(parsed.url).toBe('https://example.com');
    });

    it('should load existing items on init', async () => {
      const req: Req = { url: 'https://example.com' };
      await queue.add(req);
      
      await queue.close();
      
      // Create new queue instance
      const newQueue = new RequestQueue(tempFile);
      await newQueue.init();
      
      const stats = newQueue.getStats();
      expect(stats.total).toBe(1);
      
      await newQueue.close();
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', async () => {
      const req1: Req = { url: 'https://example1.com' };
      const req2: Req = { url: 'https://example2.com' };
      
      await queue.add(req1);
      await queue.add(req2);
      
      const stats = queue.getStats();
      expect(stats.total).toBe(2);
      expect(stats.queued).toBe(2);
      expect(stats.inProgress).toBe(0);
      expect(stats.handled).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });
});
