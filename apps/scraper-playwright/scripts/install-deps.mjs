import { spawnSync } from 'node:child_process';
const isLinux = process.platform === 'linux';
if (!isLinux) {
  console.log('[deps] Non-Linux host, skip playwright install-deps. If CI ubuntu-latest, this runs there.');
  process.exit(0);
}
const r = spawnSync('pnpm', ['exec', 'playwright', 'install-deps'], { stdio: 'inherit' });
process.exit(r.status ?? 0);
