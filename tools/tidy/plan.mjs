import fs from 'node:fs';

function parseJsonFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    // Remove any warning lines that might be present
    const lines = data.split('\n');
    const jsonLines = lines.filter(line => line.trim() && !line.includes('WARN'));
    if (jsonLines.length === 0) return {};
    const jsonString = jsonLines.join('');
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn(`Failed to parse ${filePath}:`, error.message);
    return {};
  }
}

const knip = parseJsonFile('.knip.json');
const prune = parseJsonFile('.tsprune.json');
const dep = parseJsonFile('.depcheck.json');

const items = [];
for (const f of (knip.files || [])) items.push({ path: f, reason: 'knip', action: 'remove' });
for (const e of (prune.unusedExports || [])) items.push({ path: e.file, reason: 'ts-prune', action: 'remove' });
for (const d of (dep.dependencies || [])) items.push({ path: `dep:${d}`, reason: 'depcheck', action: 'remove' });

fs.writeFileSync('DEADCODE_REPORT.json', JSON.stringify({ items }, null, 2));
console.log('DEADCODE_REPORT.json written');
