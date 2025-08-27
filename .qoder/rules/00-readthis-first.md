---
ruleset: Project-Argus
trigger: always_on
alwaysApply: true
version: 1.1
scope: repo
compat: qoder
---

# 00 - Read This First (Always Apply)

**Dialectic:**
- **Thesis:** giải pháp tối thiểu để build pass, không phá API, mọi thay đổi có toggle qua ENV.
- **Antithesis:** phản biện rủi ro vỡ ESM/CI/selector/I/O.
- **Synthesis:** giữ ESM, CI có điều kiện, selector theo `role→css→xpath`, I/O streaming.
- **Finalization:** lặp 1→3 đến khi không còn phản biện hợp lệ, xuất patch nhỏ, có đường lui.

**Nguyên tắc chung**
1. Minimal change, maximal effect.
2. Mọi thay đổi tắt/bật qua ENV `ARGUS_*`.
3. Không xoá hành vi cũ nếu chưa có fallback.
4. Mọi sửa kèm kiểm tra: typecheck/lint/build/test hoặc E2E ngắn.
5. Ghi giả định vào `PATCH_NOTES.md`.

---

# 01 - Global Standards (Always Apply)

- Node 20. ESM nhất quán. `moduleResolution: bundler`, `outDir: dist`.
- Không thêm CommonJS mới. Không `require` mới.
- Log lỗi có stack. Không nuốt lỗi.
- Flags qua ENV `ARGUS_*`.
- EOL: LF. Chuẩn hoá CRLF→LF khi commit.
- Không secrets trong repo. Cung cấp `.env.example`.

**Ví dụ tốt (TS ESM)**
```ts
import { doWork } from './core/do-work.js';
export async function main() {
  try { await doWork(); }
  catch (e) { console.error(e); process.exitCode = 1; }
}
```

---

# 02 - Monorepo Workspaces (Always Apply)

Áp dụng cho mọi `package.json`:

**Scripts bắt buộc nếu hợp lệ:**
- `"build": "tsc -b"`
- `"typecheck": "tsc -p tsconfig.json --noEmit"`
- `"lint": "eslint ."` hoặc in rõ `"No lint configured"`
- `"test": "vitest run"` hoặc `"echo 'No tests configured'"`
- App cần `"start": "node dist/index.js"`

Không tự thêm phụ thuộc nặng nếu không cần build/test.

---

# 03 - Scraper Playwright Hardening (Specific Files: apps/scraper-playwright/**)

- `ARGUS_BROWSER_CHANNEL` ưu tiên, mặc định `msedge`.
- `ARGUS_HEADFUL=1` hiển thị UI, mặc định headless.
- `ARGUS_TLS_BYPASS=1` → `ignoreHTTPSErrors: true` + retry khi `ERR_CERT_*`.
- Chặn tài nguyên nặng: `image|font|media|stylesheet`, bật lại nếu `ARGUS_ALLOW_MEDIA=1`.
- Điều khiển cuộn: `ARGUS_MAX_ROUNDS`, `ARGUS_IDLE_LIMIT`, `ARGUS_SCROLL_PAUSE`.
- Selector chiến lược: `getByRole` → `locator(css)` → `locator(xpath)` với timeout theo bậc.
- NDJSON append streaming. Schema tối thiểu:
  ```json
  {"place_id":"","author":"","rating":0,"text":"","date":"","url":"","fetched_at":"","lang":""}
  ```
- Telemetry nhẹ: `datasets/events.ndjson` ghi `{ts,phase,ok,err}`.
- Đóng tài nguyên trong `finally`.

**Ví dụ chặn tài nguyên**
```javascript
await page.route('**/*', r =>
  ['image','font','media','stylesheet'].includes(r.request().resourceType())
  ? r.abort() : r.continue()
);
```

---

# 04 - Userscript (Specific Files: apps/userscript/**)

- Build bằng `esbuild` IIFE.
- Header Tampermonkey đủ `@match`, `@grant`.
- Typecheck có thể skip có kiểm soát do GM APIs.
- Giảm gọi mạng ngoài; tránh CORS rủi ro.

**Banner rút gọn**
```javascript
// ==UserScript==
// @name        Argus Helper
// @match       https://www.google.com/maps/*
// @grant       GM_setValue
// ==/UserScript==
```

---

# 05 - Python Analytics (Specific Files: **/*.py)

- Chạy `ruff`/`mypy`/`pytest` chỉ khi có thể tạo `.venv` hoặc đã có `.venv`.
- Tìm `.py` trước khi kích hoạt checks; nếu không có → skip.
- NDJSON đọc streaming. Tránh `df.append` trong loop.
- Hàm pure có type hints. I/O tách lớp. Mặc định `utf-8`.

