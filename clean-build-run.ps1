# clean-build-run.ps1
[CmdletBinding()]
param(
  [string]$PnpmVersion = "10.15.0"
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Write-Section([string]$t){ Write-Host "`n== $t ==" -ForegroundColor Cyan }
function Stop-IfRunning([string]$name){
  Get-Process $name -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

# Bảo đảm đang ở thư mục script (repo root)
if ($PSScriptRoot) { Set-Location $PSScriptRoot }

# Kiểm tra repo root
if (-not (Test-Path .\package.json)) { throw "Run this script from the repo root (folder contains package.json)." }

# Bảo đảm pnpm sẵn sàng
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
  Write-Section "Activating pnpm@$PnpmVersion"
  corepack enable
  corepack prepare pnpm@$PnpmVersion --activate
}

# == Stopping node ==
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# == Cleaning dist folders ==
$paths = @(
  "libs/js-core/dist",
  "apps/scraper-playwright/dist"
)
foreach ($p in $paths) { if (Test-Path $p) { Remove-Item $p -Recurse -Force -ErrorAction SilentlyContinue } }

# Xoá mọi tsbuildinfo để tránh cache incremental
Get-ChildItem -Path "libs","apps" -Recurse -Filter "tsconfig.tsbuildinfo" -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

Write-Host "`n== Building workspace =="

# Dọn state build TypeScript ở level solution rồi build lại
pnpm -w exec tsc -b --clean
pnpm -w run build

Write-Host "`n== Running scraper =="
pnpm -C apps/scraper-playwright run build
pnpm -C apps/scraper-playwright start

Write-Section "Artifacts"
if (Test-Path .\libs\js-core\dist) {
  Get-ChildItem .\libs\js-core\dist -Force | Format-Table Mode,Length,Name
} else { Write-Host "missing: libs/js-core/dist" -ForegroundColor Yellow }

if (Test-Path .\apps\scraper-playwright\dist) {
  Get-ChildItem .\apps\scraper-playwright\dist -Force | Format-Table Mode,Length,Name
} else { Write-Host "missing: apps/scraper-playwright/dist" -ForegroundColor Yellow }

Write-Host "`nDone."