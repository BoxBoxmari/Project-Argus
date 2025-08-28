import { execSync } from 'node:child_process';

function sh(command) {
  try {
    console.log(`Executing: ${command}`);
    return execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    throw error;
  }
}

function rollbackRelease(tagName) {
  try {
    // Remove RC tag locally and remote
    console.log(`Rolling back release tag: ${tagName}`);
    sh(`git tag -d ${tagName}`);
    sh(`git push origin :refs/tags/${tagName}`);

    console.log(`Release tag ${tagName} has been rolled back successfully`);
    console.log("To rollback the release commit, use:");
    console.log("  git log --oneline -n 5");
    console.log("  git revert <release_commit_sha>");
    console.log("  git push origin HEAD");

  } catch (error) {
    console.error("Rollback failed:", error);
    process.exit(1);
  }
}

// Get the tag name from command line arguments or default to v0.1.0-rc.1
const tagName = process.argv[2] || 'v0.1.0-rc.1';
rollbackRelease(tagName);