**Đọc NDJSON lớn**
```python
import json, io
with io.open('datasets/reviews.ndjson', encoding='utf-8') as f:
    for line in f:
        yield json.loads(line)
```

---

# 06 - Go API (Specific Files: apps/api-go/**)

- Public funcs và handlers dùng `context.Context`.
- Wrap lỗi bằng `%w`.
- `go vet` và `go test ./...` phải pass nếu module tồn tại.
- Logger qua interface, không gắn chặt lib.

**Ví dụ**
```go
if err != nil { return fmt.Errorf("load config: %w", err) }
```

---

# 07 - CI Windows (Always Apply)

- Runner chính `windows-latest`.
- Node job: `typecheck` → `lint(if-present)` → `build` → `test(if-present)`.
- Python job: chỉ chạy khi có `**/*.py`.
- Giữ `hashFiles` trong Actions dù IDE cảnh báo.
- Lưu artifacts khi fail.

**Khung CI rút gọn**
```yaml
jobs:
  node:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - run: pnpm -r run typecheck
      - run: pnpm -r --if-present run lint
      - run: pnpm -r run build
      - run: pnpm -r --if-present run test
  python:
    if: ${{ hashFiles('**/*.py') != '' }}
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      - run: pip install -r python/dev-requirements.txt
      - run: ruff check . --fix
      - run: mypy .
      - run: pytest -q
```

---

# 08 - Repo Hygiene (Always Apply)

- `.editorconfig`: `utf-8`, `LF`, `indent 2`.
- `.gitattributes`: `* text=auto eol=lf`.
- `.gitignore`: `node_modules/`, `dist/`, `.venv/`, `artifacts/`, `apps/scraper-playwright/datasets/`.
- Không commit dữ liệu thật; chỉ mẫu nhỏ.

---

# 09 - Refactor Safety (Always Apply)

- Giữ public API, hoặc cung cấp adapter.
- Có ENV toggle phục hồi hành vi cũ.
- Ghi “How to revert” trong `PATCH_NOTES.md`.
- Không đổi `module`/`moduleResolution` nếu chưa kiểm chứng toàn repo.

---

# 10 - Testing Minimum (Model Decision)

Nếu workspace chưa có test:
- Tạo 1 test khói cho build artifacts hoặc 1 test “element exists” cho scraper.
- Ưu tiên `vitest` với TS, `pytest` cho Python, `go test` cho Go.
- Không kéo framework mới chỉ để tăng coverage.

**Vitest khói**
```javascript
import { existsSync } from 'node:fs';
test('build output folder exists', () => {
  expect(existsSync('dist')).toBe(true);
});
```

---

# 11 - Performance Budget (Model Decision)

- **Node:** tránh `fs.readFileSync` file lớn; dùng stream.
- **Scraper:** giới hạn concurrency bằng `ARGUS_CONCURRENCY`; retry backoff expo.
- **Python:** `chunksize` khi đọc CSV; tránh load toàn bộ >200MB vào RAM.

---

# 12 - Errors & Logging (Always Apply)

- Lỗi mạng kèm mã lỗi gốc và số lần retry.
- Hạn chế `console.log` ồn; lỗi dùng `console.error`.
- Sự kiện quan trọng → JSONL event `{ts, phase, ok, err}`.

---

# 13 - Userscript Typecheck (Specific Files: apps/userscript/**)

- Khi thiếu GM types, cho phép skip có kiểm soát và in: `Typecheck skipped (GM APIs not available)`.
- Không ép cài type defs bên thứ ba nếu không cần.

---

# 14 - Local Optional Python (Always Apply, Windows-first)

Nếu `ruff` không trong PATH:
- Hướng dẫn dùng `.venv` và `scripts/setup-python-tools.ps1`.
- Nếu không muốn cài, skip Python checks thay vì fail pipeline.

---

# 15 - Commit Style (Always Apply)

Commits nhỏ, có ý nghĩa:
- `chore(build): …`
- `fix(scraper): …`
- `feat(etl): …`

Tránh đổi EOL vô cớ.

---

# 16 - Apply Manually Toolbox (Apply Manually via @rule)

- `@rule generate-e2e`: sinh script E2E ngắn cho một URL Maps.
- `@rule add-ndjson-schema`: chèn validator schema tối thiểu cho NDJSON.
- `@rule harden-selectors`: chuyển selector sang chiến lược `role→css→xpath`.