const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// Function to get all .ts files recursively
function getAllTsFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('__tests__')) {
        results = results.concat(getAllTsFiles(file));
      }
    } else if (path.extname(file) === '.ts') {
      results.push(file);
    }
  });
  return results;
}

// Get all .ts files
const tsFiles = getAllTsFiles('./src');

// Create dist directory if it doesn't exist
if (!fs.existsSync('./dist')) {
  fs.mkdirSync('./dist', { recursive: true });
}

// Compile each file
tsFiles.forEach(file => {
  const relativePath = path.relative('./src', file);
  const outputPath = path.join('./dist', relativePath.replace('.ts', '.js'));
  const outputDir = path.dirname(outputPath);

  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    execFileSync('npx', [
      'tsc',
      file,
      '--outDir', outputDir,
      '--declaration',
      '--declarationMap',
      '--sourceMap',
      '--module', 'ESNext',
      '--target', 'ES2022',
      '--moduleResolution', 'node',
      '--esModuleInterop',
      '--skipLibCheck'
    ], { stdio: 'inherit' });
    console.log(`Compiled ${file}`);
  } catch (error) {
    console.error(`Error compiling ${file}:`, error.message);
  }
});

// Fix directory structure issues
function fixDirectoryStructure() {
  // Fix id directory structure
  const idDir = './dist/id/id';
  if (fs.existsSync(idDir)) {
    const files = fs.readdirSync(idDir);
    files.forEach(file => {
      const srcPath = path.join(idDir, file);
      const destPath = path.join('./dist/id', file);
      fs.renameSync(srcPath, destPath);
    });
    // Remove the empty directory
    try {
      fs.rmdirSync(idDir);
    } catch (e) {
      // Directory might not be empty, that's okay
    }
  }

  // Fix schema directory structure if needed
  const idSchemaDir = './dist/id/schema';
  if (fs.existsSync(idSchemaDir)) {
    const files = fs.readdirSync(idSchemaDir);
    files.forEach(file => {
      const srcPath = path.join(idSchemaDir, file);
      const destPath = path.join('./dist/schema', file);
      fs.renameSync(srcPath, destPath);
    });
    // Remove the empty directory
    try {
      fs.rmdirSync(idSchemaDir);
    } catch (e) {
      // Directory might not be empty, that's okay
    }
  }

  // Fix extractors directory structure
  const extractorsDir = './dist/extractors/extractors';
  if (fs.existsSync(extractorsDir)) {
    const files = fs.readdirSync(extractorsDir);
    files.forEach(file => {
      const srcPath = path.join(extractorsDir, file);
      const destPath = path.join('./dist/extractors', file);
      fs.renameSync(srcPath, destPath);
    });
    // Remove the empty directory
    try {
      fs.rmdirSync(extractorsDir);
    } catch (e) {
      // Directory might not be empty, that's okay
    }
  }

  // Fix sanitize directory structure
  const sanitizeDir = './dist/sanitize/sanitize';
  if (fs.existsSync(sanitizeDir)) {
    const files = fs.readdirSync(sanitizeDir);
    files.forEach(file => {
      const srcPath = path.join(sanitizeDir, file);
      const destPath = path.join('./dist/sanitize', file);
      fs.renameSync(srcPath, destPath);
    });
    // Remove the empty directory
    try {
      fs.rmdirSync(sanitizeDir);
    } catch (e) {
      // Directory might not be empty, that's okay
    }
  }

  // Fix schema directory structure
  const schemaDir = './dist/schema/schema';
  if (fs.existsSync(schemaDir)) {
    const files = fs.readdirSync(schemaDir);
    files.forEach(file => {
      const srcPath = path.join(schemaDir, file);
      const destPath = path.join('./dist/schema', file);
      fs.renameSync(srcPath, destPath);
    });
    // Remove the empty directory
    try {
      fs.rmdirSync(schemaDir);
    } catch (e) {
      // Directory might not be empty, that's okay
    }
  }
}

fixDirectoryStructure();
console.log('Directory structure fixed');
