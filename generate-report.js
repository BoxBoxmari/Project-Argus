import fs from 'node:fs';
import path from 'node:path';

console.log('Generating data quality report');

const dir = 'apps/scraper-playwright/datasets/datasets/default';
let rows = [];

if (fs.existsSync(dir)) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') || f.endsWith('.ndjson'));
  rows = files.flatMap(f => {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    // Handle both JSON arrays and NDJSON files
    if (f.endsWith('.json')) {
      return JSON.parse(content);
    } else {
      // NDJSON - one JSON object per line
      return content.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
    }
  });
}

const total = rows.length;
const uniq = new Set(rows.map(r => r.id)).size;
const dupRate = total ? (1 - uniq/total) : 0;
const nullAuthor = rows.filter(r => !r.author || !String(r.author).trim()).length / (total||1);
const emptyText = rows.filter(r => !r.text || !String(r.text).trim()).length / (total||1);
const piiLeak = rows.filter(r => /\[redacted-(email|phone)\]/.test(r.text)===false && /@|(?:\+?\d[\d\s\-]{6,})/.test(r.text||'')).length / (total||1);

const lines = [
  '# DATA QUALITY REPORT',
  `total: ${total}`,
  `dupRate: ${(dupRate*100).toFixed(2)}%`,
  `null_author_rate: ${(nullAuthor*100).toFixed(2)}%`,
  `empty_text_rate: ${(emptyText*100).toFixed(2)}%`,
  `pii_leak_rate: ${(piiLeak*100).toFixed(2)}%`
].join('\n');

fs.writeFileSync('DATA_QUALITY_REPORT.md', lines + '\n');
console.log('Data quality report generated successfully');

// Exit codes for CI gates
const ok = dupRate < 0.01 && piiLeak === 0;
console.log(`dupRate: ${dupRate}, piiLeak: ${piiLeak}, ok: ${ok}`);
process.exitCode = ok ? 0 : 1;