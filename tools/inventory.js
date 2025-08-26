import { execSync } from "node:child_process";
const run = (cmd) => execSync(cmd, { stdio: "inherit" });
console.log("== Workspaces =="); run("pnpm -r list --depth -1");
console.log("\n== Git clean preview =="); run("git clean -ndX");
>>>>>>> 5fca665 (\chore(repo): declutter root, unify Python under py/, relocate scripts/docs, remove staging artifacts\)
#!/usr/bin / env node
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

console.log('== Workspaces ==');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
console.log(`${pkg.name} ${process.cwd()} (${pkg.private ? 'PRIVATE' : 'PUBLIC'})`);
console.log('');

// List workspace packages
const workspaceDirs = ['apps', 'libs', 'tools'];
for (const dir of workspaceDirs) {
    try {
        const items = readdirSync(dir);
        for (const item of items) {
            const pkgPath = join(dir, item, 'package.json');
            try {
                const subPkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
                const privacy = subPkg.private ? ' (PRIVATE)' : '';
                console.log(`${subPkg.name}@${subPkg.version} ${process.cwd()}\\${dir}\\${item}${privacy}`);
            } catch (err) {
                // No package.json or not readable
            }
        }
    } catch (err) {
        // Directory doesn't exist
    }
}

console.log('');
console.log('== Git clean preview ==');

// Check for common build artifacts
const artifacts = ['node_modules', 'dist', 'datasets', 'artifacts', 'storage'];
for (const artifact of artifacts) {
    try {
        statSync(artifact);
        console.log(`Would remove ${artifact}/`);
    } catch (err) {
        // Doesn't exist
    }
}

// Check in subdirectories
for (const dir of workspaceDirs) {
    try {
        const items = readdirSync(dir);
        for (const item of items) {
            for (const artifact of artifacts) {
                try {
                    statSync(join(dir, item, artifact));
                    console.log(`Would remove ${dir}/${item}/${artifact}/`);
                } catch (err) {
                    // Doesn't exist
                }
            }
        }
    } catch (err) {
        // Directory doesn't exist
    }
}
=======
import { execSync } from "node:child_process";
const run = (cmd) => execSync(cmd, { stdio: "inherit" });
console.log("== Workspaces =="); run("pnpm -r list --depth -1");
console.log("\n== Git clean preview =="); run("git clean -ndX");
>>>>>>> 5fca665 (\chore(repo): declutter root, unify Python under py/, relocate scripts/docs, remove staging artifacts\)
