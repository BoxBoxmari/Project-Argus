import fs from 'node:fs'; import path from 'node:path';
const id = process.env.SPIKE_ID || 'SPIKE-UNKNOWN';
const dst = path.join('archive','spikes', id); fs.mkdirSync(dst,{recursive:true});
const files = [
  ['metrics/perf.baseline.detail.json','baseline.detail.json'],
  ['metrics/perf.spike.txt','improve.txt'],
  ['results/ab/ab.results.json','ab.results.json']
].filter(([s])=>fs.existsSync(s));
for (const [s, n] of files) fs.copyFileSync(s, path.join(dst, n));
fs.writeFileSync(path.join(dst,'README.md'),
`# ${id}
- Archived at: ${new Date().toISOString()}
- Files: ${files.map(([,n])=>n).join(', ')}
`);
console.log('spike archived:', dst);
