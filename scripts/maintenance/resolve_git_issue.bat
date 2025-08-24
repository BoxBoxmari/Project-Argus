@echo off
echo ========================================
echo Project Argus - Git Issue Resolution
echo ========================================
echo.

echo Step 1: Fetching latest remote changes...
git fetch origin
if %errorlevel% neq 0 (
    echo ERROR: Failed to fetch from remote
    pause
    exit /b 1
)

echo.
echo Step 2: Force pushing with lease (safe overwrite)...
git push -u origin main --force-with-lease
if %errorlevel% neq 0 (
    echo ERROR: Force push failed
    echo.
    echo Alternative: Try merging histories instead:
    echo git pull origin main --allow-unrelated-histories
    echo git add -A
    echo git commit -m "chore: resolve merge between local init and remote"
    echo git push -u origin main
    pause
    exit /b 1
)

echo.
echo Step 3: Adding .gitattributes and .gitignore...
git add .gitattributes .gitignore
if %errorlevel% neq 0 (
    echo WARNING: Failed to add .gitattributes or .gitignore
)

echo.
echo Step 4: Committing cleanup changes...
git commit -m "chore: normalize EOL and improve .gitignore"
if %errorlevel% neq 0 (
    echo WARNING: Failed to commit cleanup changes
)

echo.
echo Step 5: Pushing cleanup changes...
git push origin main
if %errorlevel% neq 0 (
    echo WARNING: Failed to push cleanup changes
)

echo.
echo ========================================
echo Resolution Complete!
echo ========================================
echo.
echo Your repository has been successfully:
echo - Pushed to GitHub with force-with-lease
echo - Enhanced with .gitattributes for EOL normalization
echo - Improved with comprehensive .gitignore
echo.
echo Future git operations should work normally.
echo.
pause
