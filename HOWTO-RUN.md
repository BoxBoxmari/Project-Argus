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

## Environment Variables

### Playwright Scraper
- `ARGUS_BROWSER_CHANNEL` - Browser channel (default: msedge)
- `ARGUS_HEADFUL` - Run browser in headful mode (default: 0)
- `ARGUS_TLS_BYPASS` - Bypass TLS errors (default: 0)
- `ARGUS_TEST_URL` - Target URL for scraping (default: https://www.google.com/maps)

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
