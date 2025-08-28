# Post-release verification script

# Set environment variables
$env:ARGUS_TEST_URL="https://maps.app.goo.gl/q6Rus1W5HMFsHBb3A"
$env:ARGUS_BLOCK_RESOURCES="1"

Write-Host "Running E2E tests..." -ForegroundColor Green
pnpm -C apps/e2e test

Write-Host "Running Crawlee dataset emitter..." -ForegroundColor Green
$env:CRAWLEE_STORAGE_DIR="apps/scraper-playwright/datasets"
pnpm -C libs/runner-crawlee start

Write-Host "Verification completed!" -ForegroundColor Green
