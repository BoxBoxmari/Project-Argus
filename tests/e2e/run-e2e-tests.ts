#!/usr/bin/env node

/**
 * E2E Test Runner Script
 *
 * Runs the complete end-to-end test suite with proper setup and teardown.
 * This script ensures the environment is properly configured before running tests.
 */

import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

interface TestRunOptions {
    pattern?: string;
    verbose?: boolean;
    coverage?: boolean;
    timeout?: number;
    parallel?: boolean;
    failFast?: boolean;
    updateSnapshots?: boolean;
}

async function main() {
    const args = process.argv.slice(2);
    const options: TestRunOptions = parseArgs(args);

    console.log('🧪 Argus E2E Test Runner');
    console.log('========================');

    try {
        // Setup test environment
        await setupTestEnvironment();

        // Build necessary components
        await buildComponents();

        // Run E2E tests
        const testResult = await runE2ETests(options);

        // Generate test reports
        await generateTestReports();

        // Cleanup
        await cleanup();

        process.exit(testResult);
    } catch (error) {
        console.error('❌ E2E test execution failed:', error);
        await cleanup();
        process.exit(1);
    }
}

function parseArgs(args: string[]): TestRunOptions {
    const options: TestRunOptions = {};

    for (let i = 0; i < args.length; i++) {
        switch (args[i]) {
            case '--pattern':
            case '-p':
                options.pattern = args[++i];
                break;
            case '--verbose':
            case '-v':
                options.verbose = true;
                break;
            case '--coverage':
            case '-c':
                options.coverage = true;
                break;
            case '--timeout':
            case '-t':
                options.timeout = parseInt(args[++i], 10);
                break;
            case '--parallel':
                options.parallel = true;
                break;
            case '--fail-fast':
                options.failFast = true;
                break;
            case '--update-snapshots':
            case '-u':
                options.updateSnapshots = true;
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
                break;
        }
    }

    return options;
}

function printHelp() {
    console.log(`
Usage: npm run test:e2e [options]

Options:
  -p, --pattern <pattern>     Test file pattern to run
  -v, --verbose              Verbose output
  -c, --coverage             Generate coverage report
  -t, --timeout <ms>         Test timeout in milliseconds
  --parallel                 Run tests in parallel
  --fail-fast                Stop on first failure
  -u, --update-snapshots     Update test snapshots
  -h, --help                 Show this help message

Examples:
  npm run test:e2e
  npm run test:e2e -- --pattern "cli-pipeline"
  npm run test:e2e -- --verbose --coverage
  npm run test:e2e -- --timeout 120000
`);
}

async function setupTestEnvironment(): Promise<void> {
    console.log('🔧 Setting up test environment...');

    // Create test directories
    const testDirs = [
        '.artifacts',
        '.artifacts/e2e-test-data',
        '.artifacts/test-reports',
        '.artifacts/coverage',
        'tests/e2e'
    ];

    for (const dir of testDirs) {
        if (!existsSync(dir)) {
            await fs.mkdir(dir, { recursive: true });
            console.log(`   ✓ Created directory: ${dir}`);
        }
    }

    // Setup test environment variables
    process.env.NODE_ENV = 'test';
    process.env.ARGUS_HEADFUL = 'false';
    process.env.ARGUS_LOG_LEVEL = 'error';
    process.env.ARGUS_TEST_MODE = 'true';
    process.env.ARGUS_TIMEOUT = '30000';

    console.log('   ✓ Environment variables configured');

    // Check required tools
    await checkRequiredTools();
}

async function checkRequiredTools(): Promise<void> {
    console.log('🔍 Checking required tools...');

    const requiredCommands = [
        { command: 'node', version: '--version' },
        { command: 'npm', version: '--version' }
    ];

    for (const tool of requiredCommands) {
        try {
            const result = await runCommand(tool.command, [tool.version]);
            if (result.code === 0) {
                console.log(`   ✓ ${tool.command}: ${result.stdout.trim()}`);
            } else {
                throw new Error(`Command failed: ${tool.command}`);
            }
        } catch (error) {
            console.error(`   ❌ ${tool.command} not found or failed`);
            throw error;
        }
    }
}

