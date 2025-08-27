$ErrorActionPreference = 'Stop'

Write-Host "[python-check] Starting Python code quality checks..."

# Setup tools if .venv doesn't exist
if (-not (Test-Path ".venv")) {
    Write-Host "[python-check] Setting up Python tools first..."
    & scripts\setup-python-tools.ps1
}

# Get the Python path
$pythonPath = Join-Path (Get-Location) ".venv" "Scripts" "python.exe"

# Run checks
try {
    Write-Host "[python-check] Running ruff linter..."
    & $pythonPath -m ruff check . --fix

    Write-Host "[python-check] Running mypy type checker..."
    & $pythonPath -m mypy . --ignore-missing-imports

    Write-Host "[python-check] Running pytest..."
    & $pythonPath -m pytest -q

    Write-Host "[python-check] All Python checks passed!"
} catch {
    Write-Warning "[python-check] Some checks failed: $($_.Exception.Message)"
    exit 1
}