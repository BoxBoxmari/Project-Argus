export type Event =
    | { t: 'queue.enqueued'; n: number }
    | { t: 'task.start'; url: string }
    | { t: 'task.done'; url: string; ms: number }
    | { t: 'task.fail'; url: string; err: string }
    | { t: 'metrics'; queued: number; inFlight: number; done: number; failed: number; p95: number };
export class EventBus {
    private out: NodeJS.WritableStream;
    constructor(out: NodeJS.WritableStream = process.stdout) { this.out = out; }
    emit(e: Event) { this.out.write(JSON.stringify({ ts: Date.now(), ...e }) + '\n'); }
}