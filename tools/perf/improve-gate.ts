import fs from 'node:fs';
const base = JSON.parse(fs.readFileSync('metrics/perf.baseline.detail.json','utf8'));
const IMPROVE = Number(process.env.IMPROVE_MIN || 0.10); // 10%
const TARGET = (process.env.SPIKE_TARGET || 'open_ms').toLowerCase(); // open_ms|pane_ms
const CUR = JSON.parse(fs.readFileSync('results/ab/ab.results.json','utf8')); // dùng như tín hiệu chạy xong
// Tải lại metrics sau spike
const cur = JSON.parse(fs.readFileSync('metrics/perf.baseline.detail.json','utf8'));
const b = base.stats?.mcp || base.stats?.crawlee || Object.values(base.stats||{})[0];
const c = cur.stats?.mcp || cur.stats?.crawlee || Object.values(cur.stats||{})[0];
if (!b || !c) { console.error('missing stats'); process.exit(2); }
const key = TARGET==='pane_ms' ? 'p95_pane_ms' : 'p95_open_ms';
const baseV = Number(b[key]||0), curV = Number(c[key]||0);
const need = baseV * (1 - IMPROVE);
const ok = baseV>0 && curV <= need;
const line = `target=${key} base=${baseV} current=${curV} need<=${need.toFixed(2)} improve_min=${IMPROVE*100}% ok=${ok}`;
fs.writeFileSync('metrics/perf.spike.txt', line+'\n');
if (!ok) { console.error('improvement gate failed:', line); process.exit(3); }
console.log('improvement gate OK:', line);
