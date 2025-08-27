# ==== Argus Enhanced Test Suite (PowerShell) ====
$ErrorActionPreference = 'Stop'

# Create timestamped artifacts directory
$ts = Get-Date -Format 'yyyyMMdd_HHmmss'
$arts = "artifacts\tests-$ts"
New-Item -ItemType Directory -Path $arts -Force | Out-Null

Write-Host "🧪 Argus Test Suite - $ts" -ForegroundColor Cyan
Write-Host "📁 Artifacts will be saved to: $arts" -ForegroundColor Gray

# Test results tracking
$results = @{}

function Test-Component {
    param($Name, $ScriptBlock)
    Write-Host "`n🔍 Testing: $Name" -ForegroundColor Yellow
    try {
        $output = & $ScriptBlock
        $results[$Name] = "✅ PASS"
        Write-Host "$($results[$Name]): $Name" -ForegroundColor Green
        return $output
    } catch {
        $results[$Name] = "❌ FAIL: $($_.Exception.Message)"
        Write-Host "$($results[$Name])" -ForegroundColor Red
        return $null
    }
}

# 1) Node.js/TypeScript Tests
Test-Component "Node Environment" {
    pnpm -v 2>&1 | Tee-Object "$arts\node_env.log" | Out-Null
}

Test-Component "TypeScript Type Checking" {
    pnpm -r run typecheck 2>&1 | Tee-Object "$arts\node_typecheck.log"
}

Test-Component "ESLint Code Quality" {
    pnpm -r run lint 2>&1 | Tee-Object "$arts\node_lint.log"
}

Test-Component "TypeScript Build" {
    pnpm -r run build 2>&1 | Tee-Object "$arts\node_build.log"
}

Test-Component "Node Tests" {
    pnpm -r --if-present run test 2>&1 | Tee-Object "$arts\node_test.log"
}

# 2) Python Tests (using venv)
if (Test-Path ".venv") {
    $pythonPath = ".\.venv\Scripts\python"
    $ruffPath = ".\.venv\Scripts\ruff"
    $mypyPath = ".\.venv\Scripts\mypy"
    $pytestPath = ".\.venv\Scripts\pytest"

    Test-Component "Python Environment" {
        & $pythonPath --version 2>&1 | Tee-Object "$arts\python_env.log"
    }

    Test-Component "Ruff Code Formatting" {
        & $ruffPath check . --fix 2>&1 | Tee-Object "$arts\python_ruff.log"
    }

    Test-Component "MyPy Type Checking" {
        & $mypyPath . --ignore-missing-imports 2>&1 | Tee-Object "$arts\python_mypy.log"
    }

    Test-Component "Python Tests" {
        & $pytestPath -q 2>&1 | Tee-Object "$arts\python_pytest.log"
    }
} else {
    Write-Host "`n⚠️  Skipping Python tests - no .venv found" -ForegroundColor Yellow
    $results["Python Environment"] = "⚠️ SKIP: No virtual environment"
}

# 3) Go Tests (if available)
if (Test-Path "apps/api-go/go.mod") {
    Test-Component "Go Environment" {
        Push-Location apps/api-go
        try {
            go version 2>&1 | Tee-Object "..\..\$arts\go_env.log"
            go vet ./... 2>&1 | Tee-Object "..\..\$arts\go_vet.log"
            go test ./... 2>&1 | Tee-Object "..\..\$arts\go_test.log"
        } finally {
            Pop-Location
        }
    }
} else {
    Write-Host "`n⚠️  Skipping Go tests - no go.mod found" -ForegroundColor Yellow
    $results["Go Environment"] = "⚠️ SKIP: No Go modules"
}

# 4) Enhanced Playwright E2E Test
Write-Host "`n🎭 Testing Playwright Scraper" -ForegroundColor Yellow

