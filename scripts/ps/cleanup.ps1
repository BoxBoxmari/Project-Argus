# cleanup.ps1 - Clean development artifacts
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Section([string]$t) { 
    Write-Host "`n== $t ==" -ForegroundColor Cyan 
}

function Remove-IfExists([string]$path, [string]$description) {
    if (Test-Path $path) {
        Write-Host "Removing $description..." -ForegroundColor Yellow
        Remove-Item -Recurse -Force $path -ErrorAction SilentlyContinue
        Write-Host "✓ Removed $description" -ForegroundColor Green
    } else {
        Write-Host "No $description to remove" -ForegroundColor Gray
    }
}

Write-Section "Cleaning Development Artifacts"

# Node.js build artifacts
Remove-IfExists ".\libs\js-core\dist" "js-core build artifacts"
Remove-IfExists ".\apps\scraper-playwright\dist" "scraper-playwright build artifacts"
Remove-IfExists ".\apps\userscript\dist" "userscript build artifacts"

# TypeScript build info
Get-ChildItem -Path . -Filter "*.tsbuildinfo" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host "✓ Removed TypeScript build info: $($_.Name)" -ForegroundColor Green
}

# Node modules and cache
if ($env:PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD -eq "1") {
    Remove-IfExists ".\node_modules\.cache" "Node.js cache"
    Remove-IfExists ".\playwright\.local-browsers" "Playwright browser cache"
    Remove-IfExists ".\apps\scraper-playwright\playwright\.local-browsers" "Scraper Playwright browser cache"
}

# Python artifacts
Remove-IfExists ".\py\ingest\__pycache__" "Python ingest cache"
Remove-IfExists ".\py\analysis\__pycache__" "Python analysis cache"
Remove-IfExists ".\py\ingest\.venv" "Python ingest virtual environment"
Remove-IfExists ".\py\analysis\.venv" "Python analysis virtual environment"

# Data and output directories (preserve .gitkeep)
if (Test-Path ".\datasets") {
    Get-ChildItem ".\datasets" -Exclude ".gitkeep" | Remove-Item -Recurse -Force
    Write-Host "✓ Cleaned datasets directory (preserved .gitkeep)" -ForegroundColor Green
}

if (Test-Path ".\outputs") {
    Remove-Item ".\outputs" -Recurse -Force
    Write-Host "✓ Removed outputs directory" -ForegroundColor Green
}

if (Test-Path ".\logs") {
    Remove-Item ".\logs" -Recurse -Force
    Write-Host "✓ Removed logs directory" -ForegroundColor Green
}

# Build artifacts
Remove-IfExists ".\dist" "Root dist directory"
Remove-IfExists ".\build" "Build directory"
Remove-IfExists ".\coverage" "Coverage reports"

# IDE and editor files
Remove-IfExists ".\.vscode" "VS Code settings"
Remove-IfExists ".\.idea" "IntelliJ IDEA settings"
Remove-IfExists ".\*.swp" "Vim swap files"
Remove-IfExists ".\*.swo" "Vim swap files"

# OS-specific files
Remove-IfExists ".\Thumbs.db" "Windows thumbnail cache"
Remove-IfExists ".\.DS_Store" "macOS system files"

# Temporary files
Get-ChildItem -Path . -Filter "*.tmp" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host "✓ Removed temporary file: $($_.Name)" -ForegroundColor Green
}

Get-ChildItem -Path . -Filter "*.log" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host "✓ Removed log file: $($_.Name)" -ForegroundColor Green
}

# HAR and screenshot files
Get-ChildItem -Path . -Filter "*.har" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host "✓ Removed HAR file: $($_.Name)" -ForegroundColor Green
}

Get-ChildItem -Path . -Filter "*.png" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host "✓ Removed screenshot: $($_.Name)" -ForegroundColor Green
}

# Media files
Get-ChildItem -Path . -Filter "*.mp4" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host "✓ Removed video file: $($_.Name)" -ForegroundColor Green
}

Get-ChildItem -Path . -Filter "*.webm" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item $_.FullName -Force
    Write-Host "✓ Removed video file: $($_.Name)" -ForegroundColor Green
}

Write-Section "Cleanup Complete"
Write-Host "✓ Development environment cleaned successfully" -ForegroundColor Green
Write-Host "Run 'pnpm -w install' to reinstall dependencies if needed" -ForegroundColor Yellow
