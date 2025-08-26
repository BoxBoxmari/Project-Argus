$ErrorActionPreference = 'Stop'
Write-Host "== Stopping node =="; try { taskkill /F /IM node.exe | Out-Null } catch {}
Write-Host "== Cleaning dist folders =="; pnpm -r run clean
Write-Host "== Building workspace =="; pnpm -r --workspace-concurrency=1 build
Write-Host "== Typecheck & lint =="; pnpm -r run typecheck; pnpm -r run lint
Write-Host "== Start scraper =="; pnpm -C apps/scraper-playwright start