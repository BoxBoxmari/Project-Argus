import fs from 'node:fs'; import path from 'node:path';
const dir = process.env.CRAWLEE_STORAGE_DIR || 'apps/scraper-playwright/datasets/datasets/default';
const out = process.env.ARGUS_EXPORT || 'export/reviews.safe.jsonl';
fs.mkdirSync(path.dirname(out), { recursive: true });
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f=>f.endsWith('.json')) : [];
const rows = files.flatMap(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
const leak = rows.filter((r:any)=>/@/.test(r.text||'') || /\+?\d[\d\-\s]{6,}/.test(r.text||'')).length;
if (leak>0 && process.env.ARGUS_FAIL_ON_PII==='1') {
  console.error('PII leak detected in dataset'); process.exit(1);
}
for (const r of rows) {
  const { id, authorHash, author, rating, text, lang } = r;
  const row:any = { id, authorHash, rating, text, lang };
  if (process.env.ARGUS_INCLUDE_AUTHOR==='1') row.author = author;
  fs.appendFileSync(out, JSON.stringify(row) + '\n');
}
console.log('written', out);
