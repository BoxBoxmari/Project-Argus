import { execSync } from 'node:child_process';
import fs from 'node:fs';
function sh(c){ execSync(c,{stdio:'inherit'}); }
try {
  sh('pnpm -r run build');
  // compute next rc
  const last = execSync('git tag --list "v0.1.0-rc.*" | sort -V | tail -n1').toString().trim();
  const next = last ? `v0.1.0-rc.${Number(last.split('.').pop())+1}` : 'v0.1.0-rc.1';
  if (!fs.existsSync('RELEASE_NOTES.md')) fs.writeFileSync('RELEASE_NOTES.md','# Release Notes\n');
  sh(`git add -A && git commit -m "chore(release): ${next}" || echo "no changes"`);
  sh(`git tag -a ${next} -m "Release Candidate ${next}"`);
  console.log('Tagged', next);
} catch (e) { console.error(e); process.exit(1); }
