import { withPage, safeGoto } from "../core/browser.js";
import { Env } from "../config/env.js";

(async () => {
  await withPage(async (_ctx, page) => {
    await safeGoto(page, Env.TEST_URL);
    const title = await page.title();
    console.log("[tls-smoke] ok title=", title);
  });
})().catch((e) => {
  console.error("[tls-smoke] fail", e);
  process.exit(1);
});
