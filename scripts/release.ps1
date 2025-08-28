# Release execution script
cd C:\Users\Admin\Downloads\argus_skeleton\argus
Write-Host "Running typecheck and build..." -ForegroundColor Green
pnpm -r run typecheck
pnpm -r run build

Write-Host "Creating release candidate..." -ForegroundColor Green
pnpm run release:rc

Write-Host "Pushing to origin with tags..." -ForegroundColor Green
git push origin --follow-tags

Write-Host "Release process completed!" -ForegroundColor Green
