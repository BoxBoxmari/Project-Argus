import { runMcpChrome } from './mcp';
import { runCrawlee } from './pw_crawlee';
import { runUserscriptHarness } from './userscript_harness';
import { DEFAULT_CONFIG } from './config/defaults';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const backend = (process.env.ARGUS_BACKEND || DEFAULT_CONFIG.backend).toLowerCase();
const outDir = process.env.ARGUS_OUT_DIR || 'results/hybrid';
mkdirSync(outDir, { recursive: true });

async function main(){
  const startUrls = (process.env.ARGUS_START_URLS || '').split(',').filter(Boolean);
  const url = startUrls[0] || process.env.ARGUS_TEST_URL || 'https://www.google.com/maps';
  const opts = {
    block: process.env.ARGUS_BLOCK_RESOURCES === '1' ? true : DEFAULT_CONFIG.blockResources,
    locale: process.env.ARGUS_LOCALE || DEFAULT_CONFIG.locale,
    headful: process.env.ARGUS_HEADFUL === '1' ? true : DEFAULT_CONFIG.headful
  };

  let out;
  if (backend === 'mcp') out = await runMcpChrome(url, opts);
  else if (backend === 'crawlee') out = await runCrawlee(url, opts);
  else out = await runUserscriptHarness(url, opts);

  const ts = Date.now();
  const base = path.join(outDir, `metrics.${backend}.${ts}.json`);
  writeFileSync(base, JSON.stringify(out.metrics, null, 2));
  if (out.dataset) writeFileSync(path.join(outDir, `data.${backend}.${ts}.json`), JSON.stringify(out.dataset, null, 2));
  console.log('[hybrid] done', backend, base);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
