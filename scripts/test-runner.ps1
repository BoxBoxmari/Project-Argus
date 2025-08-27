#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Comprehensive test runner for Argus project with bug detection and reporting

.DESCRIPTION
    This script runs the complete test suite designed to find maximum bugs and their root causes.
    It includes unit tests, integration tests, schema validation, performance tests, and generates
    detailed reports with artifacts for debugging.

.PARAMETER TestSuite
    Test suite to run: 'all', 'unit', 'integration', 'schema', 'performance', 'e2e', 'negative'

.PARAMETER Coverage
    Generate coverage reports (default: true)

.PARAMETER Artifacts
    Save test artifacts for debugging (default: true)

.PARAMETER Parallel
    Run tests in parallel where possible (default: true)

.PARAMETER Bail
    Stop on first test failure (default: false)

.PARAMETER Verbose
    Enable verbose output (default: false)

.EXAMPLE
    ./test-runner.ps1 -TestSuite all -Coverage $true -Artifacts $true
#>

param(
    [ValidateSet('all', 'unit', 'integration', 'schema', 'performance', 'e2e', 'negative', 'smoke')]
    [string]$TestSuite = 'all',

    [bool]$Coverage = $true,
    [bool]$Artifacts = $true,
    [bool]$Parallel = $true,
    [bool]$Bail = $false,
    [bool]$Verbose = $false
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Configuration
$PROJECT_ROOT = Split-Path -Parent $PSScriptRoot
$ARTIFACTS_DIR = Join-Path $PROJECT_ROOT ".artifacts"
$TEST_RESULTS_DIR = Join-Path $ARTIFACTS_DIR "test-results"
$COVERAGE_DIR = Join-Path $ARTIFACTS_DIR "coverage"
$RUN_ID = "test-run-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$RUN_ARTIFACTS_DIR = Join-Path $ARTIFACTS_DIR $RUN_ID

# Ensure directories exist
@($ARTIFACTS_DIR, $TEST_RESULTS_DIR, $COVERAGE_DIR, $RUN_ARTIFACTS_DIR) | ForEach-Object {
    if (-not (Test-Path $_)) {
        New-Item -ItemType Directory -Path $_ -Force | Out-Null
    }
}

# Test results tracking
$script:TestResults = @{
    StartTime = Get-Date
    EndTime = $null
    Duration = $null
    TotalTests = 0
    PassedTests = 0
    FailedTests = 0
    SkippedTests = 0
    Coverage = @{
        Lines = 0
        Functions = 0
        Branches = 0
        Statements = 0
    }
    Suites = @{}
    Errors = @()
    Artifacts = @()
}

function Write-TestLog {
    param(
        [string]$Message,
        [ValidateSet('INFO', 'WARN', 'ERROR', 'SUCCESS')]
        [string]$Level = 'INFO'
    )

    $timestamp = Get-Date -Format 'HH:mm:ss'
    $color = switch ($Level) {
        'INFO' { 'White' }
        'WARN' { 'Yellow' }
        'ERROR' { 'Red' }
        'SUCCESS' { 'Green' }
    }

    Write-Host "[$timestamp] [$Level] $Message" -ForegroundColor $color

    # Log to file
    $logFile = Join-Path $RUN_ARTIFACTS_DIR "test-runner.log"
    "[$timestamp] [$Level] $Message" | Add-Content -Path $logFile
}

function Test-Prerequisites {
    Write-TestLog "Checking prerequisites..." -Level INFO

    # Check Node.js
    try {
        $nodeVersion = node --version
        Write-TestLog "Node.js version: $nodeVersion" -Level INFO
    } catch {
        Write-TestLog "Node.js not found or not working" -Level ERROR
        return $false
    }

    # Check pnpm
    try {
        $pnpmVersion = pnpm --version
        Write-TestLog "pnpm version: $pnpmVersion" -Level INFO
    } catch {
        Write-TestLog "pnpm not found, trying npm..." -Level WARN
    }

    # Check Python (optional)
    try {
        $pythonVersion = python --version
        Write-TestLog "Python version: $pythonVersion" -Level INFO
    } catch {
        Write-TestLog "Python not found, Python tests will be skipped" -Level WARN
    }

    # Check if dependencies are installed
    if (-not (Test-Path (Join-Path $PROJECT_ROOT "node_modules"))) {
        Write-TestLog "Node modules not found, installing dependencies..." -Level WARN
        Set-Location $PROJECT_ROOT
        pnpm install
    }

    return $true
}

function Invoke-JavaScriptTests {
    param([string]$Suite)

    Write-TestLog "Running JavaScript tests for suite: $Suite" -Level INFO

    $jestConfig = Join-Path $PROJECT_ROOT "tests/jest.config.test.js"
    $testPattern = switch ($Suite) {
        'unit' { 'tests/unit/**/*.test.ts' }
        'integration' { 'tests/integration/**/*.test.ts' }
        'schema' { 'tests/unit/schema*.test.ts' }
        'all' { 'tests/**/*.test.ts' }
        default { "tests/**/*$Suite*.test.ts" }
    }

    $jestArgs = @(
        '--config', $jestConfig
        '--testPathPattern', $testPattern
        '--json'
        '--outputFile', (Join-Path $RUN_ARTIFACTS_DIR "jest-results-$Suite.json")
    )

    if ($Coverage) {
        $jestArgs += @('--coverage', '--coverageDirectory', (Join-Path $RUN_ARTIFACTS_DIR "coverage-$Suite"))
    }

    if ($Verbose) {
        $jestArgs += '--verbose'
    }

    if ($Bail) {
        $jestArgs += '--bail'
    }

    try {
        Set-Location $PROJECT_ROOT
        $env:TEST_RUN_ID = $RUN_ID
        $env:NODE_ENV = 'test'

        $jestOutput = npx jest @jestArgs 2>&1
        $jestExitCode = $LASTEXITCODE

        # Save Jest output
        $jestOutput | Out-File -FilePath (Join-Path $RUN_ARTIFACTS_DIR "jest-output-$Suite.txt")

        # Parse Jest results
        $resultsFile = Join-Path $RUN_ARTIFACTS_DIR "jest-results-$Suite.json"
        if (Test-Path $resultsFile) {
            $jestResults = Get-Content $resultsFile | ConvertFrom-Json

            $script:TestResults.Suites[$Suite] = @{
                Type = 'JavaScript'
                Passed = $jestResults.numPassedTests
                Failed = $jestResults.numFailedTests
                Skipped = $jestResults.numPendingTests
                Total = $jestResults.numTotalTests
                Duration = $jestResults.testResults | Measure-Object -Property time -Sum | Select-Object -ExpandProperty Sum
                ExitCode = $jestExitCode
            }

            $script:TestResults.TotalTests += $jestResults.numTotalTests
            $script:TestResults.PassedTests += $jestResults.numPassedTests
            $script:TestResults.FailedTests += $jestResults.numFailedTests
            $script:TestResults.SkippedTests += $jestResults.numPendingTests

            if ($jestResults.numFailedTests -gt 0) {
                Write-TestLog "$($jestResults.numFailedTests) JavaScript tests failed in suite: $Suite" -Level ERROR

                # Extract failure details
                $jestResults.testResults | Where-Object { $_.numFailingTests -gt 0 } | ForEach-Object {
                    $_.assertionResults | Where-Object { $_.status -eq 'failed' } | ForEach-Object {
                        $script:TestResults.Errors += @{
                            Suite = $Suite
                            Test = $_.fullName
                            Error = $_.failureMessages -join '; '
                            File = $_.location
                        }
                    }
                }
            } else {
                Write-TestLog "All JavaScript tests passed in suite: $Suite" -Level SUCCESS
            }
        }

        return $jestExitCode -eq 0

    } catch {
        Write-TestLog "JavaScript test execution failed: $($_.Exception.Message)" -Level ERROR
        $script:TestResults.Errors += @{
            Suite = $Suite
            Test = 'Test Runner'
            Error = $_.Exception.Message
            File = 'test-runner.ps1'
        }
        return $false
    }
}

function Invoke-PythonTests {
    param([string]$Suite)

    Write-TestLog "Running Python tests for suite: $Suite" -Level INFO

    # Check if Python is available
    try {
        python --version | Out-Null
    } catch {
        Write-TestLog "Python not available, skipping Python tests" -Level WARN
        return $true
    }

    # Check if .venv exists or create it
    $venvPath = Join-Path $PROJECT_ROOT ".venv"
    if (-not (Test-Path $venvPath)) {
        Write-TestLog "Creating Python virtual environment..." -Level INFO
        python -m venv $venvPath
    }

    # Activate virtual environment
    $activateScript = if ($IsWindows -or $env:OS -eq "Windows_NT") {
        Join-Path $venvPath "Scripts/Activate.ps1"
    } else {
        Join-Path $venvPath "bin/activate"
    }

    try {
        if (Test-Path $activateScript) {
            & $activateScript
        }

        # Install test dependencies
        $requirementsFile = Join-Path $PROJECT_ROOT "tests/requirements.txt"
        if (Test-Path $requirementsFile) {
            pip install -r $requirementsFile
        } else {
            pip install pytest pytest-cov pandas pandera
        }

        # Run pytest
        $pytestArgs = @(
            '-v'
            '--tb=short'
            '--json-report'
            "--json-report-file=$(Join-Path $RUN_ARTIFACTS_DIR "pytest-results-$Suite.json")"
        )

        if ($Coverage) {
            $pytestArgs += @(
                '--cov=py/ingest'
                '--cov=py/processor_python'
                "--cov-report=html:$(Join-Path $RUN_ARTIFACTS_DIR "coverage-python-$Suite")"
                "--cov-report=json:$(Join-Path $RUN_ARTIFACTS_DIR "coverage-python-$Suite.json")"
            )
        }

        if ($Suite -ne 'all') {
            $pytestArgs += @('-k', $Suite)
        }

        $pytestArgs += 'py/tests'

        Set-Location $PROJECT_ROOT
        $env:PYTHONPATH = "py/ingest/src;py/ingest/processor_python"

        $pytestOutput = python -m pytest @pytestArgs 2>&1
        $pytestExitCode = $LASTEXITCODE

        # Save pytest output
        $pytestOutput | Out-File -FilePath (Join-Path $RUN_ARTIFACTS_DIR "pytest-output-$Suite.txt")

        # Parse pytest results
        $resultsFile = Join-Path $RUN_ARTIFACTS_DIR "pytest-results-$Suite.json"
        if (Test-Path $resultsFile) {
            $pytestResults = Get-Content $resultsFile | ConvertFrom-Json

            $script:TestResults.Suites["Python-$Suite"] = @{
                Type = 'Python'
                Passed = $pytestResults.summary.passed
                Failed = $pytestResults.summary.failed
                Skipped = $pytestResults.summary.skipped
                Total = $pytestResults.summary.total
                Duration = $pytestResults.duration
                ExitCode = $pytestExitCode
            }

            $script:TestResults.TotalTests += $pytestResults.summary.total
            $script:TestResults.PassedTests += $pytestResults.summary.passed
            $script:TestResults.FailedTests += $pytestResults.summary.failed
            $script:TestResults.SkippedTests += $pytestResults.summary.skipped
        }

        if ($pytestExitCode -eq 0) {
            Write-TestLog "All Python tests passed in suite: $Suite" -Level SUCCESS
        } else {
            Write-TestLog "$($pytestResults.summary.failed) Python tests failed in suite: $Suite" -Level ERROR
        }

        return $pytestExitCode -eq 0

    } catch {
        Write-TestLog "Python test execution failed: $($_.Exception.Message)" -Level ERROR
        return $false
    }
}

function Invoke-SmokeTests {
    Write-TestLog "Running smoke tests..." -Level INFO

    try {
        Set-Location $PROJECT_ROOT

        # Build check
        Write-TestLog "Checking build..." -Level INFO
        pnpm run build 2>&1 | Out-File -FilePath (Join-Path $RUN_ARTIFACTS_DIR "build-output.txt")
        if ($LASTEXITCODE -ne 0) {
            Write-TestLog "Build failed" -Level ERROR
            return $false
        }

        # Lint check
        Write-TestLog "Checking linting..." -Level INFO
        pnpm run lint 2>&1 | Out-File -FilePath (Join-Path $RUN_ARTIFACTS_DIR "lint-output.txt")
        if ($LASTEXITCODE -ne 0) {
            Write-TestLog "Linting failed" -Level WARN
        }

        # Type check
        Write-TestLog "Checking types..." -Level INFO
        pnpm run typecheck 2>&1 | Out-File -FilePath (Join-Path $RUN_ARTIFACTS_DIR "typecheck-output.txt")
        if ($LASTEXITCODE -ne 0) {
            Write-TestLog "Type checking failed" -Level ERROR
            return $false
        }

        Write-TestLog "Smoke tests passed" -Level SUCCESS
        return $true

    } catch {
        Write-TestLog "Smoke test execution failed: $($_.Exception.Message)" -Level ERROR
        return $false
    }
}

function New-TestReport {
    Write-TestLog "Generating test report..." -Level INFO

    $script:TestResults.EndTime = Get-Date
    $script:TestResults.Duration = $script:TestResults.EndTime - $script:TestResults.StartTime

    # Calculate success rate
    $successRate = if ($script:TestResults.TotalTests -gt 0) {
        [math]::Round(($script:TestResults.PassedTests / $script:TestResults.TotalTests) * 100, 2)
    } else { 0 }

    # Generate summary report
    $report = @{
        RunId = $RUN_ID
        Timestamp = $script:TestResults.StartTime.ToString("yyyy-MM-dd HH:mm:ss")
        Duration = $script:TestResults.Duration.ToString("hh\:mm\:ss")
        Summary = @{
            Total = $script:TestResults.TotalTests
            Passed = $script:TestResults.PassedTests
            Failed = $script:TestResults.FailedTests
            Skipped = $script:TestResults.SkippedTests
            SuccessRate = "$successRate%"
        }
        Suites = $script:TestResults.Suites
        Errors = $script:TestResults.Errors
        Coverage = $script:TestResults.Coverage
        Artifacts = $script:TestResults.Artifacts
        Environment = @{
            OS = $env:OS
            PowerShell = $PSVersionTable.PSVersion.ToString()
            NodeJS = (node --version 2>$null)
            Python = (python --version 2>$null)
        }
    }

    # Save JSON report
    $reportFile = Join-Path $RUN_ARTIFACTS_DIR "test-report.json"
    $report | ConvertTo-Json -Depth 10 | Out-File -FilePath $reportFile -Encoding UTF8

    # Generate HTML report
    $htmlReport = @"
<!DOCTYPE html>
<html>
<head>
    <title>Argus Test Report - $RUN_ID</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: flex; gap: 20px; margin-bottom: 20px; }
        .metric { background: white; padding: 15px; border-radius: 8px; border: 1px solid #ddd; text-align: center; }
        .metric.success { border-color: #4CAF50; }
        .metric.warning { border-color: #FF9800; }
        .metric.error { border-color: #F44336; }
        .suite { background: white; margin-bottom: 15px; border-radius: 8px; border: 1px solid #ddd; }
        .suite-header { background: #f9f9f9; padding: 15px; border-bottom: 1px solid #ddd; }
        .suite-body { padding: 15px; }
        .error { background: #ffebee; border: 1px solid #f44336; border-radius: 4px; padding: 10px; margin: 5px 0; }
        .error-title { font-weight: bold; color: #d32f2f; }
        .success { color: #4CAF50; }
        .warning { color: #FF9800; }
        .error-text { color: #F44336; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Argus Test Report</h1>
        <p><strong>Run ID:</strong> $RUN_ID</p>
        <p><strong>Timestamp:</strong> $($report.Timestamp)</p>
        <p><strong>Duration:</strong> $($report.Duration)</p>
    </div>

    <div class="summary">
        <div class="metric $(if($report.Summary.Failed -eq 0) { 'success' } else { 'error' })">
            <h3>$($report.Summary.Total)</h3>
            <p>Total Tests</p>
        </div>
        <div class="metric success">
            <h3>$($report.Summary.Passed)</h3>
            <p>Passed</p>
        </div>
        <div class="metric $(if($report.Summary.Failed -eq 0) { 'success' } else { 'error' })">
            <h3>$($report.Summary.Failed)</h3>
            <p>Failed</p>
        </div>
        <div class="metric warning">
            <h3>$($report.Summary.Skipped)</h3>
            <p>Skipped</p>
        </div>
        <div class="metric $(if([int]$report.Summary.SuccessRate.Replace('%','') -ge 80) { 'success' } elseif([int]$report.Summary.SuccessRate.Replace('%','') -ge 60) { 'warning' } else { 'error' })">
            <h3>$($report.Summary.SuccessRate)</h3>
            <p>Success Rate</p>
        </div>
    </div>

    <h2>Test Suites</h2>
"@

    foreach ($suite in $report.Suites.GetEnumerator()) {
        $suiteData = $suite.Value
        $statusClass = if ($suiteData.Failed -eq 0) { 'success' } else { 'error' }

        $htmlReport += @"
    <div class="suite">
        <div class="suite-header">
            <h3>$($suite.Key) <span class="$statusClass">($($suiteData.Passed)/$($suiteData.Total) passed)</span></h3>
            <p>Type: $($suiteData.Type) | Duration: $($suiteData.Duration)ms | Exit Code: $($suiteData.ExitCode)</p>
        </div>
    </div>
"@
    }

    if ($report.Errors.Count -gt 0) {
        $htmlReport += "<h2>Errors</h2>"
        foreach ($error in $report.Errors) {
            $htmlReport += @"
    <div class="error">
        <div class="error-title">$($error.Suite) - $($error.Test)</div>
        <p><strong>File:</strong> $($error.File)</p>
        <p><strong>Error:</strong> $($error.Error)</p>
    </div>
"@
        }
    }

    $htmlReport += @"

    <h2>Environment</h2>
    <ul>
        <li><strong>OS:</strong> $($report.Environment.OS)</li>
        <li><strong>PowerShell:</strong> $($report.Environment.PowerShell)</li>
        <li><strong>Node.js:</strong> $($report.Environment.NodeJS)</li>
        <li><strong>Python:</strong> $($report.Environment.Python)</li>
    </ul>

    <h2>Artifacts</h2>
    <p>Test artifacts saved to: <code>$RUN_ARTIFACTS_DIR</code></p>

    <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666;">
        <p>Generated by Argus Test Runner at $(Get-Date)</p>
    </footer>
</body>
</html>
"@

    $htmlReportFile = Join-Path $RUN_ARTIFACTS_DIR "test-report.html"
    $htmlReport | Out-File -FilePath $htmlReportFile -Encoding UTF8

    Write-TestLog "Test report saved to: $htmlReportFile" -Level SUCCESS
    Write-TestLog "JSON report saved to: $reportFile" -Level INFO

    return $report
}

function Show-TestSummary {
    param($Report)

    Write-Host ""
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host "      TEST EXECUTION SUMMARY     " -ForegroundColor Cyan
    Write-Host "================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Run ID: $($Report.RunId)" -ForegroundColor White
    Write-Host "Duration: $($Report.Duration)" -ForegroundColor White
    Write-Host ""
    Write-Host "Test Results:" -ForegroundColor Yellow
    Write-Host "  Total Tests: $($Report.Summary.Total)" -ForegroundColor White
    Write-Host "  Passed: $($Report.Summary.Passed)" -ForegroundColor Green
    Write-Host "  Failed: $($Report.Summary.Failed)" -ForegroundColor $(if($Report.Summary.Failed -eq 0) { 'Green' } else { 'Red' })
    Write-Host "  Skipped: $($Report.Summary.Skipped)" -ForegroundColor Yellow
    Write-Host "  Success Rate: $($Report.Summary.SuccessRate)" -ForegroundColor $(if([int]$Report.Summary.SuccessRate.Replace('%','') -ge 80) { 'Green' } else { 'Red' })
    Write-Host ""

    if ($Report.Errors.Count -gt 0) {
        Write-Host "Critical Issues Found:" -ForegroundColor Red
        $Report.Errors | Select-Object -First 5 | ForEach-Object {
            Write-Host "  ❌ $($_.Suite): $($_.Test)" -ForegroundColor Red
        }
        if ($Report.Errors.Count -gt 5) {
            Write-Host "  ... and $($Report.Errors.Count - 5) more errors" -ForegroundColor Red
        }
        Write-Host ""
    }

    Write-Host "Artifacts Directory: $RUN_ARTIFACTS_DIR" -ForegroundColor Cyan
    Write-Host "Report: $(Join-Path $RUN_ARTIFACTS_DIR 'test-report.html')" -ForegroundColor Cyan
    Write-Host ""
}

# Main execution
try {
    Write-TestLog "Starting Argus Test Runner..." -Level INFO
    Write-TestLog "Test Suite: $TestSuite" -Level INFO
    Write-TestLog "Run ID: $RUN_ID" -Level INFO
    Write-TestLog "Artifacts Directory: $RUN_ARTIFACTS_DIR" -Level INFO

    # Check prerequisites
    if (-not (Test-Prerequisites)) {
        Write-TestLog "Prerequisites check failed" -Level ERROR
        exit 1
    }

    # Run tests based on suite selection
    $allPassed = $true

    switch ($TestSuite) {
        'smoke' {
            $allPassed = Invoke-SmokeTests
        }
        'unit' {
            $allPassed = (Invoke-JavaScriptTests 'unit') -and (Invoke-PythonTests 'unit')
        }
        'integration' {
            $allPassed = Invoke-JavaScriptTests 'integration'
        }
        'schema' {
            $allPassed = (Invoke-JavaScriptTests 'schema') -and (Invoke-PythonTests 'schema')
        }
        'performance' {
            $allPassed = Invoke-JavaScriptTests 'performance'
        }
        'e2e' {
            $allPassed = Invoke-JavaScriptTests 'e2e'
        }
        'negative' {
            $allPassed = Invoke-JavaScriptTests 'negative'
        }
        'all' {
            $smokePassed = Invoke-SmokeTests
            $jsPassed = Invoke-JavaScriptTests 'all'
            $pyPassed = Invoke-PythonTests 'all'
            $allPassed = $smokePassed -and $jsPassed -and $pyPassed
        }
    }

    # Generate reports
    $report = New-TestReport
    Show-TestSummary $report

    # Exit with appropriate code
    if ($allPassed) {
        Write-TestLog "All tests passed successfully! 🎉" -Level SUCCESS
        exit 0
    } else {
        Write-TestLog "Some tests failed. Check the report for details." -Level ERROR
        exit 1
    }

} catch {
    Write-TestLog "Test runner crashed: $($_.Exception.Message)" -Level ERROR
    Write-TestLog "Stack trace: $($_.ScriptStackTrace)" -Level ERROR
    exit 2
}