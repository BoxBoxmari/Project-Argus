# How to Run Project Argus

## Prerequisites

- Node.js >= 18.18 < 23
- pnpm >= 8.7
- Python >= 3.11

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

## Running the Project

### Build
```bash
pnpm run build
```

### Type Check
```bash
pnpm run typecheck
```

### Lint
```bash
pnpm run lint
```

### Test
```bash
pnpm run test
```

### Run Scraper
```bash
pnpm run start:scraper
```

### Run Scraper in Development Mode
```bash
pnpm run dev:scraper
```

### Run Crawlee Runner
```bash
pnpm -C libs/runner-crawlee start
```

### Run Crawlee Runner in Development Mode
```bash
pnpm -C libs/runner-crawlee dev
```

## Environment Variables

### Playwright Scraper
- `ARGUS_BROWSER_CHANNEL` - Browser channel (default: msedge)
- `ARGUS_HEADFUL` - Run browser in headful mode (default: 0)
- `ARGUS_TLS_BYPASS` - Bypass TLS errors (default: 0)
- `ARGUS_TEST_URL` - Target URL for scraping (default: https://www.google.com/maps)

### Crawlee Runner
- `ARGUS_START_URLS` - Comma-separated list of URLs to crawl
- `ARGUS_PROXY_URL` - Proxy URL for requests
- `ARGUS_MAX_REQUESTS` - Maximum number of requests to crawl (default: 5)
- `ARGUS_LOCALE` - Locale for selector mapping (default: en-US)
- `ARGUS_BLOCK_RESOURCES` - Block heavy resources (default: 1)
- `ARGUS_ROBOTS_RESPECT` - Respect robots.txt (default: 1)
- `ARGUS_OVERRIDE` - Override robots.txt disallow (default: 0)
- `ARGUS_DELAY_MS` - Base delay between requests (default: 400)
- `ARGUS_JITTER_MS` - Jitter for request delays (default: 250)
- `ARGUS_MAX_RETRIES` - Maximum retry attempts (default: 3)
- `ARGUS_BACKOFF_BASE_MS` - Base backoff time (default: 500)
- `CRAWLEE_STORAGE_DIR` - Directory for storing crawl data (default: apps/scraper-playwright/datasets)

### Production Hardening Features
- **Stable Review IDs**: Each review is assigned a stable ID based on its content to prevent duplicates
- **Rate Limiting**: Configurable delays and jitter between requests to avoid overwhelming servers
- **Robots.txt Compliance**: Respects robots.txt by default, with override option for testing
- **Exponential Backoff**: Automatic retry with exponential backoff for 429 and 5xx errors
- **Resource Blocking**: Blocks heavy resources (images, fonts, etc.) to improve performance

## Python Development

### Run Python Tests
```bash
cd python
pytest -q
```

### Run Python Linting
```bash
cd python
ruff check .
```

### Fix Python Linting Issues
```bash
cd python
ruff check . --fix
```

## CI/CD

The project uses GitHub Actions for CI/CD. The workflow is defined in `.github/workflows/ci.yml`.

### CI Gates
- **Performance Budget**: p95 < 3.5s for page load times
- **Flakiness**: < 2% flaky test rate
- **Duplication Rate**: < 1% duplicate review rate

## Troubleshooting

### Common Issues

1. **Playwright browser not found**
   ```bash
   pnpm -C apps/scraper-playwright exec playwright install chromium
   ```

2. **Type checking fails**
   ```bash
   pnpm run typecheck
   ```

3. **Linting issues**
   ```bash
   pnpm run lint
   ```

### Clean Build
```bash
pnpm run clean
pnpm install
pnpm run build
```

## Compliance and Ethics

### Robots.txt Compliance
By default, the crawler respects robots.txt. To override this behavior for testing purposes, set `ARGUS_OVERRIDE=1`.

### Terms of Service
Always ensure you have the right to access and process data from any website you scrape. The tool includes warnings to remind users of this responsibility.

### Rate Limiting
The tool implements configurable rate limiting to avoid overwhelming servers. Adjust `ARGUS_DELAY_MS` and `ARGUS_JITTER_MS` as needed.

## GA Ops
- Gate GA: `pnpm run ops:kpi` → pass_rate_3d ≥ 95%, dupRate < 1%, p95 < 3500ms.
- Nightly: triage + auto-promote + KPI (see .github/workflows/ops.yml).
- Promote RC→GA: `pnpm run release:ga && git push --follow-tags`.

## Data Retention & Security
- TTL for datasets/reports: default 14 days. Override: `ARGUS_TTL_DAYS=30 pnpm run ops:retention`.
- Secrets scan: weekly via gitleaks (see .github/workflows/security.yml).

## Data Quality & PII
- Enable redaction: `ARGUS_REDACT_PII=1` (default in CI).
- Check data quality: `pnpm run data:quality` → DATA_QUALITY_REPORT.md.

## Pseudonymize tác giả
- Bật: `ARGUS_PSEUDONYMIZE_AUTHOR=1 ARGUS_PII_SALT="<your_salt>"`.
- Ẩn author: thêm `ARGUS_DROP_AUTHOR=1` (vẫn giữ `authorHash` để join).
## Safe export
- `ARGUS_FAIL_ON_PII=1 ARGUS_REDACT_PII=1 pnpm run data:export:safe`
- Đặt `ARGUS_INCLUDE_AUTHOR=1` nếu cần export kèm author (không khuyến nghị trong CI).

## Supply chain
- SBOM: `pnpm run sbom:make` → `sbom.cdx.json`.
- Schema export: `pnpm run schema:export` → `schemas/review.schema.json`.
- Provenance: `pnpm run provenance:make` → `PROVENANCE.json`.
- Lockfile policy: CI dùng `pnpm install --frozen-lockfile`.

## Hybrid runner & A/B cuối
- Chạy MCP Chrome: `ARGUS_BACKEND=mcp ARGUS_TEST_URL="<url>" pnpm run hybrid:start`
- Chạy Crawlee: `ARGUS_BACKEND=crawlee pnpm run hybrid:start`
- Chạy Userscript harness: `ARGUS_BACKEND=userscript pnpm run hybrid:start`
- A/B matrix: `pnpm run perf:ab` (điều khiển backends qua `AB_BACKENDS=mcp,crawlee,userscript`)
