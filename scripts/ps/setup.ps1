#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host "Setting up Argus development environment..." -ForegroundColor Cyan

# Check prerequisites
$prerequisites = @{
    'Node.js' = 'node --version'
    'pnpm' = 'pnpm --version'
    'Python' = 'python --version'
    'uv' = 'uv --version'
}

$missing = @()
foreach ($prereq in $prerequisites.GetEnumerator()) {
    try {
        $null = Invoke-Expression $prereq.Value
        Write-Host "✓ $($prereq.Key) found" -ForegroundColor Green
    } catch {
        Write-Host "✗ $($prereq.Key) not found" -ForegroundColor Red
        $missing += $prereq.Key
    }
}

if ($missing.Count -gt 0) {
    Write-Host "`nMissing prerequisites: $($missing -join ', ')" -ForegroundColor Yellow
    Write-Host "Please install missing tools and run setup again." -ForegroundColor Yellow
    exit 1
}

# Install Node.js dependencies
Write-Host "`nInstalling Node.js dependencies..." -ForegroundColor Cyan
try {
    pnpm -w install
    Write-Host "✓ Node.js dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "✗ Failed to install Node.js dependencies" -ForegroundColor Red
    exit 1
}

# Setup Python environment
Write-Host "`nSetting up Python environment..." -ForegroundColor Cyan
try {
    # Create virtual environment for ingest
    Set-Location py/ingest
    uv venv
    uv pip sync requirements.txt
    Write-Host "✓ Python ingest environment setup" -ForegroundColor Green
    
    # Setup analysis environment (optional)
    Set-Location ../analysis
    uv venv
    uv pip sync requirements.txt
    Write-Host "✓ Python analysis environment setup" -ForegroundColor Green
    
    Set-Location ../..
} catch {
    Write-Host "✗ Failed to setup Python environment" -ForegroundColor Red
    exit 1
}

# Run initial build
Write-Host "`nRunning initial build..." -ForegroundColor Cyan
try {
    pnpm -w run build
    Write-Host "✓ Initial build completed" -ForegroundColor Green
} catch {
    Write-Host "✗ Initial build failed" -ForegroundColor Red
    exit 1
}

# Run linting
Write-Host "`nRunning linting..." -ForegroundColor Cyan
try {
    pnpm -w run lint
    Write-Host "✓ Linting passed" -ForegroundColor Green
} catch {
    Write-Host "✗ Linting failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n🎉 Argus development environment setup completed successfully!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Run 'pnpm -w run dev' to start development mode" -ForegroundColor White
Write-Host "2. Run 'pnpm -w run test' to run tests" -ForegroundColor White
Write-Host "3. Check the README.md for more information" -ForegroundColor White
