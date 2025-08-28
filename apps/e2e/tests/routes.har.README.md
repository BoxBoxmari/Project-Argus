Place captured HAR at apps/e2e/tests/routes.har to replay network if needed:
  npx @playwright/test codegen <URL> --save-har=apps/e2e/tests/routes.har --save-har-glob='**/*'
