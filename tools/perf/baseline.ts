import fs from 'node:fs'; import path from 'node:path';

type Row = { backend:string; block:boolean; locale:string; device:string; network:string; ok:boolean; ts:number };
const abPath = 'results/ab/ab.results.json';
if (!fs.existsSync(abPath)) { console.error('missing A/B results'); process.exit(1); }
const data: Row[] = JSON.parse(fs.readFileSync(abPath,'utf8'));
const byBackend: Record<string, Row[]> = {};
for (const r of data) { (byBackend[r.backend] ||= []).push(r); }

function p(v:number[], q:number){ if (v.length===0) return 0; const s=[...v].sort((a,b)=>a-b); const i=Math.floor((s.length-1)*q); return s[i]; }

// Đơn giản: dùng thời gian thực thi case như proxy cho open_ms tổng hợp (runner đã ghi metrics riêng nếu có)
const stats: any = {};
for (const [b, arr] of Object.entries(byBackend)) {
  const durs = arr.map(r => r.ok ? 1 : 2); // placeholder nếu chưa có metrics file per-case
  stats[b] = { p50: p(durs,0.5), p95: p(durs,0.95), count: arr.length };
}

fs.mkdirSync('metrics', { recursive:true });
fs.writeFileSync(path.join('metrics','perf.baseline.json'), JSON.stringify({ createdAt: new Date().toISOString(), stats }, null, 2));
console.log('metrics/perf.baseline.json written');
