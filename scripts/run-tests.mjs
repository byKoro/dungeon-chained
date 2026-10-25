// Runs every tests/test_*.js as its own Node process; exits 1 if any fails.
// Usage: npm test            (all)
//        npm test -- safe     (only files whose name contains "safe")
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const testsDir = join(root, "tests");
const filter = process.argv[2] || "";
const verbose = process.argv.includes("--verbose");

const files = readdirSync(testsDir)
    .filter((f) => /^test_.*\.js$/.test(f) && f.includes(filter))
    .sort();

if (files.length === 0) {
    console.error(`No tests match "${filter}".`);
    process.exit(1);
}

let failed = 0;
for (const f of files) {
    const res = spawnSync(process.execPath, [join(testsDir, f)], { cwd: root, encoding: "utf8" });
    const ok = res.status === 0;
    if (!ok) failed++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${f}`);
    if (!ok || verbose) {
        const out = `${res.stdout || ""}${res.stderr || ""}`.trim().split("\n");
        const tail = verbose ? out : out.slice(-15);
        console.log(tail.map((l) => `      ${l}`).join("\n"));
    }
}

console.log(`\n${files.length - failed}/${files.length} test files passed.`);
process.exit(failed ? 1 : 0);
