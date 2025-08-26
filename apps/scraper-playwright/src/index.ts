import { Env } from "./config/env.js";
import { withPage, safeGoto } from "./core/browser.js";

async function main() {
  await withPage(async (_ctx, page) => {
    await safeGoto(page, Env.TEST_URL);
    const title = await page.title();
    console.log("[argus] opened:", title);
  });
}

main().catch((e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("[argus] start failed:", msg);
  process.exitCode = 1;
});
