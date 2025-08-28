declare namespace NodeJS {
  interface ProcessEnv {
    ARGUS_BROWSER_CHANNEL?: string;
    ARGUS_HEADFUL?: string;        // '1' bật headful
    ARGUS_TLS_BYPASS?: string;     // '1' bỏ qua TLS errors
    ARGUS_TEST_URL?: string;
  }
}
