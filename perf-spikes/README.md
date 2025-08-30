# Project Argus Performance Spikes

This directory contains performance improvement spikes for Project Argus, each designed to improve specific performance metrics while maintaining all existing guardrails and constraints.

## Guardrails
- ❌ No API/schema changes
- ❌ No relaxation of PII/robots/TTL policies
- ✅ Maintain performance budgets and canary gates

## Performance Spikes

### [SPIKE-001: Pre-warm MCP](SPIKE-001-PREWARM-MCP.md)
**Objective**: Reduce open_ms by 10-20% through browser pre-warming
**Target Metric**: p95_open_ms
**Expected Improvement**: 10-20% reduction

### [SPIKE-002: Heuristic Pane-ready Detection](SPIKE-002-PANE-READY-HEURISTIC.md)
**Objective**: Reduce pane_ms tail latency through intelligent detection
**Target Metric**: p95_pane_ms
**Expected Improvement**: 10%+ reduction

## Template
Use [TEMPLATE.md](TEMPLATE.md) as a starting point for new performance spikes.

## Experiment Process

1. **Implement** the spike in a separate branch
2. **Test** using the A/B framework:
   ```bash
   pnpm run perf:ab
   pnpm run perf:check
   ```
3. **Analyze** results against baseline
4. **Document** findings
5. **Decide** whether to merge or discard

## Success Criteria
- ✅ p95_open_ms OR p95_pane_ms reduction ≥10% (REAL environment)
- ✅ No increase in dup_rate
- ✅ No PII leaks
- ✅ Maintains all existing guardrails

## Testing Commands
```bash
# Run A/B testing
pnpm run perf:ab

# Check for performance regression
pnpm run perf:check
```

## Directory Structure
```
perf-spikes/
├── README.md                    # This file
├── TEMPLATE.md                  # Template for new spikes
├── SPIKE-001-PREWARM-MCP.md     # Pre-warm MCP implementation
├── SPIKE-002-PANE-READY-HEURISTIC.md  # Heuristic pane detection
└── ...                          # Future spikes
```
