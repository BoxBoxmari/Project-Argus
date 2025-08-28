import fs from 'node:fs';
import path from 'node:path';

console.log('Starting data quality test');

const dir = 'apps/scraper-playwright/datasets/datasets/default';
console.log('Looking for data in directory:', dir);

if (fs.existsSync(dir)) {
  console.log('Directory exists');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') || f.endsWith('.ndjson'));
  console.log('Found files:', files);

  if (files.length > 0) {
    const firstFile = files[0];
    const content = fs.readFileSync(path.join(dir, firstFile), 'utf8');
    console.log(`First file ${firstFile} content length: ${content.length}`);

    // Try to parse the content
    try {
      if (firstFile.endsWith('.json')) {
        const data = JSON.parse(content);
        console.log(`Parsed JSON data, found ${data.length} items`);
      } else {
        const lines = content.split('\n').filter(line => line.trim());
        console.log(`Found ${lines.length} lines in NDJSON file`);
        const firstLine = JSON.parse(lines[0]);
        console.log('First line parsed successfully:', firstLine);
      }
    } catch (error) {
      console.error('Error parsing file:', error.message);
    }
  }
} else {
  console.log('Directory does not exist');
}

console.log('Test completed');
