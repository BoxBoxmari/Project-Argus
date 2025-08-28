Whitelist keep:
- apps/{e2e,userscript,scraper-playwright}
- libs/{js-core,runner-crawlee}
- .github/workflows, scripts, tools, docs
Remove:
- **/dist/**, **/.playwright/**, **/.ms-playwright/**, **/coverage/**
- **/datasets/** except apps/scraper-playwright/datasets/.keep
- *.log, **/*.tmp, **/*.bak, **/.DS_Store
Move to apps/e2e/fixtures: any HTML/DOM mocks currently outside e2e
