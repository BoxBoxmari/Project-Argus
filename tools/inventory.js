#!/usr/bin/env node
import { execSync } from "node:child_process";
const run = (cmd) => execSync(cmd, { stdio: "inherit" });
console.log("== Workspaces =="); run("pnpm -r list --depth -1");
console.log("\n== Git clean preview =="); run("git clean -ndX");