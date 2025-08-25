# Repo-wide Fix Report
- Fixed: pnpm workspaces detection, TS base config, missing package for apps/scraper-playwright.
- Python: added src-layout, pyproject, fixed ruff auto-fix, unified tests to avoid duplicate module names, ensured pytest module path.
- Go/Rust: iterate per-module, correct clippy arg via `-- -D warnings`.
- CI: added Node, Python, Go, Rust jobs.
- TODO: implement actual scraping logic in apps/scraper-playwright/src/index.ts and expand tests.
- Added Playwright browser auto-install and graceful skip when no Rust crates.