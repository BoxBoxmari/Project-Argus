# Repo-wide Fix Report

## Cleanup & Restructure Summary
- Updated cleanup and ignore lists
- Removed tracked dataset artifacts
- Catalogued project workspaces and scripts
- Added TLS error bypass logic for Playwright scraper

## Items skipped due to prior existence
- .editorconfig, .gitattributes, pnpm-workspace.yaml
- tsconfig.base.json, existing ESLint config
- pyproject.toml and pytest.ini
- .github/workflows/ci.yml already covers CI

## TLS bypass fallback for SSL inspection networks
- Scraper retries with `--ignore-certificate-errors` and `ignoreHTTPSErrors` when TLS errors occur
- `ARGUS_TLS_BYPASS=1` forces insecure mode

## Stacks skipped (no module/crate)
- Rust: no rust crates

