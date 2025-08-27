---
trigger: always_on
alwaysApply: true
---

# Qoder Operational Rules — Project Argus (VS Code/Qoder)

## Persistence
- Do not ask the human to confirm or clarify assumptions, as you can always adjust later.
- Choose the most reasonable assumption, act, then log deltas in `CHANGELOG.md`.
- Cap actions per session: 1 repo scan, 1 config read, 1 smoke run.

## Extensions Inventory → Usage Map
> Qoder must auto-decide per task. Prefer repo configs over global settings.

### Core for Argus (ENABLED)
- **GitHub Copilot + Copilot Chat**: inline completions; never commit code without tests passing. Disable on secrets files.
- **GitLens**: blame, last-change, PR links for triage. Use to locate regression commits.
- **GitHub Pull Requests**: open PR from current branch; post failing test summary.
- **BasedPyright + Pylance + Python/Python Debugger/Python Environments**:
  - Run `pyright -p .` (CI typecheck).
  - Debug pytest; auto-attach to tests.
  - Ensure `.venv` selected; write `.vscode/settings.json` if missing.
- **isort**: sort imports on save for `/py/**`. Pair with Black/ruff if present.
- **JavaScript Debugger (Nightly)**: Node/Playwright debug sessions.
- **Quokka.js**: quick JS/TS snippets; never commit scratch files.
- **EditorConfig**: enforce LF, final newline.
- **Prettier**: default formatter for JS/TS/JSON/MD. Defer to ESLint if rule conflicts.
- **Markdown All in One**: table of contents for docs.
- **Jupyter (+ Keymap/Renderers/Slide Show/Cell Tags)**: ad-hoc data QA; export to HTML when asked.
- **YAML**: schema hints for GitHub Actions.
- **Rainbow CSV**: quick CSV inspection for datasets.
- **Path Intellisense, npm Intellisense**: path and package autocompletion.
- **HTML CSS Support, open in browser, Live Server**: preview docs/site assets when needed.
- **indent-rainbow, Material Icon Theme, vscode-icons**: readability only.
- **WakaTime**: metrics; no effect on behavior.

### Conditional (USE ONLY IF MATCHING CODE EXISTS)
- **C/C++ pack, Better C++ Syntax, CMake/CMake Tools** → if `/cpp|/c/` or `CMakeLists.txt`.
- **C#, .NET Install Tool** → if `/csharp/` or `.csproj`.
- **Java, Gradle for Java** → if `/java/` or `build.gradle`.
- **PHP Debug/IntelliSense** → if `/php/` or `composer.json`.
- **Dart/Flutter** → if `/dart/` or `flutter.yaml`.
- **Django, Jinja** → if `/django/` or `manage.py`.

## Auto-Behavior
- Prefer **non-interactive commands** and **workspace files** over manual UI.
- Never install marketplace extensions automatically; only generate commands/instructions.
- Mask secrets; do not paste tokens into settings.

## Workflows

### Static Analysis
- JS/TS: run `pnpm -r run lint || npx eslint .` then `npx tsc --noEmit` if `tsconfig.json` exists.
- Python: run `pyright -p . && ruff check . && mypy .`.

### Tests
- JS/TS: `pnpm test` if available; else scaffold Playwright/Jest.
- Python: `pytest -q`. If absent, scaffold `tests/` with schema/dedupe checks.

### Debug Presets (`.vscode/launch.json`)
```json
{
  "version": "0.2.0",
  "configurations": [
    { "type":"pwa-node","request":"launch","name":"Node Tests","program":"${workspaceFolder}/node_modules/jest/bin/jest.js","args":["--runInBand"] },
    { "type":"node","request":"launch","name":"Playwright","program":"${workspaceFolder}/node_modules/@playwright/test/cli.js","args":["test","--headed"] },
    { "type":"python","request":"launch","name":"Pytest","module":"pytest","args":["-q"] }
  ]
}