async function buildComponents(): Promise<void> {
    console.log('🔨 Building components...');

    // Build scraper-playwright if needed
    const scraperDir = 'apps/scraper-playwright';
    if (existsSync(path.join(scraperDir, 'package.json'))) {
        console.log('   Building scraper-playwright...');
        const result = await runCommand('npm', ['run', 'build'], { cwd: scraperDir });
        if (result.code !== 0) {
            throw new Error('Failed to build scraper-playwright');
        }
        console.log('   ✓ Scraper built successfully');
    }

    // Build js-core library if needed
    const jsCore = 'libs/js-core';
    if (existsSync(path.join(jsCore, 'package.json'))) {
        console.log('   Building js-core library...');
        const result = await runCommand('npm', ['run', 'build'], { cwd: jsCore });
        if (result.code !== 0) {
            throw new Error('Failed to build js-core');
        }
        console.log('   ✓ JS Core library built successfully');
    }
}

async function runE2ETests(options: TestRunOptions): Promise<number> {
    console.log('🧪 Running E2E tests...');

    const jestArgs: string[] = ['--testPathPattern=tests/e2e'];

    if (options.pattern) {
        jestArgs.push('--testNamePattern', options.pattern);
    }

    if (options.verbose) {
        jestArgs.push('--verbose');
    }

    if (options.coverage) {
        jestArgs.push('--coverage');
    }

    if (options.timeout) {
        jestArgs.push('--testTimeout', options.timeout.toString());
    }

    if (options.parallel) {
        jestArgs.push('--runInBand', 'false');
    } else {
        jestArgs.push('--runInBand');
    }

    if (options.failFast) {
        jestArgs.push('--bail', '1');
    }

    if (options.updateSnapshots) {
        jestArgs.push('--updateSnapshot');
    }

    // Add configuration file
    jestArgs.push('--config', 'tests/jest.config.test.js');

    console.log(`   Running: jest ${jestArgs.join(' ')}`);

    const result = await runCommand('npx', ['jest', ...jestArgs]);

    if (result.code === 0) {
        console.log('   ✅ All E2E tests passed!');
    } else {
        console.log('   ❌ Some E2E tests failed');
        if (result.stderr) {
            console.error('Error output:', result.stderr);
        }
    }

    return result.code;
}

async function generateTestReports(): Promise<void> {
    console.log('📊 Generating test reports...');

    const reportsDir = '.artifacts/test-reports';
    const reportFiles = [
        'report.html',
        'junit.xml'
    ];

    let generatedReports = 0;
    for (const reportFile of reportFiles) {
        const reportPath = path.join(reportsDir, reportFile);
        if (existsSync(reportPath)) {
            console.log(`   ✓ Generated: ${reportPath}`);
            generatedReports++;
        }
    }

    if (generatedReports === 0) {
        console.log('   ⚠️  No test reports found');
    }

    // Generate test summary
    const summaryFile = path.join(reportsDir, 'e2e-summary.json');
    const summary = {
        timestamp: new Date().toISOString(),
        environment: {
            node_version: process.version,
            platform: process.platform,
            arch: process.arch
        },
        test_config: {
            timeout: process.env.ARGUS_TIMEOUT || '30000',
            headless: process.env.ARGUS_HEADFUL !== 'true',
            log_level: process.env.ARGUS_LOG_LEVEL || 'error'
        },
        artifacts_location: path.resolve(reportsDir)
    };

    await fs.writeFile(summaryFile, JSON.stringify(summary, null, 2));
    console.log(`   ✓ Generated test summary: ${summaryFile}`);
}

async function cleanup(): Promise<void> {
    console.log('🧹 Cleaning up...');

    // Clean up temporary test data
    const tempDirs = [
        '.artifacts/e2e-test-data'
    ];

    for (const dir of tempDirs) {
        if (existsSync(dir)) {
            try {
                await fs.rm(dir, { recursive: true, force: true });
                console.log(`   ✓ Cleaned: ${dir}`);
            } catch (error) {
                console.warn(`   ⚠️  Failed to clean ${dir}:`, error);
            }
        }
    }

    // Reset environment variables
    delete process.env.ARGUS_TEST_MODE;
    console.log('   ✓ Environment reset');
}

async function runCommand(
    command: string,
    args: string[],
    options: { cwd?: string } = {}
): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            stdio: 'pipe',
            cwd: options.cwd || process.cwd(),
            shell: process.platform === 'win32'
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            resolve({ code: code || 0, stdout, stderr });
        });
    });
}

if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

export { main, runE2ETests };