# Argus – Production Hardening Tracker

## Done
- [x] Fix browser compatibility issues with `reviewId` function
- [x] Implement stable ReviewID + dedupe at extractor (userscript + crawlee)
- [x] Implement rate-limit + backoff + event log middleware
- [x] Implement robots.txt compliance guard
- [x] Create MCP UI drift playbook
- [x] Create load tests with duplication rate checking
- [x] Add CI gates for performance and duplication budgets
- [x] Update documentation (HOWTO-RUN.md, DIAGNOSIS.md)

## Verification Status
All production-hardening features have been implemented and verified:

### Browser Compatibility
- ✅ `reviewId` function uses browser-compatible hash algorithm
- ✅ No direct imports of `node:crypto` in browser code

### Deduplication
- ✅ Stable Review IDs generated based on review content
- ✅ Deduplication logic implemented in extractor

### Rate Limiting & Backoff
- ✅ `pace()` function with configurable delays and jitter
- ✅ `backoff()` function with exponential backoff
- ✅ Environment variables: `ARGUS_DELAY_MS`, `ARGUS_JITTER_MS`, `ARGUS_BACKOFF_BASE_MS`

### Robots.txt Compliance
- ✅ Robots.txt parsing and compliance checking
- ✅ Environment variables: `ARGUS_ROBOTS_RESPECT`, `ARGUS_OVERRIDE`

### MCP UI Drift Detection
- ✅ `mcp-ui-drift.yaml` playbook created
- ✅ Selector mapping maintained for different locales

### Load Testing & CI Gates
- ✅ Load tests with duplication rate checking (< 1%)
- ✅ Performance budgets enforced in CI (p95 < 3.5s)
- ✅ Budgets job in CI workflow

### Documentation
- ✅ All environment variables documented in HOWTO-RUN.md
- ✅ Production hardening features summarized in DIAGNOSIS.md
