import { test, expect } from '@playwright/test';
const backends = (process.env.AB_BACKENDS || 'mcp,crawlee').split(',');
for (const b of backends) {
  test(`[stable] AB final ${b}`, async ({}) => {
    const { spawnSync } = await import('node:child_process');
    const env = { ...process.env, ARGUS_BACKEND: b, ARGUS_BLOCK_RESOURCES: '1' };
    const r = spawnSync('pnpm', ['run','hybrid:start'], { env, shell:true });
    expect(r.status).toBe(0);
  });
}
