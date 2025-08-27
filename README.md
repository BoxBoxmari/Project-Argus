# Project Argus — Monorepo

A comprehensive toolkit for extracting, processing, and analyzing Google Maps review data.

## 🔄 Updates

- Bloom filter hashing improved for lower collision rates.
- Autoscaled pool cleans up timers on shutdown and reports memory usage.
- Python ingest validates schema via lightweight NDJSON generator.

## 🏗️ Architecture

```text
argus/
├── apps/
│   ├── userscript/           # Tampermonkey bundle + build
│   └── scraper-playwright/   # Playwright-based scraper
├── libs/
│   └── js-core/             # Shared JavaScript utilities
├── py/
│   ├── ingest/              # Data processing and normalization
│   └── analysis/            # Jupyter notebooks and EDA
├── scripts/
│   └── ps/                  # PowerShell utilities
├── specs/                   # JSON schemas and contracts
├── docs/                    # Documentation and ADRs
└── datasets/                # Local data storage (gitignored)
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** with pnpm
- **Python 3.11+** with uv
- **PowerShell 7+** (Windows)

### Setup

1. **Clone and setup:**

   ```bash
   git clone <repository-url>
   cd argus
   pwsh -f scripts/ps/setup.ps1
   ```

2. **Manual setup (alternative):**

   ```bash
   # Node.js dependencies
   pnpm -w install

   # Python environments
   cd py/ingest && uv venv && uv pip sync requirements.txt
   cd ../analysis && uv venv && uv pip sync requirements.txt
   ```

3. **Verify installation:**

   ```bash
   pnpm -w run build
   pnpm -w run lint
   ```

## 📦 Workspace Commands

```bash
# Build all packages
pnpm -w run build

# Lint all packages
pnpm -w run lint

# Run tests
pnpm -w run test

# Development mode
pnpm -w run dev
```

## 🔧 Individual Apps

### Userscript

```bash
cd apps/userscript
pnpm run build    # Build userscript bundle
pnpm run dev      # Watch mode
```

### Scraper

```bash
cd apps/scraper-playwright
pnpm run build    # Compile TypeScript
pnpm run start    # Run scraper
```

### Python Processing

```bash
cd py/ingest
uv run python src/processor.py input.json --output-dir datasets
```

## 🧹 Maintenance

```bash
# Clean development artifacts
pwsh -f scripts/ps/cleanup.ps1

# Repository hardening
pwsh -f scripts/ps/repo-hardening.ps1
```

## 📊 Data Flow

1. **Extraction**: Userscript or Playwright scraper collects review data
2. **Processing**: Python ingest module normalizes and validates data
3. **Analysis**: Jupyter notebooks for exploratory data analysis
4. **Output**: Parquet/CSV files for further analysis

## 🔒 Security & Compliance

- No sensitive data in repository
- Rate limiting in scrapers
- Respectful of Google Maps ToS
- Local data storage only

## 🤝 Contributing

1. Follow the established monorepo structure
2. Use pnpm workspaces for Node.js packages
3. Use uv for Python dependency management
4. Run `pnpm -w run lint` before committing
5. Update documentation for API changes

## 📝 License

MIT License - Project Argus
