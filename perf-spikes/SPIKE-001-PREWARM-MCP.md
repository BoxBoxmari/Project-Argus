# SPIKE-001: Pre-warm MCP Performance Improvement

## Overview
Implement MCP pre-warming with dedicated user-data-dir and profile cache to reduce open_ms by 10-20%.

## Hypothesis
Pre-warming the MCP browser instance with a dedicated user profile and cached resources can significantly reduce initial page load times by avoiding cold start penalties.

## Implementation Plan

### Current Implementation (`libs/runner-hybrid/src/mcp.ts`)
```typescript
const context = await chromium.launchPersistentContext('', {
  headless: !opts.headful,
  locale: opts.locale,
  channel: process.env.ARGUS_BROWSER_CHANNEL || 'chrome'
});
```

### Proposed Changes
1. Create a dedicated user data directory for MCP
2. Implement profile caching mechanism
3. Pre-load commonly used resources

### Modified Implementation
```typescript
// Create dedicated user data directory
const userDataDir = process.env.MCP_USER_DATA_DIR || './.mcp-profile-cache';
mkdirSync(userDataDir, { recursive: true });

// Pre-warm the browser context with cached profile
const context = await chromium.launchPersistentContext(userDataDir, {
  headless: !opts.headful,
  locale: opts.locale,
  channel: process.env.ARGUS_BROWSER_CHANNEL || 'chrome',
  args: [
    '--disk-cache-dir=./.mcp-cache',
    '--media-cache-size=1000000',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ]
});
```

## Files to Modify
1. `libs/runner-hybrid/src/mcp.ts` - Main implementation
2. `libs/runner-hybrid/src/config/defaults.ts` - Add MCP profile configuration

## Rollback Plan
If performance improvement is not achieved or issues arise:
1. Revert to original `launchPersistentContext('')` call
2. Remove additional Chromium arguments
3. Remove user data directory creation

## Experiment Design

### A/B Test Configuration
- **Control Group**: Current implementation
- **Test Group**: Pre-warmed implementation
- **Metrics**: p95_open_ms
- **Environment**: REAL (using real Google Maps URL)

### Testing Commands
```bash
# Run A/B test for pre-warm improvement
pnpm run perf:ab

# Check performance regression
pnpm run perf:check
```

## Success Criteria
- ✅ p95_open_ms reduction ≥10% in REAL environment
- ✅ No increase in dup_rate
- ✅ No PII leaks
- ✅ Maintains robots.txt compliance

## Risk Assessment
1. **Profile Corruption**: Cached profiles may become corrupted
   - Mitigation: Implement profile validation and fallback

2. **Increased Disk Usage**: Profile caching may increase disk usage
   - Mitigation: Implement cache cleanup mechanism

3. **Browser Compatibility**: Additional flags may cause compatibility issues
   - Mitigation: Test with multiple Chrome versions

## Implementation Steps

### Step 1: Modify Defaults Configuration
File: `libs/runner-hybrid/src/config/defaults.ts`

Add MCP profile configuration:
```typescript
export const DEFAULTS = {
  // ... existing configuration ...
  mcp: {
    userDataDir: process.env.MCP_USER_DATA_DIR || './.mcp-profile-cache',
    cacheDir: process.env.MCP_CACHE_DIR || './.mcp-cache',
    enablePreWarm: process.env.MCP_PREWARM === '1'
  }
} as const;
```

### Step 2: Modify MCP Implementation
File: `libs/runner-hybrid/src/mcp.ts`

Implement pre-warming logic:
```typescript
import { mkdirSync } from 'node:fs';
import { DEFAULTS } from './config/defaults';

export async function runMcpChrome(url:string, opts:Opts){
  // Create user data directory if pre-warming is enabled
  let userDataDir = '';
  if (DEFAULTS.mcp.enablePreWarm) {
    userDataDir = DEFAULTS.mcp.userDataDir;
    mkdirSync(userDataDir, { recursive: true });
  }

  // Launch with pre-warmed profile
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: !opts.headful,
    locale: opts.locale,
    channel: process.env.ARGUS_BROWSER_CHANNEL || 'chrome',
    ...(DEFAULTS.mcp.enablePreWarm && {
      args: [
        `--disk-cache-dir=${DEFAULTS.mcp.cacheDir}`,
        '--media-cache-size=1000000',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    })
  });

  // ... rest of implementation
}
```

## Validation Plan

### Performance Testing
1. Run A/B test with current implementation (baseline)
2. Run A/B test with pre-warmed implementation
3. Compare p95_open_ms metrics

### Data Quality Testing
1. Verify no increase in duplicate rates
2. Confirm PII protection remains intact
3. Validate data schema compliance

### Security Testing
1. Ensure robots.txt compliance maintained
2. Verify no unauthorized resource access
3. Confirm TLS settings unchanged

## Expected Outcomes
- **Primary**: 10-20% reduction in p95_open_ms
- **Secondary**: Improved consistency in page load times
- **Tertiary**: Reduced cold start latency

## Timeline
- Implementation: 2 days
- Testing: 3 days
- Analysis: 1 day
- Total: 6 days
