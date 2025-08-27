# ==== Argus Manual Test Suite (PowerShell) ====
# This script mimics the original manual commands but with proper venv handling
$ErrorActionPreference = 'Stop'

$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$arts = "artifacts\tests-$ts"
New-Item -ItemType Directory -Path $arts -Force | Out-Null

Write-Host "🧪 Argus Manual Test Suite - $ts" -ForegroundColor Cyan
Write-Host "📁 Artifacts will be saved to: $arts" -ForegroundColor Gray

# 1) Node/TypeScript
Write-Host "`n🔧 Node/TypeScript Tests" -ForegroundColor Yellow
pnpm -v 2>&1 | Tee-Object "$arts\node_env.log" | Out-Null
pnpm -r run typecheck 2>&1 | Tee-Object "$arts\node_typecheck.log"
pnpm -r run lint 2>&1 | Tee-Object "$arts\node_lint.log"
pnpm -r run build 2>&1 | Tee-Object "$arts\node_build.log"
pnpm -r --if-present run test 2>&1 | Tee-Object "$arts\node_test.log"

# 2) Python (using venv)
Write-Host "`n🐍 Python Tests (using .venv)" -ForegroundColor Yellow
if (Test-Path ".venv") {
    $ruffPath = ".\.venv\Scripts\ruff"
    $mypyPath = ".\.venv\Scripts\mypy"
    $pytestPath = ".\.venv\Scripts\pytest"

    & $ruffPath --version 2>&1 | Tee-Object "$arts\python_env.log" | Out-Null
    & $ruffPath check . --fix 2>&1 | Tee-Object "$arts\python_ruff.log"
    & $mypyPath . 2>&1 | Tee-Object "$arts\python_mypy.log"
    & $pytestPath -q 2>&1 | Tee-Object "$arts\python_pytest.log"
} else {
    Write-Warning "Python virtual environment not found. Run: python -m venv .venv && .\.venv\Scripts\python -m pip install -r python-dev-requirements.txt"
}

# 3) Go (if available)
Write-Host "`n🐹 Go Tests" -ForegroundColor Yellow
if (Test-Path "apps/api-go/go.mod") {
    Push-Location apps/api-go
    go version 2>&1 | Tee-Object "..\..\$arts\go_env.log" | Out-Null
    go vet ./... 2>&1 | Tee-Object "..\..\$arts\go_vet.log"
    go test ./... 2>&1 | Tee-Object "..\..\$arts\go_test.log"
    Pop-Location
} else {
    Write-Host "⚠️  No Go modules found - skipping Go tests" -ForegroundColor Yellow
}

# 4) E2E quick check for scraper-playwright
Write-Host "`n🎭 Playwright E2E Test" -ForegroundColor Yellow
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
$env:ARGUS_BROWSER_CHANNEL = 'msedge'
$env:ARGUS_HEADFUL = '0'
$env:ARGUS_MAX_ROUNDS = '15'
$env:ARGUS_IDLE_LIMIT = '4'
$env:ARGUS_SCROLL_PAUSE = '200'
$env:ARGUS_MAX_REVIEWS = '30'
$env:ARGUS_TLS_BYPASS = '1'
$env:ARGUS_TEST_URL = 'https://www.google.com/maps/place/Highlands+Coffee+417+Dien+Bien+Phu/data=!4m7!3m6!1s0x3175292a6362e83f:0x4b2d4efbb1d1a764!8m2!3d10.8018228!4d106.7127545!16s%2Fg%2F11s7xmj488!19sChIJP-hiYyopdTERZKfRsftOLUs?authuser=0&rclk=1'

pnpm -C apps/scraper-playwright build 2>&1 | Tee-Object "$arts\pw_build.log"

# Run scraper with timeout
Write-Host "🚀 Running Playwright scraper..." -ForegroundColor Gray
$job = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    $env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = $using:env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD
    $env:ARGUS_BROWSER_CHANNEL = $using:env:ARGUS_BROWSER_CHANNEL
    $env:ARGUS_HEADFUL = $using:env:ARGUS_HEADFUL
    $env:ARGUS_MAX_ROUNDS = $using:env:ARGUS_MAX_ROUNDS
    $env:ARGUS_IDLE_LIMIT = $using:env:ARGUS_IDLE_LIMIT
    $env:ARGUS_SCROLL_PAUSE = $using:env:ARGUS_SCROLL_PAUSE
    $env:ARGUS_MAX_REVIEWS = $using:env:ARGUS_MAX_REVIEWS
    $env:ARGUS_TLS_BYPASS = $using:env:ARGUS_TLS_BYPASS
    $env:ARGUS_TEST_URL = $using:env:ARGUS_TEST_URL

    pnpm -C apps/scraper-playwright start
}

$completed = Wait-Job $job -Timeout 30
if ($completed) {
    $output = Receive-Job $job
    $output 2>&1 | Tee-Object "$arts\pw_run.log"
} else {
    Write-Host "⏱️  Scraper timed out after 30 seconds" -ForegroundColor Yellow
    Stop-Job $job
    "Scraper timed out after 30 seconds" | Tee-Object "$arts\pw_run.log"
}
Remove-Job $job -Force

# 5) Check output NDJSON files
Write-Host "`n📊 Checking Output Files" -ForegroundColor Yellow
$reviews = "apps/scraper-playwright/datasets/reviews.ndjson"
$scraperOutput = "apps/scraper-playwright/datasets/scraper-output.ndjson"

foreach ($file in @($reviews, $scraperOutput)) {
    if (Test-Path $file) {
        Write-Host "✅ Found: $file" -ForegroundColor Green
        $lineCount = (Get-Content $file | Measure-Object -Line).Lines
        Write-Host "   📝 Lines: $lineCount" -ForegroundColor Gray
        if ($lineCount -gt 0) {
            Write-Host "`n== $($file.Split('/')[-1]) (tail 10) ==" -ForegroundColor Cyan
            Get-Content $file -Tail 10
        }
    } else {
        Write-Warning "Không tìm thấy $file"
    }
}

# 6) List artifacts
Write-Host "`n📁 Generated Artifacts" -ForegroundColor Yellow
if (Test-Path $arts) {
    Get-ChildItem $arts | Format-Table @{
        Name = 'Size'; Expression = {
            if ($_.Length -lt 1KB) { "$($_.Length) B" }
            elseif ($_.Length -lt 1MB) { "{0:N1} KB" -f ($_.Length / 1KB) }
            else { "{0:N1} MB" -f ($_.Length / 1MB) }
        }; Align = 'Right'
    }, Name -AutoSize
} else {
    Write-Host "No artifacts found" -ForegroundColor Red
}

Write-Host "`n✨ Manual test suite completed!" -ForegroundColor Green
Write-Host "💡 For a more comprehensive test, run: pnpm test:all" -ForegroundColor Gray