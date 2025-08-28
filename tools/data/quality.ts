import fs from 'node:fs'; import path from 'node:path';
console.log('Starting data quality script');
const dir = process.env.CRAWLEE_STORAGE_DIR || 'apps/scraper-playwright/datasets/datasets/default';
console.log('Looking for data in directory:', dir);
let rows:any[] = [];
if (fs.existsSync(dir)) {
  console.log('Directory exists');
  const files = fs.readdirSync(dir).filter(f=>f.endsWith('.json') || f.endsWith('.ndjson'));
  console.log('Found files:', files);
  rows = files.flatMap(f=> {
    const content = fs.readFileSync(path.join(dir,f),'utf8');
    console.log(`Processing file ${f}, content length: ${content.length}`);
    // Handle both JSON arrays and NDJSON files
    if (f.endsWith('.json')) {
      console.log(`Parsing ${f} as JSON array`);
      return JSON.parse(content);
    } else {
      // NDJSON - one JSON object per line
      console.log(`Parsing ${f} as NDJSON`);
      return content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
    }
  });
  console.log(`Processed ${rows.length} rows`);
} else {
  console.log('Directory does not exist');
}
const total = rows.length;
console.log(`Total rows: ${total}`);
const uniq = new Set(rows.map(r=>r.id)).size;
console.log(`Unique rows: ${uniq}`);
const dupRate = total ? (1 - uniq/total) : 0;
const nullAuthor = rows.filter(r=>!r.author || !String(r.author).trim()).length / (total||1);
const emptyText = rows.filter(r=>!r.text || !String(r.text).trim()).length / (total||1);
const piiLeak = rows.filter(r=>/\[redacted-(email|phone)\]/.test(r.text)===false && /@|(?:\+?\d[\d\s\-]{6,})/.test(r.text||'')).length / (total||1);

const lines = [
  '# DATA QUALITY REPORT',
  `total: ${total}`,
  `dupRate: ${(dupRate*100).toFixed(2)}%`,
  `null_author_rate: ${(nullAuthor*100).toFixed(2)}%`,
  `empty_text_rate: ${(emptyText*100).toFixed(2)}%`,
  `pii_leak_rate: ${(piiLeak*100).toFixed(2)}%`
].join('\n');
console.log('Writing report to DATA_QUALITY_REPORT.md');
fs.writeFileSync('DATA_QUALITY_REPORT.md', lines + '\n');
console.log('Report written successfully');

// Exit codes for CI gates
const ok = dupRate < 0.01 && piiLeak === 0;
console.log(`dupRate: ${dupRate}, piiLeak: ${piiLeak}, ok: ${ok}`);
process.exitCode = ok ? 0 : 1;