# Set environment variables for minimal scraping
$env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
$env:ARGUS_BROWSER_CHANNEL = 'msedge'
$env:ARGUS_HEADFUL = '0'
$env:ARGUS_MAX_ROUNDS = '3'      # Reduced for testing
$env:ARGUS_IDLE_LIMIT = '2'      # Reduced for testing
$env:ARGUS_SCROLL_PAUSE = '100'   # Faster for testing
$env:ARGUS_MAX_REVIEWS = '5'      # Just a few reviews for testing
$env:ARGUS_TLS_BYPASS = '1'
$env:ARGUS_BLOCK_RESOURCES = '1'  # Enable resource blocking
$env:ARGUS_TEST_URL = 'https://www.google.com/maps/place/Starbucks/@10.8018,-106.7128,17z/data=!4m7!3m6!1s0x0:0x123456!8m2!3d10.8018!4d-106.7128!16s%2Fg%2F123456!19s123456'

Test-Component "Playwright Build" {
    pnpm -C apps/scraper-playwright build 2>&1 | Tee-Object "$arts\pw_build.log"
}

Test-Component "Playwright E2E Test" {
    # Run with timeout to prevent hanging
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
        $env:ARGUS_BLOCK_RESOURCES = $using:env:ARGUS_BLOCK_RESOURCES
        $env:ARGUS_TEST_URL = $using:env:ARGUS_TEST_URL

        pnpm -C apps/scraper-playwright start
    }

    # Wait for completion or timeout (30 seconds)
    $completed = Wait-Job $job -Timeout 30
    if ($completed) {
        $output = Receive-Job $job
        Remove-Job $job
        $output 2>&1 | Tee-Object "$arts\pw_run.log"
        return $output
    } else {
        Stop-Job $job
        Remove-Job $job
        throw "Playwright test timed out after 30 seconds"
    }
}

# 5) Check outputs and generate summary
Write-Host "`n📊 Checking Outputs" -ForegroundColor Yellow

# Check for generated NDJSON files
$outputFiles = @(
    "apps/scraper-playwright/datasets/scraper-output.ndjson",
    "apps/scraper-playwright/datasets/reviews.ndjson"
)

foreach ($file in $outputFiles) {
    if (Test-Path $file) {
        Write-Host "✅ Found output: $file" -ForegroundColor Green
        $lineCount = (Get-Content $file | Measure-Object -Line).Lines
        Write-Host "   📝 Lines: $lineCount" -ForegroundColor Gray

        # Show last few lines
        if ($lineCount -gt 0) {
            Write-Host "   📄 Sample content:" -ForegroundColor Gray
            Get-Content $file -Tail 3 | ForEach-Object { Write-Host "      $_" -ForegroundColor DarkGray }
        }
    } else {
        Write-Host "⚠️  Missing output: $file" -ForegroundColor Yellow
    }
}

# 6) Generate Test Summary
Write-Host "`n📋 Test Summary" -ForegroundColor Cyan
Write-Host "=" * 50

foreach ($test in $results.Keys) {
    Write-Host "$($results[$test]): $test"
}

# Count results
$passed = ($results.Values | Where-Object { $_ -like "*PASS*" }).Count
$failed = ($results.Values | Where-Object { $_ -like "*FAIL*" }).Count
$skipped = ($results.Values | Where-Object { $_ -like "*SKIP*" }).Count
$total = $results.Count

Write-Host "`n📈 Results: $passed passed, $failed failed, $skipped skipped (Total: $total)" -ForegroundColor Cyan

# 7) List artifacts
Write-Host "`n📁 Generated Artifacts:" -ForegroundColor Yellow
if (Test-Path $arts) {
    Get-ChildItem $arts | Sort-Object Name | Format-Table @{
        Name = 'Size'; Expression = { if ($_.Length -lt 1KB) { "$($_.Length) B" } elseif ($_.Length -lt 1MB) { "{0:N1} KB" -f ($_.Length / 1KB) } else { "{0:N1} MB" -f ($_.Length / 1MB) } }; Align = 'Right'
    }, Name -AutoSize
} else {
    Write-Host "No artifacts directory found" -ForegroundColor Red
}

# 8) Final status
if ($failed -eq 0) {
    Write-Host "`n🎉 All tests completed successfully!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "`n❌ Some tests failed. Check artifacts for details." -ForegroundColor Red
    exit 1
}