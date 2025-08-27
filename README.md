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

## 🧪 Execution Flow Diagrams

### Plugin System Execution Flow
```
sequenceDiagram
participant Orchestrator
participant PluginManager
participant Plugin1 as \"Plugin A\"
participant Plugin2 as \"Plugin B\"

Orchestrator->>PluginManager : init(ctx)
PluginManager->>Plugin1 : init(ctx)
Plugin1-->>PluginManager : Complete
PluginManager->>Plugin2 : init(ctx)
Plugin2-->>PluginManager : Complete
PluginManager-->>Orchestrator : All plugins initialized

Orchestrator->>PluginManager : run(ctx)
PluginManager->>Plugin1 : run(ctx)
Plugin1-->>PluginManager : Complete
PluginManager->>Plugin2 : run(ctx)
Plugin2-->>PluginManager : Complete
PluginManager-->>Orchestrator : All plugins executed

Orchestrator->>PluginManager : teardown(ctx)
PluginManager->>Plugin1 : teardown(ctx)
Plugin1-->>PluginManager : Complete
PluginManager->>Plugin2 : teardown(ctx)
Plugin2-->>PluginManager : Complete
PluginManager-->>Orchestrator : All plugins cleaned up
```

### Playwright Scraper Execution Flow
```
flowchart TD
Start([Start]) --> ReadConfig[\"Read Environment Variables\"]
ReadConfig --> ValidateConfig[\"Validate Configuration\"]
ValidateConfig --> CreateOrchestrator[\"Create ScraperOrchestrator\"]
CreateOrchestrator --> AddUrls[\"Add URLs to Queue\"]
AddUrls --> StartOrchestrator[\"Start Orchestrator\"]
StartOrchestrator --> ProcessRequests[\"Process Requests with Retry Logic\"]
ProcessRequests --> CheckRateLimit[\"Check Domain Rate Limits\"]
CheckRateLimit --> ExecuteScrape[\"Execute Scrape with Browser\"]
ExecuteScrape --> ExtractData[\"Extract Reviews from Page\"]
ExtractData --> ValidateData[\"Validate Review Schema\"]
ValidateData --> StoreResults[\"Store Results in NDJSON\"]
StoreResults --> MonitorProgress[\"Monitor Progress and Statistics\"]
MonitorProgress --> Complete[\"Scraping Complete\"]
Complete --> Exit[\"Exit with Status Code\"]
style Start fill:#6f9,stroke:#333
style Exit fill:#6f9,stroke:#333
```

### Retry Mechanism Flow
```
flowchart TD
Start([Attempt Request]) --> Success{\"Success?\"}
Success --> |Yes| Complete([Request Complete])
Success --> |No| ShouldRetry[\"Check shouldRetry Condition\"]
ShouldRetry --> |No| Fail([Final Failure])
ShouldRetry --> |Yes| IsLastAttempt[\"Is Last Attempt?\"]
IsLastAttempt --> |Yes| ThrowError([Throw RetryError])
IsLastAttempt --> |No| CalculateDelay[\"Calculate Delay with Exponential Backoff\"]
CalculateDelay --> Wait[\"Wait for Delay Period\"]
Wait --> Start
```

### Navigation and Error Resilience Flow
```
flowchart TD
Start([Start]) --> ReadEnv[\"Read Environment Variables\"]
ReadEnv --> DefineProfiles[\"Define Security Profiles\"]
DefineProfiles --> LoopProfiles[\"For each profile: secure → insecure → insecure_no_sandbox\"]
LoopProfiles --> LaunchBrowser[\"Launch Browser with Profile\"]
LaunchBrowser --> Navigate[\"Navigate to Target URL\"]
Navigate --> Success{\"Navigation Success?\"}
Success --> |Yes| ExitSuccess[\"Exit Successfully\"]
Success --> |No| Retry{\"Attempts Remaining?\"}
Retry --> |Yes| Wait[\"Wait with Backoff\"]
Wait --> Navigate
Retry --> |No| NextProfile[\"Try Next Profile\"]
NextProfile --> LaunchBrowser
NextProfile --> FinalFailure[\"All Profiles Failed\"]
FinalFailure --> ThrowError[\"Throw Protocol Error\"]
style ExitSuccess fill:#6f9,stroke:#333
style ThrowError fill:#f66,stroke:#333
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
