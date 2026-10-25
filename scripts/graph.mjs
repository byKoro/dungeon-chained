// Keeps the graphify knowledge graph (graphify-out/, gitignored) current.
// Usage: npm run graph            incremental AST update (no LLM, no API cost)
//        npm run graph -- --force  rebuild even if node count drops (after deletions/refactors)
//        npm run graph -- --hubs   also print the top architectural hubs
import { ROOT, run, has } from "./lib.mjs";

if (!has("graphify", ["--help"])) {
    console.error("graphify not found. Install: python -m pip install -r requirements-dev.txt");
    process.exit(1);
}
const args = ["update", "."];
if (process.argv.includes("--force")) args.push("--force");
const r = run("graphify", args, { cwd: ROOT });
// graphify prints warnings to stderr; judge success by the summary line, not the exit code.
const lines = r.out.split("\n").filter((l) => /Rebuilt|No code-graph topology|updated|error|Error/.test(l));
console.log(lines.join("\n").trim() || r.out.trim());
const failed = /Traceback|Error:/.test(r.out) && !/Rebuilt|No code-graph topology/.test(r.out);
if (process.argv.includes("--hubs")) console.log(run("graphify", ["god-nodes", "--top", "15"]).out.trim());
process.exit(failed ? 1 : 0);
