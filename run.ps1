$ErrorActionPreference='Stop'
$env:ARGUS_BROWSER_CHANNEL='msedge'
$env:ARGUS_MAX_CONCURRENCY='1'
$env:ARGUS_GOOGLE_REFILL_MS='12000'
$env:ARGUS_DEBUG='1'
$env:ARGUS_RESET_QUEUE='1'      # reset queue.ndjson mỗi lần chạy
$env:ARGUS_REQUEUE_SEEDS='1'    # ép seed về trạng thái 'queued'

$seedPath = "data/raw/seed_urls.txt"
$env:ARGUS_SEED_URLS = [IO.File]::ReadAllText($seedPath)

# đảm bảo app đã build
pnpm --filter @argus/scraper-playwright run build
pnpm --filter @argus/scraper-playwright run start
