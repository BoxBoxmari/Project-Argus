#!/usr/bin/env node
import { existsSync, readdirSync } from "node:fs";
const rootFiles = [
    "REPORT.md", "env.example", "process_ndjson.py", "demo_success.ps1", "scrape.mjs", "test_runner.mjs"
];
const lingering = rootFiles.filter(f => existsSync(f));
if (lingering.length) {
    console.log("Stray files at root:", lingering.join(", "));
    process.exitCode = 1;
} else {
    console.log("Root is clean.");
}