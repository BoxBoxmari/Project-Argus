import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const tree = execSync('git ls-files').toString().split('\n').filter(Boolean).join('\n');
writeFileSync('TREE.md', '```\n'+tree+'\n```');
