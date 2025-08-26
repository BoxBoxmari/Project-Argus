$ErrorActionPreference='Stop'
$env:ARGUS_BROWSER_CHANNEL='msedge'
$env:ARGUS_MAX_CONCURRENCY='1'
$env:ARGUS_GOOGLE_REFILL_MS='12000'
$env:ARGUS_DEBUG='1'
$env:ARGUS_RESET_QUEUE='1'      # reset queue.ndjson mỗi lần chạy
$env:ARGUS_REQUEUE_SEEDS='1'    # ép seed về trạng thái 'queued'

$seedPath = Join-Path $PSScriptRoot 'data\raw\seed_urls.txt'
if (Test-Path $seedPath) {
  $env:ARGUS_SEED_URLS = [IO.File]::ReadAllText($seedPath)
} elseif (-not $env:ARGUS_URLS) {
  throw "Missing seeds: provide data\raw\seed_urls.txt or set ARGUS_URLS."
}

# đảm bảo app đã build
pnpm --filter @argus/scraper-playwright run build
pnpm --filter @argus/scraper-playwright run start
