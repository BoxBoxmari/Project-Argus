# Changelog

All notable changes to Project Argus will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - Day-2 Ops Hardening and Data Governance

### 🚀 Added

- **Data Retention System**
  - Automatic cleanup of expired datasets, reports, and artifacts
  - Configurable TTL with default 14 days (override via `ARGUS_TTL_DAYS`)
  - Retention script (`tools/ops/retention.ts`) with reporting
  - Integration with ops workflow for nightly cleanup

- **Security Hardening**
  - Weekly secret scanning via gitleaks with custom configuration (`.gitleaks.toml`)
  - Weekly npm audit for production dependencies
  - Security workflow (`.github/workflows/security.yml`)

- **CI Optimization**
  - Heavy operations moved to nightly/weekly schedules
  - PR builds focus on stable tests only
  - Ops workflow updated with retention reporting

- **Documentation Updates**
  - Added Data Retention & Security section to `HOWTO-RUN.md`
  - Enhanced `DIAGNOSIS.md` with Day-2 Ops implementation details

### 🛠️ Changed

- **Ops Workflow** (`.github/workflows/ops.yml`)
  - Added retention script execution to nightly job
  - Added retention report artifact upload
  - Updated commit message to include retention

### 🔧 Enhanced

- **Package Scripts** (`package.json`)
  - Added `ops:retention` script for manual retention cleanup

## [0.3.0] - GA Launch and Ops Guardrails

### 🚀 Added

- **GA Launch Guardrails**
  - KPI aggregator script (`tools/ops/kpi.ts`) for calculating pass rates and SLO compliance
  - Auto-promotion script (`tools/e2e/auto_promote.ts`) for promoting stable quarantine tests
  - GA release script (`tools/release/ga.js`) for tagging v0.1.0
  - SLO enforcement: dupRate < 1%, p95(open|pane) < 3500ms, robots_guard=passed
  - 3-day stable pass rate calculation from `apps/e2e/reports/history.json`

- **Operational Guardrails**
  - Ops workflow (`.github/workflows/ops.yml`) with nightly and weekly jobs
  - Nightly: Full test run + triage + auto-promotion + KPI reporting
  - Weekly: Dependency updates + security audit
  - Automatic issue creation on SLO breaches
  - Quarantine cleanup: Auto-promote tests stable for ≥14 days

- **Documentation Updates**
  - Added GA Ops section to `HOWTO-RUN.md`
  - Enhanced `DIAGNOSIS.md` with GA Ops implementation details

## [0.2.0] - Monorepo Restructuring

### 🚀 Added 1

- **Clean Monorepo Structure**
  - `apps/userscript/` - Tampermonkey bundle with TypeScript
  - `apps/scraper-playwright/` - Playwright-based scraper
  - `libs/js-core/` - Shared JavaScript utilities
  - `py/ingest/` - Python data processing module
  - `py/analysis/` - Python analysis tools
  - `scripts/ps/` - PowerShell automation scripts
  - `specs/` - JSON schemas and contracts
  - `docs/` - Comprehensive documentation

- **Modern Development Tools**
  - pnpm workspace management
  - TypeScript with strict configuration
  - ESLint and Prettier for code quality
  - GitHub Actions CI/CD pipeline
  - Comprehensive .gitignore and .gitattributes

- **PowerShell Automation**
  - `cleanup.ps1` - Development artifact cleanup
  - `setup.ps1` - Environment setup and dependency installation
  - `repo-hardening.ps1` - Repository health verification

### 🔧 Enhanced 2

- **Repository Organization**: Logical grouping of related functionality
- **Build System**: Standardized build processes across packages
- **Code Quality**: Automated linting and formatting
- **Documentation**: Comprehensive README and architecture docs
- **CI/CD**: Automated testing and validation

## [0.1.0] - Initial Release

### 🚀 Added 2

- Basic Google Maps review extraction
- Simple web scraping capabilities
- Basic data processing pipeline

---

## Development Notes

### Breaking Changes

- **v0.2.0**: Complete repository restructuring - all file paths changed
- **v0.3.0**: New advanced queue system replaces simple scraping logic

### Migration Guide

- See `docs/migration-guide.md` for detailed migration instructions
- Use PowerShell scripts for automated setup and cleanup
- Follow new monorepo structure for development

### Testing

- Run `pnpm -w run test` for JavaScript/TypeScript tests
- Run `uv run pytest` in Python modules for Python tests
- Use `scripts/ps/setup.ps1` for environment setup

### Performance Considerations

- Queue system designed for high-throughput scenarios
- Autoscaling prevents resource exhaustion
- Rate limiting prevents service blocking
- NDJSON format enables streaming processing

### Security Features

- Domain isolation prevents cross-site interference
- Rate limiting prevents abuse
- Input validation via JSON schemas
- Secure error handling without information leakage
