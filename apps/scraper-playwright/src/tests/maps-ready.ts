import { withPage, safeGoto } from "../core/browser.js";
import { Env } from "../config/env.js";

(async () => {
  if (process.env.ARGUS_E2E_DISABLE === "1") {
    console.log("[maps-ready] skipped via ARGUS_E2E_DISABLE");
    return;
  }
  await withPage(async (_ctx, page) => {
    await safeGoto(page, Env.TEST_URL);
    await page.waitForSelector("input#searchboxinput", { timeout: Env.NAV_TIMEOUT_MS });
    console.log("[maps-ready] ok");
  });
})().catch((e) => {
  console.error("[maps-ready] fail", e);
  process.exit(1);
});
