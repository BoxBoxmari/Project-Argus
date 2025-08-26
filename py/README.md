# Argus Python

Chạy test: `pnpm run py:test`

## Structure
- `ingest/` - Data processing and validation modules
- `analysis/` - Jupyter notebooks for EDA
- `tests/` - Python test suite

## Setup
```bash
cd py
python -m venv .venv
.\.venv\Scripts\activate
pip install -r ingest/requirements.txt
```