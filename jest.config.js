/** @type {import('jest').Config} */
const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/libs/js-core/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts']
};

module.exports = config;
