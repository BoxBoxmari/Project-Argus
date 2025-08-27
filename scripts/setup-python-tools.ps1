$ErrorActionPreference = 'Stop'

Write-Host "[setup-python-tools] Setting up Python development tools..."

# Check if .venv exists
if (-not (Test-Path ".venv")) {
    Write-Host "[setup-python-tools] Creating virtual environment..."
    py -m venv .venv
}

# Get the Python path
$pythonPath = Join-Path (Get-Location) ".venv" "Scripts" "python.exe"

# Install/upgrade pip and tools
Write-Host "[setup-python-tools] Installing development dependencies..."
& $pythonPath -m pip install --upgrade pip
& $pythonPath -m pip install -r python-dev-requirements.txt

Write-Host "[setup-python-tools] Python tools installed in .venv"
Write-Host "[setup-python-tools] Available tools: ruff, mypy, pytest, black, isort"