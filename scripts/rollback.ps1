# Rollback script

param(
    [string]$TagName = "v0.1.0-rc.1"
)

Write-Host "Rolling back release tag: $TagName" -ForegroundColor Yellow

# Remove RC tag locally and remote
git tag -d $TagName
git push origin :refs/tags/$TagName

Write-Host "Release tag $TagName has been rolled back successfully" -ForegroundColor Green
Write-Host "To rollback the release commit, use:" -ForegroundColor Yellow
Write-Host "  git log --oneline -n 5" -ForegroundColor Cyan
Write-Host "  git revert <release_commit_sha>" -ForegroundColor Cyan
Write-Host "  git push origin HEAD" -ForegroundColor Cyan
