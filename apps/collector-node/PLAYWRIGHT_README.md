# Argus Playwright Collector

This is the refactored Argus collector using Playwright instead of Puppeteer,
mirroring the userscript functionality in modular JavaScript/TypeScript components.

## Architecture

The collector is organized into 6 main modules:

### 1. Core Modules

- **`src/core/selectors.ts`** - SSOT for DOM selectors and query utilities
- **`src/core/bus.ts`** - Progress/data bus (BroadcastChannel + localStorage fallback)

### 2. Miner Module

- **`src/miner/reviews.ts`** - Browser context mining logic (ensureOpened,
  scrollDriver, parseOne, collectLoop)
- **`src/miner/bootstrap.ts`** - Page injection bootstrap for exposing miner to
  window

### 3. Driver Module

- **`src/driver/playwright.ts`** - Playwright browser orchestration (launch
  headed/stealth, inject anti-idle, orchestrate runs)

### 4. Orchestrator Module

- **`src/orchestrator/index.ts`** - URL queue management, spawn tabs, autostart
  flags, progress monitoring
- **`src/orchestrator/cli.ts`** - Command-line interface

### 5. Storage Modules

- **`src/storage/fsJsonl.ts`** - NDJSON streaming writer
- **`src/storage/sqlite.ts`** - SQLite storage (placeholder for future
  implementation)

## Features

### Mirrored Userscript Behavior

- ✅ Robust selectors with fallbacks (SELS.panel, SELS.reviewItem)
- ✅ Anti-idle shim + GL kick to keep UI rendering in background
- ✅ ensureOpened() with multiple click strategies + wheel events
- ✅ Progress emitter with debouncing (300-800ms)
- ✅ Scroll driver with controlled scrolling and "More" button clicking
- ✅ Review parser with translation handling

### Performance Optimizations

- ✅ Headed mode by default (better compatibility)
- ✅ Optional resource blocking (images/videos/fonts)
- ✅ Deduplication by review_id
- ✅ Streaming NDJSON output
- ✅ Concurrency control

## Usage

### Install Dependencies

```bash
npm install
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Mine Reviews

#### From URL file

```bash
npm run mine -- --file example-places.txt --output reviews.ndjson
```

#### From specific URLs

```bash
npm run mine-urls -- "https://www.google.com/maps/place/..." --output reviews.ndjson
```

#### With options

```bash
npm run mine -- --file places.txt --output reviews.ndjson --concurrency 2 --headless --delay 1000 --block-images
```

### CLI Options

- `--file <file>` - File containing URLs to process (default: places.txt)
- `--output <file>` - Output NDJSON file (default: reviews.ndjson)
- `--concurrency <number>` - Number of concurrent browsers (default: 1)
- `--headless` - Run in headless mode (default: headed)
- `--delay <ms>` - Delay between URLs in milliseconds (default: 0)
- `--retries <number>` - Number of retries per URL (default: 0)
- `--timeout <ms>` - Page load timeout (default: 120000)
- `--block-images` - Block image resources
- `--block-videos` - Block video resources
- `--block-fonts` - Block font resources

## Data Schema

Reviews are exported as NDJSON with the following schema:

```json
{
  "place_url": "https://www.google.com/maps/place/...",
  "place_id": "extracted_place_id",
  "captured_at": "2024-01-01T00:00:00.000Z",
  "review_id": "review_identifier",
  "author": "Review Author Name",
  "relative_time": "2 days ago",
  "text": "Review content text",
  "rating": 5,
  "translated": false,
  "likes": 10,
  "photos": 2
}
```

## Development

### Project Structure

```text
src/
├── core/           # Core utilities (selectors, bus)
├── miner/          # Browser context mining logic
├── driver/         # Playwright orchestration
├── orchestrator/   # Queue management and CLI
└── storage/        # Data persistence
```

### Key Design Principles

- **Mirror userscript behavior**: No behavioral changes from original userscript
- **SSOT for selectors**: All DOM queries use shared selector definitions
- **Driver separation**: Playwright only handles navigation and injection
- **Streaming output**: NDJSON written as data is collected
- **Observable**: Progress tracking via BroadcastChannel + fallbacks

### Testing

```bash
npm test              # Run all tests
npm run build         # TypeScript compilation
npm run lint          # ESLint
```

## Migration from Puppeteer

This Playwright implementation replaces the Puppeteer-based scraper with:

- Better stability and performance
- Cleaner modular architecture
- Direct userscript behavior mirroring
- Improved error handling and retry logic
- Standardized NDJSON output format
