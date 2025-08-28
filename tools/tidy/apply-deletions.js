import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const planPath = process.env.DEADCODE_PLAN || 'DEADCODE_REPORT.json';
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const atticRoot = path.join('attic', timestamp);

function ensureDir(dirPath) {
  try {
    execSync(`mkdir -p "${dirPath}"`, { stdio: 'ignore', shell: 'powershell.exe' });
  } catch (error) {
    // Ignore errors
  }
}

function moveFile(src, dst) {
  ensureDir(path.dirname(dst));
  execSync(`Move-Item -Path "${src}" -Destination "${dst}" -Force`, { stdio: 'ignore', shell: 'powershell.exe' });
}

function removePath(targetPath) {
  execSync(`Remove-Item -Recurse -Force "${targetPath}" -ErrorAction SilentlyContinue`, { stdio: 'ignore', shell: 'powershell.exe' });
}

for (const item of plan.items || []) {
  if (item.action === 'attic') {
    const dst = path.join(atticRoot, item.path);
    try {
      moveFile(item.path, dst);
      console.log(`Moved ${item.path} to attic`);
    } catch (error) {
      console.warn(`Failed to move ${item.path}:`, error.message);
    }
  }
  if (item.action === 'remove') {
    try {
      removePath(item.path);
      console.log(`Removed ${item.path}`);
    } catch (error) {
      console.warn(`Failed to remove ${item.path}:`, error.message);
    }
  }
}

ensureDir(atticRoot);
fs.writeFileSync(path.join(atticRoot, 'README.md'),
  '# Attic\nCác mục tạm thời chuyển vào đây do dọn dead code.\nKhôi phục khi cần.');
console.log(`Attic created at: ${atticRoot}`);
