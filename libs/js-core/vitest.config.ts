import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    coverage: { reporter: ['text-summary','lcov'], lines: 0.8 },
    include: ['test/**/*.spec.ts']
  }
});
