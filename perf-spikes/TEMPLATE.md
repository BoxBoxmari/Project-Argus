# Performance Spike Template

## Overview
This template provides a structured approach for implementing and testing performance improvements in Project Argus while maintaining all existing guardrails and constraints.

## Guardrails
- ❌ No API/schema changes
- ❌ No relaxation of PII/robots/TTL policies
- ✅ Maintain performance budgets and canary gates

## Candidate Improvements

### 1. Pre-warm MCP
**Hypothesis**: Pre-warming MCP with a dedicated user-data-dir and profile cache can reduce open_ms by 10-20%

**Implementation Plan**:
- Create a separate user data directory for MCP
- Implement profile caching mechanism
- Pre-load commonly used resources

**Files to Modify**:
- `libs/runner-hybrid/src/mcp.ts`

**Rollback Plan**:
- Revert to original launchPersistentContext call

### 2. Heuristic Pane-ready Detection
**Hypothesis**: Using IntersectionObserver + network quiet detection can reduce pane_ms tail latency

**Implementation Plan**:
- Implement IntersectionObserver for pane visibility
- Add network idle detection
- Combine with timeout fallback

**Files to Modify**:
- `libs/runner-hybrid/src/mcp.ts`

**Rollback Plan**:
- Revert to DOM wait approach

### 3. Partial Hydration
**Hypothesis**: Attaching listeners only when pane is visible can reduce CPU usage

**Implementation Plan**:
- Implement lazy listener attachment
- Detect pane visibility before attaching handlers

**Files to Modify**:
- `libs/runner-hybrid/src/mcp.ts`

**Rollback Plan**:
- Revert to immediate listener attachment

### 4. CSS-only Blocklist
**Hypothesis**: Using CSS-only blocking instead of route handlers for fixed types can reduce overhead

**Implementation Plan**:
- Implement CSS-based resource blocking
- Replace route handler for specific resource types

**Files to Modify**:
- `libs/runner-hybrid/src/mcp.ts`

**Rollback Plan**:
- Revert to route handler approach

## Experiment Plan

### AB#1: Pre-warm vs Control
- **Objective**: Measure impact of MCP pre-warming
- **Metrics**: p95_open_ms reduction
- **Success Criteria**: ≥10% improvement in REAL environment

### AB#2: Pane-ready Heuristic vs DOM Wait
- **Objective**: Measure impact of heuristic pane detection
- **Metrics**: p95_pane_ms reduction
- **Success Criteria**: ≥10% improvement in REAL environment

## Success Criteria
- ✅ p95_open_ms OR p95_pane_ms reduction ≥10% (REAL environment)
- ✅ No increase in dup_rate
- ✅ No PII leaks

## Testing Commands
```bash
# Run A/B testing
pnpm run perf:ab

# Check for performance regression
pnpm run perf:check
```

## Implementation Guidelines
1. **Limit Changes**: Maximum 2 files per spike
2. **Rollback Ready**: Each spike must have a clear rollback plan
3. **Measure Impact**: Use existing A/B testing framework
4. **Validate Safety**: Ensure no regression in data quality or security

## Data Collection
- Collect metrics from `results/ab/ab.results.json`
- Compare against baseline in `metrics/perf.baseline.json`
- Document findings in spike-specific report

## Risk Mitigation
- Test in isolated environment first
- Validate no impact on data quality
- Ensure PII protection remains intact
- Confirm robots.txt compliance maintained
