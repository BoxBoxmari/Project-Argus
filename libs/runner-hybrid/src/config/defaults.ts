export const DEFAULTS = {
  backend: process.env.ARGUS_BACKEND ?? 'mcp',
  locale: process.env.ARGUS_LOCALE ?? 'en-US',
  blockResources: process.env.ARGUS_BLOCK_RESOURCES === '0' ? false : true,
  delayMs: Number(process.env.ARGUS_DELAY_MS ?? 350),
  jitterMs: Number(process.env.ARGUS_JITTER_MS ?? 200),
  backoffBaseMs: Number(process.env.ARGUS_BACKOFF_BASE_MS ?? 500),
  paneTimeoutMs: Number(process.env.ARGUS_PANE_TIMEOUT_MS ?? 15000),
} as const;
