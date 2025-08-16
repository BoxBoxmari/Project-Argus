# Project Argus - Puppeteer Improvements Summary

## Overview

This document summarizes the improvements made to the Project Argus Puppeteer scraper to enhance compatibility, performance, and stability across different Puppeteer versions.

## Key Improvements Implemented

### 1. Compatibility Layer (`lib/compat.js`)

- **`addInitScriptCompat()`** - Handles different Puppeteer versions for script injection
- **`newPageCompat()`** - Creates isolated browser contexts with graceful fallbacks
- **`sleepCompat()`** - Unified sleep function that works across all Puppeteer versions
- **`forceEnLocale()`** - Ensures consistent English locale for stable selectors
- **`shouldBlockRequest()`** - Identifies and blocks noisy Google requests

### 2. Request Blocking & Noise Reduction

- Blocks `/gen_204` and `/vt/stream` requests that cause log noise and timeouts
- Implements proper request interception with error handling
- Reduces unnecessary network traffic and improves performance

### 3. Strict Time Budget Enforcement

- Enforces `ARGUS_USERSCRIPT_BUDGET_MS` strictly to prevent runaway processes
- Provides detailed logging of time usage and remaining budget
- Ensures predictable resource consumption

### 4. Locale Standardization

- Forces `hl=en-US` parameter on all URLs for consistent selector behavior
- Handles URL parsing errors gracefully with fallback approaches
- Improves stability across different language versions of Google Maps

### 5. Enhanced Error Handling

- Graceful fallbacks for missing Puppeteer APIs
- Better logging of compatibility issues and fallback usage
- Maintains functionality even when certain features are unavailable

## Technical Details

### Compatibility Functions

```javascript
// Script injection with fallback
await addInitScriptCompat(page, scriptContent);

// Page creation with isolated context
const page = await newPageCompat(browser);

// Unified sleep function
await sleepCompat(page, milliseconds);

// Locale forcing
const url = forceEnLocale(inputUrl);

// Request filtering
if (shouldBlockRequest(req.url())) req.abort();
```

### Request Blocking Patterns

- `/gen_204` - Google analytics/tracking requests
- `/vt/stream` - Google Maps streaming data
- Graceful fallback if interception fails

### Time Budget Management

- Strict enforcement of `ARGUS_USERSCRIPT_BUDGET_MS`
- Real-time monitoring of elapsed vs. remaining time
- Automatic termination when budget is exhausted

## Benefits

1. **Cross-Version Compatibility**: Works with Puppeteer 18+ (recommended 24.9.0+)
2. **Performance**: Reduced noise and timeouts from blocked requests
3. **Stability**: Consistent behavior across different locales and environments
4. **Resource Management**: Predictable time and memory usage
5. **Maintainability**: Centralized compatibility logic in `compat.js`

## Usage

### Environment Variables

```bash
# Time budget for userscript execution (default: 90000ms)
ARGUS_USERSCRIPT_BUDGET_MS=60000

# Headless mode (default: true)
ARGUS_HEADLESS=true

# Locale preference (default: en-US)
ARGUS_LOCALE=en-US,en;q=0.9
```

### Running the Scraper

```bash
# Basic usage
node scraper.js <url> <output.json>

# With custom time budget
ARGUS_USERSCRIPT_BUDGET_MS=30000 node scraper.js <url> <output.json>
```

## Future Considerations

1. **Puppeteer Version**: Consider upgrading to 24.9.0+ for best compatibility
2. **Node.js**: Requires Node.js 18+ for optimal performance
3. **Monitoring**: The improved logging provides better visibility into system behavior
4. **Extensibility**: The compatibility layer can be extended for future Puppeteer versions

## Files Modified

- `worker-node/puppeteer_engine/lib/compat.js` - Extended compatibility layer
- `worker-node/puppeteer_engine/scraper.js` - Updated to use compatibility functions
- `worker-node/package.json` - Added engine requirements and recommendations

## Testing Recommendations

1. Test with different Puppeteer versions (18.x, 21.x, 24.x)
2. Verify locale handling with different Google Maps language versions
3. Monitor time budget enforcement under various load conditions
4. Check request blocking effectiveness in different network environments

---

*Last updated: $(date)*
*Project Argus v1.0.1*
