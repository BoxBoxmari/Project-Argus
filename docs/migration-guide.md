# Repository Restructuring Migration Guide

## Overview

This document outlines the migration from the old repository structure to the new monorepo organization for Project Argus.

## What Changed

### Before (Old Structure)
```
argus/
├── apps/api-go/           # Go orchestrator service
├── apps/processor-python/ # Python data processor
├── services/              # Service definitions
├── scripts/               # Various scripts
├── test_runner.mjs        # Main test runner
├── scrape.mjs            # Scraping logic
└── Various scattered files
```

### After (New Structure)
```
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

## Migration Steps

### 1. Repository Cleanup

```bash
# Create cleanup branch
git checkout -b chore/cleanup-restructure

# Run cleanup script
pwsh -f scripts/ps/cleanup.ps1

# Run repository hardening
pwsh -f scripts/ps/repo-hardening.ps1
```

### 2. New Development Workflow

#### Node.js Development
```bash
# Install dependencies
pnpm -w install

# Build all packages
pnpm -w run build

# Lint all packages
pnpm -w run lint

# Development mode
pnpm -w run dev
```

#### Python Development
```bash
# Setup ingest environment
cd py/ingest
uv venv
uv pip sync requirements.txt

# Setup analysis environment
cd ../analysis
uv venv
uv pip sync requirements.txt
```

### 3. File Migrations

#### Moved Files
- `test_runner.mjs` → `apps/scraper-playwright/src/main.ts`
- `scrape.mjs` → Integrated into Playwright scraper
- Python processing → `py/ingest/src/processor.py`
- Go service → Preserved in `apps/api-go/` (legacy)

#### New Files
- `apps/userscript/` - Browser-based extraction
- `libs/js-core/` - Shared utilities
- `py/analysis/` - Data analysis tools
- `specs/` - Data schemas and contracts
- `docs/` - Comprehensive documentation

## Breaking Changes

### 1. Script Commands
**Old:**
```bash
npm run crawl
npm run process
```

**New:**
```bash
# Build userscript
cd apps/userscript && pnpm run build

# Run scraper
cd apps/scraper-playwright && pnpm run start

# Process data
cd py/ingest && uv run python src/processor.py input.json
```

### 2. File Paths
**Old:**
```
out/argus.user.js
data/urls.txt
```

**New:**
```
apps/userscript/dist/argus.user.js
datasets/urls.txt
```

### 3. Dependencies
**Old:** npm + pip
**New:** pnpm + uv

## Benefits of New Structure

### 1. Clear Separation of Concerns
- **Extraction**: Userscript and Playwright scraper
- **Processing**: Python ingest module
- **Analysis**: Jupyter notebooks
- **Utilities**: Shared JavaScript library

### 2. Better Development Experience
- Workspace-based dependency management
- Consistent tooling across packages
- Automated CI/CD pipeline
- Comprehensive linting and formatting

### 3. Improved Maintainability
- Modular architecture
- Clear dependency boundaries
- Standardized build processes
- Better error handling

## Troubleshooting

### Common Issues

#### 1. Build Failures
```bash
# Clean and rebuild
pnpm -w run clean
pnpm -w install
pnpm -w run build
```

#### 2. Python Environment Issues
```bash
# Recreate virtual environment
cd py/ingest
rm -rf .venv
uv venv
uv pip sync requirements.txt
```

#### 3. TypeScript Errors
```bash
# Check TypeScript configuration
pnpm -w run typecheck

# Fix linting issues
pnpm -w run lint --fix
```

### Getting Help

1. Check the main README.md for quick start guide
2. Review architecture.md for technical details
3. Run repository hardening script for diagnostics
4. Check CI workflow for automated testing

## Next Steps

### Immediate Actions
1. ✅ Complete repository restructuring
2. ✅ Set up CI/CD pipeline
3. ✅ Create comprehensive documentation
4. ✅ Test build and lint processes

### Future Enhancements
1. Add comprehensive test coverage
2. Implement automated deployment
3. Create development environment setup script
4. Add performance monitoring and metrics

## Rollback Plan

If issues arise, you can rollback to the previous structure:

```bash
# Revert to previous commit
git reset --hard HEAD~1

# Or restore from backup branch
git checkout backup/old-structure
git checkout -b restore/old-structure
```

## Support

For questions or issues with the migration:
1. Review this migration guide
2. Check the troubleshooting section
3. Run diagnostic scripts
4. Create an issue in the repository

---

**Migration completed:** $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
**Next review:** After 1 week of development
