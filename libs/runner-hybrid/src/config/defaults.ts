export const DEFAULTS = {
  backend: process.env.ARGUS_BACKEND ?? 'mcp',
  locale: process.env.ARGUS_LOCALE ?? 'en-US',
  blockResources: (process.env.PERF_MODE ?? '1') === '1',
  delayMs: Number(process.env.ARGUS_DELAY_MS ?? 350),
  jitterMs: Number(process.env.ARGUS_JITTER_MS ?? 200),
  backoffBaseMs: Number(process.env.ARGUS_BACKOFF_BASE_MS ?? 500),
  paneTimeoutMs: Number(process.env.ARGUS_PANE_TIMEOUT_MS ?? 15000),
  budgets: {
    sim: { p95_open_ms: 3500, p95_pane_ms: 3500 },
    real: { p95_open_ms: 2000, p95_pane_ms: 15000 } // thực địa khoan dung hơn, có timeout guard
  }
} as const;
