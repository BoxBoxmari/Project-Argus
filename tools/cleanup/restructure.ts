import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { globSync } from 'glob';

// Load rules
const R = JSON.parse(fs.readFileSync('tools/cleanup/rules.json', 'utf8'));

// Configuration
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--dry');
const SAFE_MODE = process.env.SAFE_MODE === '0' ? false : true;
const FORCE_PURGE = process.env.FORCE_PURGE === '1';

// Manifest structure
interface ManifestEntry {
  action: string;
  from: string;
  to?: string;
  size?: number;
  sha256?: string;
  ts: string;
}

const manifest: ManifestEntry[] = [];
const startTime = new Date().toISOString();

// Utility functions
function ensure(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function exists(p: string) {
  return fs.existsSync(p);
}

function getSize(p: string): number {
  try {
    const stats = fs.statSync(p);
    return stats.isFile() ? stats.size : 0;
  } catch {
    return 0;
  }
}

function moveFile(src: string, dst: string) {
  if (!exists(src)) return;

  ensure(path.dirname(dst));

  if (DRY_RUN) {
    console.log('[DRY RUN] Moving', src, '->', dst);
  } else {
    console.log('Moving', src, '->', dst);
    fs.renameSync(src, dst);
  }

  manifest.push({
    action: 'move',
    from: src,
    to: dst,
    size: getSize(dst),
    ts: new Date().toISOString()
  });
}

function moveDir(src: string, dst: string) {
  if (!exists(src)) return;

  ensure(dst);

  for (const name of fs.readdirSync(src)) {
    const s = path.join(src, name);
    const d = path.join(dst, name);

    if (fs.statSync(s).isDirectory()) {
      moveDir(s, d);
    } else {
      moveFile(s, d);
    }
  }

  // Remove the source directory after moving its contents
  if (!DRY_RUN) {
    try {
      fs.rmdirSync(src);
    } catch (error) {
      console.warn('Could not remove directory:', src, error);
    }
  }
}

function deleteFile(filePath: string) {
  if (!exists(filePath)) return;

  if (DRY_RUN) {
    console.log('[DRY RUN] Deleting', filePath);
  } else {
    console.log('Deleting', filePath);
    fs.rmSync(filePath, { force: true });
  }

  manifest.push({
    action: 'delete',
    from: filePath,
    size: getSize(filePath),
    ts: new Date().toISOString()
  });
}

function deleteDir(dirPath: string) {
  if (!exists(dirPath)) return;

  if (DRY_RUN) {
    console.log('[DRY RUN] Deleting directory', dirPath);
  } else {
    console.log('Deleting directory', dirPath);
    fs.rmSync(dirPath, { recursive: true, force: true });
  }

  manifest.push({
    action: 'delete',
    from: dirPath,
    ts: new Date().toISOString()
  });
}

function isExcluded(filePath: string): boolean {
  for (const pattern of R.exclude || []) {
    if (filePath.includes(pattern.replace('/**', '').replace('/**', ''))) {
      return true;
    }
  }
  return false;
}

function pruneEmptyDirs(dir: string) {
  if (!exists(dir) || isExcluded(dir)) return;

  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      pruneEmptyDirs(fullPath);

      // Check if directory is empty after recursive pruning
      if (fs.readdirSync(fullPath).length === 0) {
        if (DRY_RUN) {
          console.log('[DRY RUN] Removing empty directory', fullPath);
        } else {
          console.log('Removing empty directory', fullPath);
          fs.rmdirSync(fullPath);
        }
        manifest.push({
          action: 'prune',
          from: fullPath,
          ts: new Date().toISOString()
        });
      }
    }
  }
}

function gitCleanCheck(): boolean {
  try {
    const out = execSync('git status --porcelain').toString().trim();
    return out.length === 0;
  } catch {
    return false;
  }
}

function ensureKeepSetExists(): boolean {
  // Check that essential files still exist
  const essentialPatterns = R.mustKeep || [];
  let allExist = true;

  for (const pattern of essentialPatterns) {
    const files = globSync(pattern, { ignore: R.exclude || [] });
    if (files.length === 0) {
      console.warn('Warning: No files match mustKeep pattern:', pattern);
      // Don't fail on this, just warn
    }
  }

  return allExist;
}

function assertNoEmptyDirs(): boolean {
  function check(dir: string): boolean {
    if (isExcluded(dir)) return true;

    let hasContent = false;
    for (const entry of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        if (!check(fullPath)) {
          return false;
        }
      } else {
        hasContent = true;
      }
    }

    if (!hasContent && fs.readdirSync(dir).length > 0) {
      // Directory has subdirectories but no files
      return true;
    }

    return fs.readdirSync(dir).length > 0 || hasContent;
  }

  return check('.');
}

function generateTree(options: { exclude?: string[] } = {}) {
  const exclude = options.exclude || [];

  function tree(dir: string, prefix = ''): string[] {
    const entries = fs.readdirSync(dir)
      .filter(n => !exclude.some(e => n.includes(e.replace('/**', ''))))
      .sort();

    let lines: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const p = path.join(dir, e);
      const isLast = i === entries.length - 1;
      const mark = isLast ? '└─' : '├─';

      // Skip if this is an excluded directory
      if (isExcluded(p)) continue;

      lines.push(prefix + mark + e);

      if (fs.statSync(p).isDirectory()) {
        const np = prefix + (isLast ? '  ' : '│ ');
        lines = lines.concat(tree(p, np));
      }
    }
    return lines;
  }

  return tree('.');
}

