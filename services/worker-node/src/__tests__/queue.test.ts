import { jest } from '@jest/globals';

// Mock ioredis to avoid real Redis connections
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({}));
});

// Capture add calls and simulate worker behaviour
const addMock = jest.fn();

class MockWorker extends (require('events').EventEmitter) {
  private processor: (job: any) => Promise<void> | void;
  constructor(_name: string, processor: (job: any) => Promise<void> | void) {
    super();
    this.processor = processor;
  }
  async process(data: any) {
    const job = { id: 'test-job', data };
    await this.processor(job);
    this.emit('completed', job);
  }
}

class MockQueue {
  add = addMock;
}
class MockQueueScheduler {}

jest.mock('bullmq', () => ({
  Queue: MockQueue,
  Worker: MockWorker,
  QueueScheduler: MockQueueScheduler
}));

import { enqueueReviewJob, startWorker } from '../queue';

describe('enqueueReviewJob', () => {
  beforeEach(() => addMock.mockClear());

  it('sets jobId and retry/backoff options correctly', async () => {
    addMock.mockResolvedValue({ id: 'returned-id' });
    const payload = { placeId: 'abc', cursor: '123' };
    await enqueueReviewJob(payload);
    expect(addMock).toHaveBeenCalledWith(
      'collect',
      payload,
      expect.objectContaining({
        jobId: 'reviews:abc:123',
        attempts: 5,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 1000,
        removeOnFail: 1000
      })
    );
  });
});

describe('startWorker', () => {
  it('invokes handler and emits completed events', async () => {
    const handler = jest.fn();
    const worker = startWorker(async data => handler(data));
    const completedSpy = jest.fn();
    worker.on('completed', completedSpy);
    await (worker as any).process({ foo: 'bar' });
    expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    expect(completedSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'test-job' }));
  });
});
