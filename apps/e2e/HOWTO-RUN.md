# How to Run E2E Tests for Project Argus

## Prerequisites

1. Ensure all dependencies are installed:
   ```bash
   pnpm install
   ```

2. Install Playwright browsers:
   ```bash
   cd apps/e2e
   npx playwright install
   ```

## Running Tests

### Run All Tests
```bash
cd apps/e2e
pnpm test
```

### Run SIM Tests Only
```bash
cd apps/e2e
npx playwright test tests/gmaps.sim.spec.ts
```

### Run REAL Tests Only
```bash
cd apps/e2e
npx playwright test tests/gmaps.real.spec.ts
```

### Run with Specific Environment Variables
```bash
cd apps/e2e
ARGUS_TEST_URL="https://maps.app.goo.gl/q6Rus1W5HMFsHBb3A" PW_LOCALE="en-US" pnpm test
```

## Test Modes

### SIM Mode
- Uses HTML fixtures to simulate Google Maps DOM
- Tests userscript extraction logic in isolation
- Fast and deterministic
- No network requests

### REAL Mode
- Tests against actual Google Maps URLs
- Validates real-world functionality
- May be affected by network conditions
- Subject to Google Maps UI changes

## Environment Variables

- `ARGUS_TEST_URL`: Google Maps URL to test against (default: https://www.google.com/maps)
- `PW_LOCALE`: Browser locale (default: en-US)
- `ARGUS_BROWSER_CHANNEL`: Browser channel to use (default: chrome)

## CI Execution

In CI environments, tests are run with:
```bash
ARGUS_TEST_URL="https://maps.app.goo.gl/q6Rus1W5HMFsHBb3A" pnpm run test:e2e:ci
```

## Troubleshooting

### No Test Output
If tests run but produce no output, try:
```bash
npx playwright test --headed
```

### Missing Dependencies
If Playwright reports missing browsers:
```bash
npx playwright install --with-deps
```

### Test Failures
Check test results in `test-results/` directory for detailed logs and screenshots.

## Perf/Flaky Budgets
- SIM p95 open < 3.5s; REAL p95 open/pane < 3.5s
- Flaky threshold < 2% (re-run count: 2). Override via ARGUS_PERF_STRICT=0.

## E2E Stability Tags
- `[stable]`: SIM headless+Desktop+normal+block=on, and REAL only when REAL_STABLE=1.
- `[quarantine]`: remaining tests. Not run in default CI.

### Commands
- Stable only: `pnpm run test:e2e:stable`
- All: `pnpm run test:e2e:all`
- Quarantine only: `pnpm run test:e2e:quarantine`

## E2E Triage Automation
- Reports: `apps/e2e/reports/results.json` (latest), `history.json` (rolling 10).
- Promote if pass≥98% in last 10; demote if ≥2 fails in last 3.
- Run locally: `pnpm run e2e:report && pnpm run e2e:triage`.

## GA Ops
- Gate GA: `pnpm run ops:kpi` → pass_rate_3d ≥ 95%, dupRate < 1%, p95 < 3500ms.
- Nightly: triage + auto-promote + KPI (see .github/workflows/ops.yml).
- Promote RC→GA: `pnpm run release:ga && git push --follow-tags`.