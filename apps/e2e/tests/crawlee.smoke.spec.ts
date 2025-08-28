import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

test('Crawlee smoke REAL', async () => {
  const env = { ...process.env, ARGUS_TEST_URL: process.env.ARGUS_TEST_URL || 'https://maps.app.goo.gl/q6Rus1W5HMFsHBb3A',
    ARGUS_BLOCK_RESOURCES: '1' };
  execFileSync('pnpm', ['-C','libs/runner-crawlee','start'], { stdio: 'inherit', env });
  const dir = process.env.CRAWLEE_STORAGE_DIR || 'apps/scraper-playwright/datasets';
  const dataset = path.resolve(dir, 'datasets', 'default');
  const files = fs.existsSync(dataset) ? fs.readdirSync(dataset) : [];
  expect(files.length).toBeGreaterThan(0);
});
