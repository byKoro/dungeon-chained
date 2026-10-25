// Definition-of-done gate. Usage: npm run check
//   1. tests (npm test)        2. map validation
//   3. doc drift warning       4. graphify update (skipped if graphify missing)
// Exit 1 if tests or map validation fail. Doc drift and graph are warnings.
import { ROOT, run, has } from "./lib.mjs";

let failed = 0;
const step = (name) => console.log(`\n=== ${name} ===`);

step("tests");
const t = run(process.execPath, ["scripts/run-tests.mjs"], { inherit: true });
if (!t.ok) failed++;

step("map");
const m = run(process.execPath, ["scripts/validate-map.mjs"], { inherit: true });
if (!m.ok) failed++;

step("docs drift");
// Compare working tree + staged + commits not yet on origin/main against .agents/context changes.
const base = run("git", ["merge-base", "HEAD", "origin/main"]).out.trim() || "HEAD";
const changed = new Set(
    [
        run("git", ["diff", "--name-only", base]).out,
        run("git", ["ls-files", "--others", "--exclude-standard"]).out,
    ].join("\n").split("\n").map((s) => s.trim()).filter(Boolean)
);
const code = [...changed].filter((f) => /^(js\/|map\/|index\.html|editor\.html|serve\.py|electron\/)/.test(f));
const docs = [...changed].filter((f) => f.startsWith(".agents/context/") || f.startsWith(".agents/decisions/"));
if (code.length && !docs.length) {
    console.log(`WARN  ${code.length} code file(s) changed but no .agents/context or decisions doc updated:`);
    for (const f of code.slice(0, 10)) console.log(`      ${f}`);
    console.log("      If behaviour, APIs, config or invariants changed, update the matching context/systems/*.md and status.md.");
} else {
    console.log(code.length ? `OK    code + docs changed (${code.length} code, ${docs.length} docs)` : "OK    no code changes");
}

step("graph");
if (has("graphify", ["--help"])) run(process.execPath, ["scripts/graph.mjs"], { inherit: true });
else console.log("SKIP  graphify not installed (npm run doctor)");

console.log(failed ? `\nCHECK FAILED (${failed} step(s)).` : "\nCHECK PASSED.");
process.exit(failed ? 1 : 0);
