import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { promises as fs } from 'node:fs';
import { collectGmapsReviews } from './gmaps.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const appRoot    = dirname(__dirname); // dist -> app root
const dsDir      = join(appRoot, 'datasets');
const artDir     = join(dsDir, 'artifacts');

async function ensureDirs() {
  await fs.mkdir(dsDir, { recursive: true });
  await fs.mkdir(artDir, { recursive: true });
}

function getSeeds(): string[] {
  const env = (process.env.ARGUS_SEED_URLS || '').trim();
  if (env) return env.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  return [];
}

function stableReviewKey(r: any): string {
  return r.id || `${r.author}|${r.date}|${r.text}`;
}

async function loadExistingKeysForUrl(url: string): Promise<Set<string>> {
  const file = join(dsDir, 'reviews.ndjson');
  const keys = new Set<string>();
  try {
    const buf = await fs.readFile(file, 'utf8');
    for (const line of buf.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (row.url !== url) continue;
        const reviews = Array.isArray(row.reviews) ? row.reviews : [];
        for (const r of reviews) keys.add(stableReviewKey(r));
      } catch {}
    }
  } catch {}
  return keys;
}

async function saveNdjson(record: any) {
  await fs.appendFile(join(dsDir, 'reviews.ndjson'), JSON.stringify(record) + '\n', 'utf8');
}

async function saveArtifacts(page, url: string, tag='0') {
  const safe = url.replace(/[^a-z0-9]+/gi, '_').slice(0, 180);
  await fs.writeFile(join(artDir, `${safe}_${tag}.html`), await page.content(), 'utf8').catch(()=>{});
  await page.screenshot({ path: join(artDir, `${safe}_${tag}.png`), fullPage: true }).catch(()=>{});
}

async function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  await ensureDirs();
  const seeds = getSeeds();
  console.log(JSON.stringify({ t:'boot', seeds: seeds.length, preview: seeds[0]?.slice(0,160) ?? '' }));

  if (!seeds.length) {
    console.log('[Argus] No queued items. Check ARGUS_SEED_URLS or datasets/queue.ndjson');
    return;
  }

  const headful = !!process.env.ARGUS_HEADFUL;
  const interDelayMs = Number(process.env.ARGUS_RATE_DELAY_MS || 0) || 0;
  const browser = await chromium.launch({
    headless: !headful,
    args: ['--disable-blink-features=AutomationControlled','--no-sandbox','--disable-dev-shm-usage']
  });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();

  for (const url of seeds) {
    console.log(JSON.stringify({ t:'task-start', url }));
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(()=>{});

    const existingKeys = await loadExistingKeysForUrl(url);
    const result = await collectGmapsReviews(page, { maxItems: Number(process.env.ARGUS_MAX_REVIEWS || '0') || undefined });

    // Filter out duplicates against existing
    const filtered = (result.reviews || []).filter(r => !existingKeys.has(stableReviewKey(r)));

    await saveArtifacts(page, url);
    await saveNdjson({ url, ts: Date.now(), reviews: filtered, store: result.store, status: result.status });
    console.log(JSON.stringify({ t:'task-ok', url, n: filtered.length, status: result.status }));

    if (interDelayMs > 0) await delay(interDelayMs);
  }

  console.log(JSON.stringify({ t:'queue-drained' }));
  await browser.close();
}

run().catch(e=>{ console.error(e); process.exit(1); });
