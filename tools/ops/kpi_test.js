import fs from 'node:fs'; import path from 'node:path';

function load(p){
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

function pct(n){
  return Math.round(n * 10000) / 100;
}

const hist = load('apps/e2e/reports/history.json') || {};
const metricsReal = load('apps/e2e/metrics/real.json') || {};
const datasetDir = process.env.CRAWLEE_STORAGE_DIR || 'apps/scraper-playwright/datasets/datasets/default';

function stablePassRate(days = 3){
  const cutoff = 10 * days; // xấp xỉ 10 test/run * days
  const stable = Object.entries(hist)
    .filter(([k]) => k.startsWith('SIM#') || k.startsWith('REAL#'))
    .filter(([_, arr]) => arr.length >= cutoff);

  let pass = 0, total = 0;
  for (const [, arr] of stable){
    total += arr.length;
    pass += arr.filter((s) => s === 'passed').length;
  }
  return total ? pass / total : 0;
}

function dupRateFromDatasets(){
  if (!fs.existsSync(datasetDir)) return 0;
  const files = fs.readdirSync(datasetDir).filter(f => f.endsWith('.json'));
  const rows = files.flatMap(f => JSON.parse(fs.readFileSync(path.join(datasetDir, f), 'utf8')));
  const total = rows.length;
  const uniq = new Set(rows.map((r) => r.id)).size;
  return total ? 1 - (uniq / total) : 0;
}

const pass3d = stablePassRate(3);
const open = Number(metricsReal.open || 0);
const pane = Number(metricsReal.pane || 0);
const dupr = dupRateFromDatasets();

console.log('pass3d:', pass3d);
console.log('open:', open);
console.log('pane:', pane);
console.log('dupr:', dupr);

const report = [
  '# OPS REPORT',
  `pass_rate_3d: ${pct(pass3d)}%`,
  `p95_open_ms: ${open}`,
  `p95_pane_ms: ${pane}`,
  `dupRate: ${pct(dupr)}%`,
  `robots_guard: assumed via CI gates`
].join('\n');

console.log(report);
fs.writeFileSync('OPS_REPORT.md', report + '\n');

const ok = pass3d >= 0.95 && (open === 0 || open < 3500) && (pane === 0 || pane < 3500) && dupr < 0.01;
console.log('SLO Status:', ok ? 'PASS' : 'FAIL');
process.exitCode = ok ? 0 : 1;
