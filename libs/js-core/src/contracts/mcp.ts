// Minimal MCP-like contracts (no external deps)
export type ToolName = 'start_run' | 'enqueue' | 'get_metrics' | 'dump_artifacts';
export interface ToolCall<T> { tool: ToolName; input: T; correlationId?: string; }
export interface ToolResult<T> { ok: boolean; output?: T; error?: { code: string; msg: string }; }
export interface StartRunInput { runId: string; seedUrls: string[]; }
export interface EnqueueInput { urls: string[]; priority?: number; dedupeKey?: string; }
export interface Metrics { queued: number; inFlight: number; done: number; failed: number; p95LatencyMs: number; }