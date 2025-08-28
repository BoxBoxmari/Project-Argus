import fs from 'node:fs'; import path from 'node:path';
const dir = process.env.CRAWLEE_STORAGE_DIR || 'apps/scraper-playwright/datasets/datasets/default';
console.log('Looking for data in directory:', dir);
console.log('Directory exists:', fs.existsSync(dir));
if (fs.existsSync(dir)) {
  const files = fs.readdirSync(dir);
  console.log('Files in directory:', files);
  const jsonFiles = files.filter(f=>f.endsWith('.json') || f.endsWith('.ndjson'));
  console.log('JSON/NDJSON files:', jsonFiles);
  if (jsonFiles.length > 0) {
    const firstFile = jsonFiles[0];
    const content = fs.readFileSync(path.join(dir, firstFile), 'utf8');
    console.log('First file content (first 200 chars):', content.substring(0, 200));
  }
}
