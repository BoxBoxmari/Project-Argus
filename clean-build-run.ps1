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

Write-Section "Stopping node"
Stop-IfRunning node

Write-Section "Cleaning dist folders"
$targets = @(
  ".\libs\js-core\dist",
  ".\apps\scraper-playwright\dist"
)
foreach($t in $targets){
  if (Test-Path $t) { Remove-Item -Recurse -Force $t }
}
Get-ChildItem -Path . -Directory -Filter dist -Recurse -ErrorAction SilentlyContinue |
  Remove-Item -Recurse -Force

Write-Section "Building workspace"
pnpm -w run build

Write-Section "Running scraper"
pwsh -f .\run.ps1

Write-Section "Artifacts"
if (Test-Path .\libs\js-core\dist) {
  Get-ChildItem .\libs\js-core\dist -Force | Format-Table Mode,Length,Name
} else { Write-Host "missing: libs/js-core/dist" -ForegroundColor Yellow }

if (Test-Path .\apps\scraper-playwright\dist) {
  Get-ChildItem .\apps\scraper-playwright\dist -Force | Format-Table Mode,Length,Name
} else { Write-Host "missing: apps/scraper-playwright/dist" -ForegroundColor Yellow }

Write-Host "`nDone."