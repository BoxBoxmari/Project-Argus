import fs from 'node:fs'; import path from 'node:path';
const DAYS = Number(process.env.ARGUS_TTL_DAYS || 14);
const NOW = Date.now(); const MS = 24*60*60*1000;
const targets = [
  'apps/scraper-playwright/datasets/datasets/default',
  'apps/e2e/reports',
  'apps/e2e/metrics',
  'e2e-report'
];
let removed = [];
function purge(dir:string){
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    const tooOld = (NOW - st.mtimeMs) > DAYS*MS;
    if (st.isDirectory()) purge(p);
    else if (tooOld) { fs.rmSync(p, {force:true}); removed.push(p); }
  }
}
targets.forEach(purge);
fs.writeFileSync('RETENTION_REPORT.md', `# Retention Report\nTTL days: ${DAYS}\nRemoved:\n${removed.map(x=>'- '+x).join('\n')}\n`);
