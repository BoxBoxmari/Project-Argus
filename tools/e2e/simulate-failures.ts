import fs from 'node:fs';
import path from 'node:path';

const RESULTS_FILE = 'apps/e2e/reports/results.json';

// Generate test results with failures
function generateFailureResults() {
  const now = new Date().toISOString();

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
        ["json", { "outputFile": "reports/results.json" }]
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
                "title": "SIM#1 [stable] en-US headless Desktop normal block:on",
                "ok": false,
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
                        "status": "failed",
                        "duration": Math.floor(Math.random() * 2000) + 1000,
                        "errors": [],
                        "stdout": [],
                        "stderr": [],
                        "retry": 0,
                        "startTime": now,
                        "attachments": []
                      }
                    ],
                    "status": "unexpected"
                  }
                ]
              },
              {
                "title": "SIM#2 [stable] en-US headless Desktop normal block:on",
                "ok": false,
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
                        "status": "failed",
                        "duration": Math.floor(Math.random() * 2000) + 1000,
                        "errors": [],
                        "stdout": [],
                        "stderr": [],
                        "retry": 0,
                        "startTime": now,
                        "attachments": []
                      }
                    ],
                    "status": "unexpected"
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

// Write the results to file
fs.writeFileSync(RESULTS_FILE, JSON.stringify(generateFailureResults(), null, 2));
console.log(`Generated failure test results in ${RESULTS_FILE}`);
