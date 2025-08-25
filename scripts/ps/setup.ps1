#Requires -Version 7.0
$ErrorActionPreference='Stop'
# Đồng bộ pnpm phiên bản đúng
corepack enable
corepack prepare pnpm@10.15.0 --activate

# Cài workspace deps
pnpm -w install

# Nếu pnpm yêu cầu phê duyệt build scripts (ví dụ esbuild)
try { pnpm approve-builds } catch { Write-Host "approve-builds skipped" }
