# Project Argus - Release Process

## Overview
This document describes the complete release process for Project Argus, including execution, verification, and rollback procedures.

## Release Execution

### Automated Process
```bash
cd C:\Users\Admin\Downloads\argus_skeleton\argus
pnpm -r run typecheck && pnpm -r run build
pnpm run release:rc
git push origin --follow-tags
```

### PowerShell Script Alternative
```powershell
.\scripts\release.ps1
```

## Post-Release Verification

### Automated Verification
```bash
pnpm run monitor:post-release
```

### Manual Verification
```powershell
# CI gates visible on GitHub: e2e, crawlee-smoke, budgets
# Local REAL smoke
$env:ARGUS_TEST_URL="https://maps.app.goo.gl/q6Rus1W5HMFsHBb3A"
$env:ARGUS_BLOCK_RESOURCES="1"
pnpm -C apps/e2e test

# Crawlee dataset emits
$env:CRAWLEE_STORAGE_DIR="apps/scraper-playwright/datasets"
pnpm -C libs/runner-crawlee start
```

### PowerShell Script Alternative
```powershell
.\scripts\verify-release.ps1
```

## Release Gates

All releases must pass these gates:

1. **Performance Gates**
   - perf_p95_open_ms < 3500 ms
   - perf_p95_pane_ms < 3500 ms

2. **Quality Gates**
   - dupRate < 1%
   - robots guard passes with `ARGUS_ROBOTS_RESPECT=1` and warns when `ARGUS_OVERRIDE=1`

3. **CI Gates**
   - e2e job = green
   - crawlee-smoke job = green
   - budgets job = green

## Rollback Procedure

### Automated Rollback
```bash
node tools/release/rollback.js [tag-name]
```

### Manual Rollback
```powershell
# Remove RC tag locally and remote
git tag -d v0.1.0-rc.1
git push origin :refs/tags/v0.1.0-rc.1

# Optional: revert the release commit
git log --oneline -n 5
git revert <release_commit_sha>
git push origin HEAD
```

### PowerShell Script Alternative
```powershell
.\scripts\rollback.ps1 [tag-name]
```

## Monitoring and Maintenance

### Automated Monitoring
The post-release monitoring system automatically:
- Runs smoke tests and measures performance
- Computes duplication rates from datasets
- Verifies robots.txt compliance
- Generates reports in RELEASE_NOTES.md
- Documents issues in DIAGNOSIS.md if gates fail

### Environment Matrix
Tests are run with the following configurations:
- { ARGUS_LOCALE: "en-US", ARGUS_BLOCK_RESOURCES: "1" }
- { ARGUS_LOCALE: "vi-VN", ARGUS_BLOCK_RESOURCES: "1" }
- { ARGUS_LOCALE: "vi-VN", ARGUS_BLOCK_RESOURCES: "0" }

## Troubleshooting

### Common Issues

1. **Terminal/Command Issues**
   - Ensure Node.js and pnpm are properly installed
   - Check PATH environment variables
   - Verify git is accessible

2. **Build Failures**
   - Run `pnpm install` to ensure dependencies are up to date
   - Check TypeScript configurations
   - Verify all workspace packages build correctly

3. **Test Failures**
   - Ensure test URLs are accessible
   - Check environment variable configurations
   - Verify selector mappings in selector_map.json

4. **Release Tagging Issues**
   - Check git permissions
   - Verify remote repository access
   - Ensure no uncommitted changes

### Auto-Fix Procedures

If gates fail, the system will automatically suggest fixes:

1. **High Duplication Rate (≥ 1%)**
   - Strengthen reviewId key normalization
   - Re-run dataset phase

2. **Performance Issues (p95 ≥ 3500ms)**
   - Raise ARGUS_DELAY_MS and ARGUS_JITTER_MS by +150ms each
   - Re-run smoke test

3. **UI Drift Detection**
   - Refresh selector_map.json
   - Re-run smoke test

## Release Artifacts

The release process creates the following artifacts:

1. **Git Tag** - Release candidate tag (v0.1.0-rc.x)
2. **Commit** - Release commit with build artifacts
3. **Documentation** - Updated RELEASE_NOTES.md
4. **Reports** - Performance and quality metrics
5. **Datasets** - Crawlee output datasets (when applicable)

## Versioning Scheme

Project Argus follows semantic versioning with release candidates:

- Main releases: v1.0.0, v1.1.0, v2.0.0
- Release candidates: v0.1.0-rc.1, v0.1.0-rc.2
- Hot fixes: v1.0.1, v1.0.2

## Security Considerations

- All dependencies are audited before release
- No secrets are committed to the repository
- Environment variables are used for sensitive configurations
- Robots.txt compliance is enforced by default