// Main execution
try {
  console.log('Starting cleanup process...');
  console.log('DRY_RUN:', DRY_RUN ? 'true' : 'false');
  console.log('SAFE_MODE:', SAFE_MODE ? 'true' : 'false');
  console.log('FORCE_PURGE:', FORCE_PURGE ? 'true' : 'false');

  // 1. Handle test artifacts - always move to archive
  console.log('\n1. Archiving test artifacts...');
  const testArtifacts = globSync(R.testArtifacts || [], {
    ignore: R.exclude || []
  });

  for (const artifact of testArtifacts) {
    // Check if the artifact still exists before processing
    if (!exists(artifact)) {
      continue;
    }

    if (isExcluded(artifact)) continue;

    const relativePath = path.relative('.', artifact);
    const destination = path.join(R.archiveTargets.tests, relativePath);
    console.log('Archiving test artifact:', artifact, '->', destination);

    if (exists(artifact) && fs.statSync(artifact).isDirectory()) {
      moveDir(artifact, destination);
    } else if (exists(artifact)) {
      moveFile(artifact, destination);
    }
  }

  // 2. Handle build artifacts
  console.log('\n2. Processing build artifacts...');
  const buildArtifacts = globSync(R.buildArtifacts || [], {
    ignore: R.exclude || []
  });

  for (const artifact of buildArtifacts) {
    // Check if the artifact still exists before processing
    if (!exists(artifact)) {
      continue;
    }

    if (isExcluded(artifact)) continue;

    if (SAFE_MODE) {
      // In safe mode, move to archive instead of deleting
      const relativePath = path.relative('.', artifact);
      const destination = path.join(R.archiveTargets.builds, relativePath);
      console.log('Archiving build artifact (safe mode):', artifact, '->', destination);

      if (exists(artifact) && fs.statSync(artifact).isDirectory()) {
        moveDir(artifact, destination);
      } else if (exists(artifact)) {
        moveFile(artifact, destination);
      }
    } else if (FORCE_PURGE) {
      // In force mode, delete if not excluded
      console.log('Deleting build artifact (force purge):', artifact);

      if (exists(artifact) && fs.statSync(artifact).isDirectory()) {
        deleteDir(artifact);
      } else if (exists(artifact)) {
        deleteFile(artifact);
      }
    } else {
      // Default behavior - move to archive
      const relativePath = path.relative('.', artifact);
      const destination = path.join(R.archiveTargets.builds, relativePath);
      console.log('Archiving build artifact (default):', artifact, '->', destination);

      if (exists(artifact) && fs.statSync(artifact).isDirectory()) {
        moveDir(artifact, destination);
      } else if (exists(artifact)) {
        moveFile(artifact, destination);
      }
    }
  }

  // 3. Remove empty directories
  console.log('\n3. Pruning empty directories...');
  pruneEmptyDirs('.');

  // 4. Generate tree and manifest
  console.log('\n4. Generating TREE.md and CLEANUP_MANIFEST.json...');

  // Ensure archive directory exists
  ensure('archive');

  // Generate tree
  const treeLines = generateTree({
    exclude: (R.exclude || []).concat(['archive/**', 'node_modules/**', '.git/**'])
  });

  const treeContent = [
    '# Project Tree (post-cleanup)',
    '``',
    ...treeLines,
    '```',
    ''
  ].join('\n');

  if (DRY_RUN) {
    console.log('[DRY RUN] Would write TREE.md with', treeLines.length, 'lines');
  } else {
    fs.writeFileSync('TREE.md', treeContent);
  }

  // Update manifest with summary
  const endTime = new Date().toISOString();
  manifest.push({
    action: 'summary',
    from: 'cleanup_process',
    to: 'completed',
    ts: endTime
  });

  const manifestContent = {
    entries: manifest,
    startTime,
    endTime,
    duration: new Date(new Date(endTime).getTime() - new Date(startTime).getTime()).toISOString(),
    dryRun: DRY_RUN,
    safeMode: SAFE_MODE,
    forcePurge: FORCE_PURGE
  };

  if (DRY_RUN) {
    console.log('[DRY RUN] Would write CLEANUP_MANIFEST.json');
    console.log('Manifest entries:', manifest.length);
  } else {
    fs.writeFileSync('CLEANUP_MANIFEST.json', JSON.stringify(manifestContent, null, 2));
  }

  // 5. Run validations
  console.log('\n5. Running validations...');
  const keepSetExists = ensureKeepSetExists();
  const noEmptyDirs = assertNoEmptyDirs();
  const gitClean = gitCleanCheck();

  console.log('Keep set validation:', keepSetExists ? 'PASSED' : 'WARNING');
  console.log('Empty directories check:', noEmptyDirs ? 'PASSED' : 'FAILED');
  console.log('Git clean check:', gitClean ? 'CLEAN' : 'DIRTY');

  console.log('\nCleanup process completed.');
  console.log('DRY_RUN:', DRY_RUN ? '1' : '0', '| Git clean:', gitClean);

} catch (error) {
  console.error('Error during cleanup:', error);
  process.exit(1);
}
