/** @type {import('jest').Config} */
const config = {
    displayName: 'Argus Testing Suite',
    preset: 'ts-jest',
    testEnvironment: 'node',

    // Test discovery
    roots: ['<rootDir>/tests', '<rootDir>/apps', '<rootDir>/libs'],
    testMatch: [
        '**/tests/**/*.test.ts',
        '**/tests/**/*.test.js',
        '**/__tests__/**/*.ts',
        '**/*.test.ts'
    ],

    // Coverage configuration
    collectCoverage: true,
    coverageDirectory: '<rootDir>/.artifacts/coverage',
    collectCoverageFrom: [
        'apps/**/*.{ts,js}',
        'libs/**/*.{ts,js}',
        '!**/*.d.ts',
        '!**/node_modules/**',
        '!**/dist/**',
        '!**/tests/**',
        '!**/__tests__/**'
    ],
    coverageThreshold: {
        global: {
            branches: 80,
            functions: 80,
            lines: 80,
            statements: 80
        },
        // Critical paths should have higher coverage
        'libs/js-core/src/gmaps/': {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90
        },
        'apps/scraper-playwright/src/crawler.ts': {
            branches: 90,
            functions: 90,
            lines: 90,
            statements: 90
        }
    },

    // Test timeout and setup
    testTimeout: 60000, // 60 seconds for integration tests
    setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],

    // Module resolution
    moduleNameMapping: {
        '^@argus/(.*)$': '<rootDir>/libs/$1',
        '^@/(.*)$': '<rootDir>/$1'
    },

    // Test environment configuration
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '/datasets/',
        '/artifacts/',
        '/storage/'
    ],
    modulePathIgnorePatterns: [
        '/dist/',
        '/datasets/',
        '/artifacts/'
    ],

    // Reporter configuration
    reporters: [
        'default',
        ['jest-html-reporters', {
            publicPath: '.artifacts/test-reports',
            filename: 'report.html',
            expand: true
        }],
        ['jest-junit', {
            outputDirectory: '.artifacts/test-reports',
            outputName: 'junit.xml'
        }]
    ],

    // Globals for ts-jest
    globals: {
        'ts-jest': {
            tsconfig: {
                types: ['node', 'jest'],
                moduleResolution: 'bundler'
            }
        }
    },

    // Test categorization via projects
    projects: [
        {
            displayName: 'Unit Tests',
            testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
            testTimeout: 10000
        },
        {
            displayName: 'Integration Tests',
            testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
            testTimeout: 30000
        },
        {
            displayName: 'E2E Tests',
            testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
            testTimeout: 60000
        },
        {
            displayName: 'Performance Tests',
            testMatch: ['<rootDir>/tests/performance/**/*.test.ts'],
            testTimeout: 120000
        }
    ]
};

module.exports = config;