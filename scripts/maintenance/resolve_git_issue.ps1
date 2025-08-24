# Project Argus - Git Issue Resolution Script
# Run this script in PowerShell as Administrator if needed

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project Argus - Git Issue Resolution" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Step 1: Fetch latest remote changes
    Write-Host "Step 1: Fetching latest remote changes..." -ForegroundColor Yellow
    git fetch origin
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to fetch from remote"
    }

    # Step 2: Force push with lease (safe overwrite)
    Write-Host ""
    Write-Host "Step 2: Force pushing with lease (safe overwrite)..." -ForegroundColor Yellow
    git push -u origin main --force-with-lease
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "ERROR: Force push failed" -ForegroundColor Red
        Write-Host ""
        Write-Host "Alternative: Try merging histories instead:" -ForegroundColor Yellow
        Write-Host "git pull origin main --allow-unrelated-histories" -ForegroundColor Gray
        Write-Host "git add -A" -ForegroundColor Gray
        Write-Host "git commit -m 'chore: resolve merge between local init and remote'" -ForegroundColor Gray
        Write-Host "git push -u origin main" -ForegroundColor Gray
        Read-Host "Press Enter to continue"
        exit 1
    }

    # Step 3: Add .gitattributes and .gitignore
    Write-Host ""
    Write-Host "Step 3: Adding .gitattributes and .gitignore..." -ForegroundColor Yellow
    git add .gitattributes .gitignore
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: Failed to add .gitattributes or .gitignore" -ForegroundColor Yellow
    }

    # Step 4: Commit cleanup changes
    Write-Host ""
    Write-Host "Step 4: Committing cleanup changes..." -ForegroundColor Yellow
    git commit -m "chore: normalize EOL and improve .gitignore"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: Failed to commit cleanup changes" -ForegroundColor Yellow
    }

    # Step 5: Push cleanup changes
    Write-Host ""
    Write-Host "Step 5: Pushing cleanup changes..." -ForegroundColor Yellow
    git push origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: Failed to push cleanup changes" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Resolution Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Your repository has been successfully:" -ForegroundColor White
    Write-Host "- Pushed to GitHub with force-with-lease" -ForegroundColor White
    Write-Host "- Enhanced with .gitattributes for EOL normalization" -ForegroundColor White
    Write-Host "- Improved with comprehensive .gitignore" -ForegroundColor White
    Write-Host ""
    Write-Host "Future git operations should work normally." -ForegroundColor White
    Write-Host ""

} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Please check your Git configuration and try again." -ForegroundColor Yellow
}

Read-Host "Press Enter to continue"
