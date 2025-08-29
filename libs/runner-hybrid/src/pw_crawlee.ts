import { execFileSync } from 'node:child_process';

type Opts = {
  block: boolean;
  locale: string;
  headful: boolean;
  delayMs: number;
  jitterMs: number;
  backoffBaseMs: number;
  paneTimeoutMs: number;
};

export async function runCrawlee(url:string, opts:Opts){
  const env = {
    ...process.env,
    ARGUS_START_URLS: url,
    ARGUS_LOCALE: opts.locale,
    ARGUS_BLOCK_RESOURCES: opts.block ? '1' : '0',
    ARGUS_DELAY_MS: opts.delayMs.toString(),
    ARGUS_JITTER_MS: opts.jitterMs.toString(),
    ARGUS_BACKOFF_BASE_MS: opts.backoffBaseMs.toString(),
    ARGUS_PANE_TIMEOUT_MS: opts.paneTimeoutMs.toString()
  };

  const t0 = Date.now();
  try {
    execFileSync('pnpm', ['-C','libs/runner-crawlee','start'], { stdio: 'inherit', env });
  } catch {}
  const open_ms = Date.now() - t0;
  // Lấy metrics đã được libs/runner-crawlee ghi (nếu có), đơn giản hoá ở đây
  return { metrics: { open_ms, pane_ms: 0 }, dataset: null };
}
