/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps', '<rootDir>/libs'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/datasets/', '/artifacts/', '/storage/'],
  modulePathIgnorePatterns: ['/dist/', '/datasets/', '/artifacts/']
};

module.exports = config;
