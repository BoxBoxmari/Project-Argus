import { test, expect } from '@playwright/test';
import fs from 'node:fs'; import path from 'node:path';
test('REAL load & dup rate', async () => {
  process.env.ARGUS_START_URLS = process.env.ARGUS_START_URLS || (process.env.ARGUS_TEST_URL||'').repeat(1);
  process.env.ARGUS_BLOCK_RESOURCES = '1';
  await test.step('run crawlee', async () => {
    const { execFileSync } = await import('node:child_process');
    execFileSync('pnpm', ['-C','libs/runner-crawlee','start'], { stdio:'inherit', env: process.env as any });
  });
  const dir = process.env.CRAWLEE_STORAGE_DIR || 'apps/scraper-playwright/datasets';
  const dataset = path.resolve(dir, 'datasets', 'default');
  const files = fs.readdirSync(dataset).filter(f=>f.endsWith('.json'));
  const rows = files.flatMap(f=>JSON.parse(fs.readFileSync(path.join(dataset,f),'utf8')));
  const total = rows.length; const unique = new Set(rows.map(r=>r.id)).size;
  const dupRate = total ? (1 - unique/total) : 0;
  console.log({ total, unique, dupRate });
  expect(dupRate).toBeLessThan(0.01);
});
