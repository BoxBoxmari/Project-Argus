# SPIKE-002: Heuristic Pane-ready Detection

## Overview
Implement IntersectionObserver + network quiet detection to reduce pane_ms tail latency.

## Hypothesis
Using a combination of visual detection (IntersectionObserver) and network activity monitoring can more accurately determine when the reviews pane is ready, reducing unnecessary waiting time and tail latency.

## Implementation Plan

### Current Implementation (`libs/runner-hybrid/src/mcp.ts`)
```typescript
// Pane heuristic - áp dụng "wait-for-visible-or-timeout" với DOM guard
const t1 = Date.now();
// Tự động tạo patch nếu lỗi thuộc: selector drift, timeout, rate-limit, dup-id, PII leak
try {
  // Wait for pane to be visible or timeout
  await Promise.race([
    page.locator('#pane, [aria-label*="Reviews"], [aria-label*="Bài đánh giá"]').first().waitFor({ state: 'visible' }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Pane timeout')), opts.paneTimeoutMs))
  ]);
} catch (e: any) {
  console.warn(`[mcp] Pane wait error: ${e.message}`);
}
const pane_ms = Date.now() - t1;
```

### Proposed Changes
1. Implement IntersectionObserver for pane visibility detection
2. Add network idle detection
3. Combine both signals with timeout fallback

### Modified Implementation
```typescript
const t1 = Date.now();
try {
  // Wait for pane to be ready using heuristic approach
  await Promise.race([
    waitForPaneReady(page, opts),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Pane timeout')), opts.paneTimeoutMs))
  ]);
} catch (e: any) {
  console.warn(`[mcp] Pane wait error: ${e.message}`);
}
const pane_ms = Date.now() - t1;

// Heuristic pane ready function
async function waitForPaneReady(page: Page, opts: Opts) {
  // Wait for element to be in viewport using IntersectionObserver
  await page.evaluate(() => {
    return new Promise((resolve) => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            observer.disconnect();
            resolve(true);
          }
        });
      });

      // Observe the pane element
      const pane = document.querySelector('#pane, [aria-label*="Reviews"], [aria-label*="Bài đánh giá"]');
      if (pane) {
        observer.observe(pane);
      } else {
        // Fallback if element not found immediately
        resolve(true);
      }
    });
  });

  // Wait for network to become idle
  await page.waitForLoadState('networkidle');
}
```

## Files to Modify
1. `libs/runner-hybrid/src/mcp.ts` - Main implementation

## Rollback Plan
If performance improvement is not achieved or issues arise:
1. Revert to original DOM wait approach
2. Remove IntersectionObserver implementation
3. Remove network idle detection

## Experiment Design

### A/B Test Configuration
- **Control Group**: Current DOM wait implementation
- **Test Group**: Heuristic pane detection implementation
- **Metrics**: p95_pane_ms
- **Environment**: REAL (using real Google Maps URL)

### Testing Commands
```bash
# Run A/B test for pane-ready heuristic improvement
pnpm run perf:ab

# Check performance regression
pnpm run perf:check
```

## Success Criteria
- ✅ p95_pane_ms reduction ≥10% in REAL environment
- ✅ No increase in dup_rate
- ✅ No PII leaks
- ✅ Maintains robots.txt compliance

## Risk Assessment
1. **Browser Compatibility**: IntersectionObserver may not be supported in all environments
   - Mitigation: Implement feature detection and fallback

2. **False Positives**: Heuristic may incorrectly detect pane readiness
   - Mitigation: Add validation checks for content presence

3. **Network Detection**: networkidle state may not accurately reflect content readiness
   - Mitigation: Combine with visual detection

## Implementation Steps

### Step 1: Implement Heuristic Detection
File: `libs/runner-hybrid/src/mcp.ts`

Replace the current pane waiting logic with the heuristic approach:

```typescript
// Pane heuristic - áp dụng "wait-for-visible-or-timeout" với DOM guard
const t1 = Date.now();
try {
  // Wait for pane to be ready using heuristic approach
  await Promise.race([
    waitForPaneReady(page, opts),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Pane timeout')), opts.paneTimeoutMs))
  ]);
} catch (e: any) {
  console.warn(`[mcp] Pane wait error: ${e.message}`);
}
const pane_ms = Date.now() - t1;

// Heuristic pane ready function
async function waitForPaneReady(page: any, opts: any) {
  // Try to use IntersectionObserver for visual detection
  const visualReady = page.evaluate(() => {
    return new Promise((resolve) => {
      // Check if pane is already visible
      const pane = document.querySelector('#pane, [aria-label*="Reviews"], [aria-label*="Bài đánh giá"]');
      if (pane && pane.getBoundingClientRect().top < window.innerHeight) {
        resolve(true);
        return;
      }

      // If not visible, set up intersection observer
      if (window.IntersectionObserver) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              observer.disconnect();
              resolve(true);
            }
          });
        }, { threshold: 0.1 });

        if (pane) {
          observer.observe(pane);
          // Timeout fallback
          setTimeout(() => {
            observer.disconnect();
            resolve(true);
          }, 1000);
        } else {
          resolve(true);
        }
      } else {
        // Fallback for browsers without IntersectionObserver
        resolve(true);
      }
    });
  });

  // Wait for network to become relatively idle
  const networkReady = page.waitForLoadState('networkidle');

  // Wait for both conditions with a reasonable timeout
  await Promise.all([
    Promise.race([visualReady, new Promise(resolve => setTimeout(resolve, 2000))]),
    Promise.race([networkReady, new Promise(resolve => setTimeout(resolve, 3000))])
  ]);
}
```

## Validation Plan

### Performance Testing
1. Run A/B test with current implementation (baseline)
2. Run A/B test with heuristic implementation
3. Compare p95_pane_ms metrics

### Data Quality Testing
1. Verify no increase in duplicate rates
2. Confirm PII protection remains intact
3. Validate that all reviews are still captured

### Compatibility Testing
1. Test with different browser versions
2. Verify fallback behavior works correctly
3. Confirm no JavaScript errors in console

## Expected Outcomes
- **Primary**: 10%+ reduction in p95_pane_ms
- **Secondary**: Reduced tail latency (99th percentile)
- **Tertiary**: More consistent pane detection timing

## Timeline
- Implementation: 2 days
- Testing: 3 days
- Analysis: 1 day
- Total: 6 days
