# Release Notes

## Project Argus v0.1.0-rc.1

### Summary
This release candidate includes all the production hardening features for Project Argus, ensuring stable operation in both userscript and Crawlee environments.

### Features
1. **Stable Review IDs and Deduplication**
   - Implemented browser-compatible review ID generation
   - Added automatic deduplication in the extraction pipeline
   - Ensured consistent ID generation across userscript and Crawlee runner

2. **Rate Limiting and Exponential Backoff**
   - Implemented configurable rate limiting with pace() function
   - Added exponential backoff for handling 429 and 5xx errors
   - Made all parameters configurable via environment variables

3. **Robots.txt Compliance**
   - Created robots.txt parsing and compliance middleware
   - Added environment variables for control (ARGUS_ROBOTS_RESPECT, ARGUS_OVERRIDE)
   - Implemented soft-fail behavior with warnings

4. **MCP UI Drift Detection**
   - Created mcp-ui-drift.yaml playbook for automated UI drift detection
   - Maintained selector mappings for different locales

5. **Load Testing and Duplication Detection**
   - Implemented comprehensive load tests with duplication rate checking
   - Added CI gates to ensure duplication rate stays below 1%

6. **CI/CD Integration**
   - Added budgets job to CI workflow
   - Enforced performance budgets (p95 < 3.5s)
   - Updated documentation with all environment variables and features

### Environment Variables
- ARGUS_DELAY_MS - Base delay between requests (default: 400)
- ARGUS_JITTER_MS - Jitter for request delays (default: 250)
- ARGUS_BACKOFF_BASE_MS - Base backoff time (default: 500)
- ARGUS_ROBOTS_RESPECT - Respect robots.txt (default: 1)
- ARGUS_OVERRIDE - Override robots.txt disallow (default: 0)
- ARGUS_BLOCK_RESOURCES - Block heavy resources (default: 1)
- ARGUS_LOCALE - Locale for selector mapping (default: en-US)

### Performance Gates
- perf_p95_open_ms < 3500
- perf_p95_pane_ms < 3500
- dup_rate < 0.01
- robots_guard = passed (respect=1, override=1)
- CI jobs: e2e, crawlee-smoke, budgets = green

### Testing Matrix
- Node: 20.x, 22.x
- Locale: en-US, vi-VN
- Mode: headless/headful

### Release Process
For detailed release execution, verification, and rollback procedures, see RELEASE_PROCESS.md

### Monitoring
Post-release monitoring is automated through:
```bash
pnpm run monitor:post-release
```

This will verify all gates and generate reports in this file.

### Rollback
If issues are discovered, the release can be rolled back using:
```bash
node tools/release/rollback.js v0.1.0-rc.1
```

Or using the PowerShell script:
```powershell
.\scripts\rollback.ps1 v0.1.0-rc.1
```
