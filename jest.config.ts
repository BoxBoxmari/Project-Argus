import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        target: 'ES2020',
        lib: ['ES2020', 'DOM'],
        moduleResolution: 'Node',
        esModuleInterop: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        noUncheckedIndexedAccess: true,
        types: ['jest', 'node', 'jsdom']
      }
    }]
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.ts',
    '<rootDir>/tests/**/*.test.tsx'
  ],
  collectCoverageFrom: [
    'tests/**/*.{ts,tsx}',
    '!tests/**/*.d.ts',
    '!tests/setup.ts',
    '!tests/e2e/**/*'
  ],
  coverageDirectory: '.artifacts/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 30000,
  // Ensure proper module resolution for workspace
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@argus/(.*)$': '<rootDir>/libs/$1'
  },
  // Global setup
  globalSetup: undefined,
  globalTeardown: undefined,
  // Error handling
  errorOnDeprecated: true,
  verbose: true,
  // Performance
  maxWorkers: '50%',
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true
};

export default config;
