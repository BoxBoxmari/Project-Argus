import * as os from "node:os";

const bool = (v: string | undefined, d: boolean): boolean =>
  v === undefined ? d : ["1", "true", "yes", "on"].includes(v.toLowerCase());
const int = (v: string | undefined, d: number): number => (v ? Number(v) : d);

export const Env = {
  HEADFUL: bool(process.env.ARGUS_HEADFUL, false),
  BROWSER_CHANNEL: process.env.ARGUS_BROWSER_CHANNEL as
    | "chromium"
    | "msedge"
    | "chrome"
    | undefined,
  IGNORE_HTTPS_ERRORS: bool(process.env.ARGUS_IGNORE_HTTPS_ERRORS, true),
  PROXY_URL: process.env.ARGUS_PROXY_URL,
  NAV_TIMEOUT_MS: int(process.env.ARGUS_NAV_TIMEOUT_MS, 60_000),
  LOCALE: process.env.ARGUS_LOCALE || "en-US",
  USER_AGENT: process.env.ARGUS_USER_AGENT,
  TEST_URL: process.env.ARGUS_TEST_URL || "https://www.google.com/maps",
  PLATFORM: os.platform(),
} as const;
