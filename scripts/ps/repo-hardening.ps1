#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

Write-Host "Hardening Project Argus repository..." -ForegroundColor Cyan

# Set recommended git settings
Write-Host "Setting git configuration..." -ForegroundColor Yellow
git config core.autocrlf false
git config core.ignorecase true
git config fetch.prune true
git config pull.rebase true
git config rebase.autoStash true

# Create .gitkeep files for ignored directories
Write-Host "Creating .gitkeep files..." -ForegroundColor Yellow
$dirs = @('datasets', 'data', 'outputs', 'artifacts')
foreach ($d in $dirs) {
    if (!(Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
    $gitkeep = Join-Path $d '.gitkeep'
    if (!(Test-Path $gitkeep)) {
        'placeholder' | Out-File -Encoding utf8 $gitkeep
        Write-Host "Created $gitkeep"
    }
}

# Verify .gitignore is comprehensive
Write-Host "Verifying .gitignore..." -ForegroundColor Yellow
$gitignore = Get-Content .gitignore -Raw
$requiredPatterns = @(
    'node_modules/',
    'dist/',
    'build/',
    '.venv/',
    '__pycache__/',
    'datasets/',
    '*.log',
    '*.tmp'
)

$missingPatterns = @()
foreach ($pattern in $requiredPatterns) {
    if ($gitignore -notmatch [regex]::Escape($pattern)) {
        $missingPatterns += $pattern
    }
}

if ($missingPatterns.Count -gt 0) {
    Write-Host "Warning: Missing patterns in .gitignore:" -ForegroundColor Yellow
    foreach ($pattern in $missingPatterns) {
        Write-Host "  - $pattern" -ForegroundColor Red
    }
} else {
    Write-Host "✓ .gitignore is comprehensive" -ForegroundColor Green
}

# Check for large files that shouldn't be tracked
Write-Host "Checking for large files..." -ForegroundColor Yellow
$largeFiles = git ls-files | ForEach-Object {
    if (Test-Path $_) {
        $size = (Get-Item $_).Length
        if ($size -gt 1MB) {
            [PSCustomObject]@{
                File = $_
                Size = [math]::Round($size / 1MB, 2)
                SizeUnit = 'MB'
            }
        }
    }
}

if ($largeFiles) {
    Write-Host "Warning: Large files found:" -ForegroundColor Yellow
    foreach ($file in $largeFiles) {
        Write-Host "  - $($file.File): $($file.Size) $($file.SizeUnit)" -ForegroundColor Red
    }
    Write-Host "Consider adding these to .gitignore or using git-lfs" -ForegroundColor Yellow
} else {
    Write-Host "✓ No large files found" -ForegroundColor Green
}

# Verify workspace configuration
Write-Host "Verifying workspace configuration..." -ForegroundColor Yellow
if (Test-Path 'package.json') {
    $packageJson = Get-Content 'package.json' | ConvertFrom-Json
    if ($packageJson.workspaces) {
        Write-Host "✓ Workspace configuration found" -ForegroundColor Green
    } else {
        Write-Host "Warning: No workspace configuration in package.json" -ForegroundColor Yellow
    }
} else {
    Write-Host "Warning: No package.json found" -ForegroundColor Yellow
}

# Check for proper TypeScript configuration
Write-Host "Checking TypeScript configuration..." -ForegroundColor Yellow
if (Test-Path 'tsconfig.json') {
    Write-Host "✓ Root tsconfig.json found" -ForegroundColor Green
} else {
    Write-Host "Warning: No root tsconfig.json found" -ForegroundColor Yellow
}

# Verify CI workflow
Write-Host "Checking CI workflow..." -ForegroundColor Yellow
if (Test-Path '.github/workflows/ci.yml') {
    Write-Host "✓ CI workflow found" -ForegroundColor Green
} else {
    Write-Host "Warning: No CI workflow found" -ForegroundColor Yellow
}

Write-Host "`nRepository hardening completed!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Review any warnings above" -ForegroundColor White
Write-Host "2. Commit .gitkeep files if needed" -ForegroundColor White
Write-Host "3. Test the build process: pnpm -w run build" -ForegroundColor White
Write-Host "4. Run cleanup: pwsh -f scripts/ps/cleanup.ps1" -ForegroundColor White
