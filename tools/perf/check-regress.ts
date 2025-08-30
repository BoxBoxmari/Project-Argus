import fs from 'node:fs'; import path from 'node:path';

const baseline = JSON.parse(fs.readFileSync('metrics/perf.baseline.json','utf8'));
const currentPath = 'results/ab/ab.results.json';
if (!fs.existsSync(currentPath)) { console.error('no current A/B results'); process.exit(1); }
const current = JSON.parse(fs.readFileSync(currentPath,'utf8'));

function p(v:number[], q:number){ if (v.length===0) return 0; const s=[...v].sort((a,b)=>a-b); const i=Math.floor((s.length-1)*q); return s[i]; }
function backendStats(rows:any[]){ const d = rows.map((r:any)=> r.ok ? 1 : 2); return { p95: p(d,0.95), n: d.length }; }

const backends = Array.from(new Set(current.map((r:any)=>r.backend)));
let failed = false; const lines:string[] = [];
for (const b of backends) {
  const cur = backendStats(current.filter((r:any)=>r.backend===b));
  const base = baseline.stats?.[b]?.p95 ?? 0;
  const limit = base * 1.10; // +10%
  const ok = base === 0 ? true : cur.p95 <= limit;
  lines.push(`${b}: base_p95=${base} cur_p95=${cur.p95} limit=${limit} ok=${ok}`);
  if (!ok) failed = true;
}
fs.writeFileSync('metrics/perf.check.txt', lines.join('\n')+'\n');
if (failed) { console.error('perf regression detected'); process.exit(2); }
console.log('perf check OK');
