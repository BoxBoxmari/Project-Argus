import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const HISTORY_FILE = 'apps/e2e/reports/history.json';
const RESULTS_FILE = 'apps/e2e/reports/results.json';

// Function to generate simulated test results
function generateResults(testId: string, passed: boolean) {
  return {
    "config": {
      "forbidOnly": true,
      "fullyParallel": true,
      "globalSetup": null,
      "globalTeardown": null,
      "globalTimeout": 0,
      "grep": {},
      "grepInvert": null,
      "maxFailures": 0,
      "metadata": {},
      "preserveOutput": "always",
      "projects": [
        {
          "outputDir": "test-results",
          "repeatEach": 1,
          "retries": 0,
          "metadata": {},
          "name": "chromium",
          "testDir": "tests",
          "testIgnore": [],
          "testMatch": [
            "**/*.@(spec|test).?(c|m)js"
          ],
          "timeout": 30000
        }
      ],
      "reporter": [
        ["list", {}],
        ["json", {}]
      ],
      "reportSlowTests": {
        "max": 5,
        "threshold": 15000
      },
      "rootDir": ".",
      "quiet": false,
      "shard": null,
      "updateSnapshots": "missing",
      "version": "1.47.0",
      "workers": 1,
      "webServer": null
    },
    "suites": [
      {
        "title": "tests",
        "file": "tests",
        "column": 0,
        "line": 0,
        "specs": [],
        "suites": [
          {
            "title": "sim.matrix.spec.ts",
            "file": "tests/sim.matrix.spec.ts",
            "column": 0,
            "line": 0,
            "specs": [
              {
                "title": `${testId} [quarantine] en-US headless Desktop normal block:on`,
                "ok": passed,
                "tags": [],
                "tests": [
                  {
                    "timeout": 30000,
                    "annotations": [],
                    "expectedStatus": "passed",
                    "projectId": "chromium",
                    "projectName": "chromium",
                    "results": [
                      {
                        "workerIndex": 0,
                        "status": passed ? "passed" : "failed",
                        "duration": 1234,
                        "errors": [],
                        "stdout": [],
                        "stderr": [],
                        "retry": 0,
                        "startTime": "2025-08-28T23:00:00.000Z",
                        "attachments": []
                      }
                    ],
                    "status": passed ? "expected" : "unexpected"
                  }
                ]
              }
            ]
          }
        ]
      }
    ],
    "errors": []
  };
}

// Function to run the triage script
function runTriage(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['tools/e2e/triage.ts'], {
      cwd: process.cwd(),
      stdio: 'inherit'
    });

    child.on('close', (code) => {
      if (code === 0 || code === 2) {
        resolve();
      } else {
        reject(new Error(`Triage script exited with code ${code}`));
      }
    });
  });
}

// Function to simulate multiple runs for promotion
async function simulatePromotion() {
  // Reset history
  fs.writeFileSync(HISTORY_FILE, JSON.stringify({}));

  console.log('Simulating promotion test runs...');

  // Simulate 10 runs with 98% pass rate (49/50)
  for (let i = 0; i < 10; i++) {
    // 98% pass rate - only fail 1 in 50 times
    const shouldPass = Math.random() > 0.02; // 2% chance of failure

    // Generate results
    const results = generateResults("SIM#3", shouldPass);
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

    console.log(`Run ${i + 1}: ${shouldPass ? 'PASS' : 'FAIL'}`);

    // Run triage
    try {
      await runTriage();
    } catch (error) {
      console.error(`Error running triage for run ${i + 1}:`, error);
    }
  }

  console.log('Promotion simulation complete. Check history.json for results.');
}

simulatePromotion().catch(console.error);
