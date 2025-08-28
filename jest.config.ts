import type { JestConfigWithTsJest } from 'ts-jest';
import { pathsToModuleNameMapper } from 'ts-jest';

const config: JestConfigWithTsJest = {
  testEnvironment: 'jest-environment-jsdom',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      useESM: true,
      tsconfig: '<rootDir>/tsconfig.test.json'
    }],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx'
  ],
  collectCoverageFrom: [
    'tests/**/*.{ts,tsx}',
    'libs/**/*.{ts,tsx}',
    'apps/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!tests/setup.ts',
    '!tests/e2e/**/*',
    '!**/node_modules/**',
    '!**/dist/**'
  ],
  coverageDirectory: '.artifacts/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  // ESM module name mapping with path resolution
  moduleNameMapper: {
    ...pathsToModuleNameMapper({
      '@/*': ['./libs/*'],
      '@argus/*': ['./libs/*']
    }, { prefix: '<rootDir>/' }),
    // Fix ESM .js paths emitted by TS
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Global setup
  globalSetup: undefined,
  globalTeardown: undefined,
  // Error handling
  errorOnDeprecated: true,
  verbose: true,
  // Performance - run in band on Windows for stability
  maxWorkers: 1,
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true
};

export default config;
