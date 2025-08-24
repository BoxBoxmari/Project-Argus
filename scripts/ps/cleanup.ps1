#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$patterns = @(
    'node_modules','dist','build','coverage','.nyc_output','playwright-report','test-results',
    'blob-report','.trace','*.har','*.mp4','*.webm','*.zip',
    '.venv','__pycache__','.pytest_cache','.ipynb_checkpoints','.ruff_cache','.mypy_cache',
    '.cache','.temp','.tmp','*.log','Transcripts'
)

Write-Host "Argus cleanup: removing dev artefacts" 
foreach ($p in $patterns) {
    Get-ChildItem -Path . -Filter $p -Recurse -Force -ErrorAction SilentlyContinue |
        ForEach-Object {
            if (Test-Path $_.FullName) {
                Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
                Write-Host "Removed $($_.FullName)"
            }
        }
}

# Ensure ignored data dirs exist but empty
$dirs = @('datasets','data','outputs','artifacts')
foreach ($d in $dirs) { 
    New-Item -ItemType Directory -Path $d -Force | Out-Null 
}
'placeholder' | Out-File -Encoding utf8 (Join-Path 'datasets' '.gitkeep')

Write-Host "Cleanup completed successfully!" -ForegroundColor Green
