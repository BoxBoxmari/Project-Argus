import { execSync } from 'node:child_process';
import fs from 'node:fs';
function sh(c){ execSync(c,{stdio:'inherit'}); }
try {
  sh('pnpm -r run build');
  // Tag as v0.1.0 GA
  const version = 'v0.1.0';
  if (!fs.existsSync('RELEASE_NOTES.md')) fs.writeFileSync('RELEASE_NOTES.md','# Release Notes\n');
  sh(`git add -A && git commit -m "chore(release): ${version}" || echo "no changes"`);
  sh(`git tag -a ${version} -m "General Availability ${version}"`);
  console.log('Tagged', version);
} catch (e) { console.error(e); process.exit(1); }