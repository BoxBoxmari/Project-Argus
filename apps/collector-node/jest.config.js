export const preset = 'ts-jest';
export const testEnvironment = 'node';
export const transform = {
  '^.+\\.tsx?$': 'ts-jest',
};
export const moduleFileExtensions = ['ts', 'tsx', 'js', 'jsx', 'json'];
export const testMatch = ['**/tests/**/*.test.ts', '**/tests/**/*.spec.ts'];
export const collectCoverageFrom = [
  'src/**/*.{ts,tsx}',
  '!src/**/*.d.ts',
];
