# Maintenance mode
- Winner: MCP Chrome (PERF_MODE=1, resource blocking on).
- Budgets: SIM p95_open/pane <= 3500ms; REAL p95_open <= 2000ms, pane <= 15000ms (guarded).
- Weekly: ops + gitleaks + retention. Nightly: triage + KPI (giữ nguyên).
- Khi drift: điều chỉnh selector fallback, không đổi API/schema.
