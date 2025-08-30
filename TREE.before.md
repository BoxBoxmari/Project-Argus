# Project Tree (post-cleanup)
``
├─.cspell.json
├─.depcheck.json
├─.editorconfig
├─.eslintignore
├─.eslintrc.json
├─.hintrc
├─.knip.json
├─.prettierrc
├─.qoder
│ └─rules
│   ├─00-readthis-first.md
│   ├─Bmad-Fullstack-App.md
│   └─Extensions.md
├─.tsprune.json
├─.vscode
│ └─settings.json
├─CHANGELOG.md
├─CLEANUP_MANIFEST.json
├─CLEANUP_RULES.md
├─CODEOWNERS
├─COMMIT_MESSAGE.txt
├─CRAWLEE_MCP_INTEGRATION_SUMMARY.md
├─CSPELL_DICTIONARY_FIX.md
├─CSPELL_IMPLEMENTATION.md
├─DATA_CONTRACT.md
├─DATA_QUALITY_REPORT.md
├─DAY2_OPS_HARDENING_SUMMARY.md
├─DEADCODE_CONSOLIDATION_SUMMARY.md
├─DEADCODE_REPORT.json
├─DIAGNOSIS.md
├─FINAL_VERIFICATION_SUMMARY.md
├─GA_LAUNCH_SUMMARY.md
├─HOWTO-RUN.md
├─INVENTORY.md
├─MAINTENANCE.md
├─OPS_REPORT.md
├─PATCH_NOTES.md
├─PRODUCTION_HARDENING_SUMMARY.md
├─PROVENANCE.json
├─README.md
├─REFACTORING_CHANGELOG.md
├─RELEASE_COMPLETION_SUMMARY.md
├─RELEASE_NOTES.md
├─RELEASE_PROCESS.md
├─RETENTION_REPORT.md
├─SECURITY.md
├─STRUCTURE.md
├─TASKS.md
├─TREE.before.md
├─TREE.md
├─WORKSPACE_INVENTORY.json
├─apps
│ ├─e2e
│ │ ├─DIAGNOSIS.md
│ │ ├─HOWTO-RUN.md
│ │ ├─apps
│ │ │ └─e2e
│ │ │   └─scenarios
│ │ │     └─sim.cases.json
│ │ ├─package.json
│ │ ├─playwright.config.ts
│ │ ├─scenarios
│ │ │ └─sim.cases.json
│ │ ├─test-results
│ │ │ └─.last-run.json
│ │ ├─test.cdx.json
│ │ ├─tests
│ │ │ ├─_metrics.ts
│ │ │ ├─_setup.routes.ts
│ │ │ ├─ab.final.spec.ts
│ │ │ ├─crawlee.smoke.spec.ts
│ │ │ ├─gmaps.real.spec.ts
│ │ │ ├─gmaps.sim.spec.ts
│ │ │ ├─load.real.spec.ts
│ │ │ ├─real.matrix.spec.ts
│ │ │ ├─routes.har.README.md
│ │ │ ├─sim.matrix.spec.ts
│ │ │ └─simple.test.ts
│ │ └─tools
│ │   └─gen-scenarios.ts
│ ├─scraper-playwright
│ │ ├─.env.example
│ │ ├─.eslintrc.cjs
│ │ ├─DIAGNOSIS.md
│ │ ├─README.md
│ │ ├─datasets
│ │ │ ├─.keep
│ │ │ ├─datasets
│ │ │ │ └─default
│ │ │ │   └─data.json
│ │ │ ├─reviews.ndjson
│ │ │ ├─scraper-output.ndjson
│ │ │ └─test-reviews.ndjson
│ │ ├─package.json
│ │ ├─src
│ │ │ ├─cli.ts
│ │ │ ├─crawler.ts
│ │ │ ├─index.ts
│ │ │ ├─launcher.ts
│ │ │ ├─main.ts
│ │ │ ├─playwright.ts
│ │ │ └─test-google-maps.ts
│ │ ├─test-results.json
│ │ ├─tsconfig.json
│ │ ├─tsconfig.tsbuildinfo
│ │ └─types.d.ts
│ └─userscript
│   ├─.eslintrc.cjs
│   ├─DIAGNOSIS.md
│   ├─package.json
│   ├─selector_map.json
│   ├─src
│   │ ├─dom.ts
│   │ ├─extractor.ts
│   │ ├─globals.d.ts
│   │ ├─index.ts
│   │ ├─locators.ts
│   │ ├─log.ts
│   │ ├─logging.ts
│   │ ├─normalize.ts
│   │ ├─polyfills
│   │ │ └─gm.ts
│   │ ├─progress.ts
│   │ ├─pseudo.ts
│   │ ├─scheduler.ts
│   │ ├─storage.ts
│   │ └─transport.ts
│   ├─tools
│   │ ├─mcp-selector-audit.md
│   │ └─mcp-ui-drift.yaml
│   ├─tsconfig.json
│   └─tsconfig.tsbuildinfo
├─attic
│ └─2025-08-28T16-12-48-658Z
│   └─README.md
├─clean-build-run.ps1
├─config
│ └─cspell-words.txt
├─cspell.json
├─data
│ └─raw
│   └─seed_urls.txt
├─datasets
│ └─reviews.ndjson
├─debug-output.txt
├─docs
│ ├─CLEANUP.md
│ ├─REPORT.md
│ ├─WORKSPACE.md
│ ├─architecture.md
│ ├─migration-guide.md
│ └─retry-example.md
├─export
│ └─reviews.safe.jsonl
├─generate-report.js
├─jest.config.ts
├─knip-ignore.json
├─knip.json
├─libs
│ ├─js-core
│ │ ├─.eslintignore
│ │ ├─README.md
│ │ ├─build.cjs
│ │ ├─package.json
│ │ ├─sbom
│ │ │ └─sbom.test.cdx.json
│ │ ├─sbom.test.cdx.json
│ │ ├─src
│ │ │ ├─__tests__
│ │ │ │ ├─domain-utils.test.ts
│ │ │ │ ├─request-queue.test.ts
│ │ │ │ ├─retry.test.ts
│ │ │ │ └─session.test.ts
│ │ │ ├─dataset.ts
│ │ │ ├─domain-utils.ts
│ │ │ ├─errors.ts
│ │ │ ├─extractors
│ │ │ │ └─gmaps.ts
│ │ │ ├─gmaps
│ │ │ │ ├─progress.ts
│ │ │ │ ├─schema.ts
│ │ │ │ ├─scroll.ts
│ │ │ │ └─selectors.ts
│ │ │ ├─id
│ │ │ │ ├─review_id.ts
│ │ │ │ └─review_id_node.ts
│ │ │ ├─index.ts
│ │ │ ├─net
│ │ │ │ └─blocklist.ts
│ │ │ ├─obs
│ │ │ │ └─events.ts
│ │ │ ├─persist.ts
│ │ │ ├─plugin.ts
│ │ │ ├─queue
│ │ │ │ └─memoryQueue.ts
│ │ │ ├─queue.ts
│ │ │ ├─request-queue.ts
│ │ │ ├─retry.ts
│ │ │ ├─sanitize
│ │ │ │ ├─pii.ts
│ │ │ │ └─pseudo.ts
│ │ │ ├─schema
│ │ │ │ ├─review.schema.json
│ │ │ │ └─review.ts
│ │ │ ├─session
│ │ │ │ └─sessionPool.ts
│ │ │ ├─session.ts
│ │ │ └─util
│ │ │   ├─retry.ts
│ │ │   └─text.ts
│ │ ├─test
│ │ │ ├─pii.fuzz.spec.ts
│ │ │ ├─sanitize
│ │ │ │ └─pii.spec.ts
│ │ │ └─smoke.spec.ts
│ │ ├─tsconfig.json
│ │ ├─tsconfig.tsbuildinfo
│ │ ├─uas.json
│ │ └─vitest.config.ts
│ ├─runner-crawlee
│ │ ├─--generateTrace
│ │ ├─package.json
│ │ ├─src
│ │ │ ├─extractor.ts
│ │ │ ├─index.ts
│ │ │ ├─middleware
│ │ │ │ ├─rate.ts
│ │ │ │ └─robots.ts
│ │ │ ├─test-extractor.ts
│ │ │ └─types
│ │ │   └─robots-txt-parse.d.ts
│ │ ├─storage
│ │ │ ├─key_value_stores
│ │ │ │ └─default
│ │ │ │   ├─SDK_CRAWLER_STATISTICS_0.json
│ │ │ │   └─SDK_SESSION_POOL_STATE.json
│ │ │ └─request_queues
│ │ │   └─default
│ │ │     └─GyBryNqOTsT7drB.json
│ │ └─tsconfig.json
│ └─runner-hybrid
│   ├─package.json
│   ├─src
│   │ ├─config
│   │ │ └─defaults.ts
│   │ ├─index.ts
│   │ ├─mcp.ts
│   │ ├─pw_crawlee.ts
│   │ └─userscript_harness.ts
│   └─tsconfig.json
├─metrics
│ ├─perf.baseline.detail.json
│ ├─perf.baseline.json
│ ├─perf.check.txt
│ └─perf.spike.txt
├─package.json
├─perf-spikes
│ ├─README.md
│ ├─SPIKE-001-PREWARM-MCP.md
│ ├─SPIKE-002-PANE-READY-HEURISTIC.md
│ └─TEMPLATE.md
├─pnpm-lock.yaml
├─pnpm-workspace.yaml
├─problems-report.json
├─py
│ ├─README.md
│ ├─analysis
│ │ ├─requirements.txt
│ │ └─src
│ │   └─__init__.py
│ ├─ingest
│ │ ├─process_ndjson.py
│ │ ├─processor_python
│ │ │ ├─__init__.py
│ │ │ ├─__pycache__
│ │ │ │ ├─__init__.cpython-313.pyc
│ │ │ │ ├─etl.cpython-313.pyc
│ │ │ │ └─schema.cpython-313.pyc
│ │ │ ├─api_client.py
│ │ │ ├─cli.py
│ │ │ ├─cx_map.py
│ │ │ ├─etl.py
│ │ │ ├─modules
│ │ │ │ ├─__init__.py
│ │ │ │ └─link_extractor.py
│ │ │ └─schema.py
│ │ ├─requirements.txt
│ │ ├─run_ingest.ps1
│ │ └─src
│ │   ├─__init__.py
│ │   ├─dedup.py
│ │   ├─processor.py
│ │   └─schema.py
│ ├─pyproject.toml
│ ├─pytest.ini
│ ├─schema.py
│ ├─src
│ │ ├─processor_python
│ │ │ ├─__init__.py
│ │ │ ├─__pycache__
│ │ │ │ ├─__init__.cpython-313.pyc
│ │ │ │ └─schema.cpython-313.pyc
│ │ │ ├─etl.py
│ │ │ └─schema.py
│ │ └─processor_python.egg-info
│ │   ├─PKG-INFO
│ │   ├─SOURCES.txt
│ │   ├─dependency_links.txt
│ │   ├─requires.txt
│ │   └─top_level.txt
│ └─tests
│   ├─__pycache__
│   │ ├─test_link_extractor.cpython-313-pytest-8.2.0.pyc
│   │ └─test_link_extractor.cpython-313-pytest-8.4.1.pyc
│   └─test_link_extractor.py
├─pyproject.toml
├─pyrightconfig.json
├─python
│ ├─pyproject.toml
│ └─src
│   ├─argus_workspace.egg-info
│   │ ├─PKG-INFO
│   │ ├─SOURCES.txt
│   │ ├─dependency_links.txt
│   │ ├─requires.txt
│   │ └─top_level.txt
│   ├─processor_python
│   │ ├─__init__.py
│   │ ├─__pycache__
│   │ │ ├─__init__.cpython-313.pyc
│   │ │ ├─etl.cpython-313.pyc
│   │ │ └─schema.cpython-313.pyc
│   │ ├─etl.py
│   │ ├─quality
│   │ │ ├─__init__.py
│   │ │ ├─__pycache__
│   │ │ │ ├─__init__.cpython-313.pyc
│   │ │ │ ├─gates.cpython-313.pyc
│   │ │ │ └─types.cpython-313.pyc
│   │ │ ├─gates.py
│   │ │ └─types.py
│   │ └─schema.py
│   └─processor_python.egg-info
│     ├─PKG-INFO
│     ├─SOURCES.txt
│     ├─dependency_links.txt
│     ├─requires.txt
│     └─top_level.txt
├─python-dev-requirements.txt
├─sbom
│ ├─combined.cdx.json
│ ├─sbom._argus_e2e.cdx.json
│ ├─sbom._argus_js-core.cdx.json
│ ├─sbom._argus_runner-crawlee.cdx.json
│ ├─sbom._argus_scraper-playwright.cdx.json
│ └─sbom._argus_userscript.cdx.json
├─schemas
│ └─review.schema.json
├─scripts
│ ├─clean-build-run.ps1
│ ├─cleanup.ts
│ ├─manual-test-suite.ps1
│ ├─ps
│ │ ├─cleanup.ps1
│ │ ├─repo-hardening.ps1
│ │ ├─run.ps1
│ │ └─setup.ps1
│ ├─python-check.ps1
│ ├─release.ps1
│ ├─rollback.ps1
│ ├─setup-python-tools.ps1
│ ├─test-runner.ps1
│ ├─test-suite.ps1
│ └─verify-release.ps1
├─services
│ └─orchestrator-go
│   ├─go.mod
│   └─main.go
├─stryker.conf.json
├─test-data-quality.js
├─test-data-quality.ts
├─test-dist
│ └─test.txt
├─test-report.md
├─test.txt
├─tests
│ ├─.artifacts
│ │ └─integration-tests
│ │   └─minimal-fixture-results.json
│ ├─__pycache__
│ │ ├─conftest.cpython-313-pytest-8.2.0.pyc
│ │ └─conftest.cpython-313.pyc
│ ├─conftest.py
│ ├─e2e
│ │ ├─README.md
│ │ ├─cli-pipeline.test.ts
│ │ ├─data-quality.test.ts
│ │ └─run-e2e-tests.ts
│ ├─fixtures
│ │ └─maps
│ │   ├─case_complex
│ │   │ └─index.html
│ │   ├─case_complex.html
│ │   ├─case_dom_shift
│ │   │ └─index.html
│ │   ├─case_i18n_mixed
│ │   │ └─index.html
│ │   ├─case_minimal
│ │   │ └─index.html
│ │   └─case_minimal.html
│ ├─golden
│ │ ├─case_complex.json
│ │ ├─case_i18n_mixed.json
│ │ └─case_minimal.json
│ ├─integration
│ │ └─pipeline.test.ts
│ ├─jest.config.test.js
│ ├─negative
│ │ └─error-conditions.test.ts
│ ├─performance
│ │ └─large-dataset.test.ts
│ ├─setup.ts
│ ├─unit
│ │ ├─__pycache__
│ │ │ └─test_schema_validation_python.cpython-313-pytest-8.2.0.pyc
│ │ ├─deduplication.test.ts
│ │ ├─parser.extraction.test.ts
│ │ ├─schema.validation.test.ts
│ │ └─test_schema_validation_python.py
│ └─utils
│   └─dom-guards.ts
├─tools
│ ├─cleanup
│ │ ├─finalize.ts
│ │ ├─restructure.ts
│ │ └─rules.json
│ ├─data
│ │ ├─export_safe.ts
│ │ └─quality.ts
│ ├─doctor.mjs
│ ├─e2e
│ │ ├─auto_promote.ts
│ │ ├─generate-results.ts
│ │ ├─simulate-failures.ts
│ │ ├─simulate-promotion.ts
│ │ ├─simulate-runs.ts
│ │ └─triage.ts
│ ├─inventory.js
│ ├─monitor
│ │ └─post_release.js
│ ├─ops
│ │ ├─kpi.ts
│ │ └─retention.ts
│ ├─perf
│ │ ├─ab.ts
│ │ ├─baseline.detail.ts
│ │ ├─baseline.ts
│ │ ├─check-regress.ts
│ │ ├─improve-gate.ts
│ │ └─spike-close.ts
│ ├─release
│ │ ├─ga.js
│ │ ├─provenance.js
│ │ └─rc.js
│ ├─sbom
│ │ ├─assert.js
│ │ ├─from-pnpm.ts
│ │ ├─gen-workspaces.ts
│ │ └─merge.ts
│ ├─schema
│ │ └─export-jsonschema.ts
│ └─tidy
│   ├─apply-deletions.js
│   └─plan.mjs
├─tsconfig.base.json
├─tsconfig.json
├─tsconfig.test.json
├─tsprune-ignore.txt
└─validate-python-tooling.py
```
