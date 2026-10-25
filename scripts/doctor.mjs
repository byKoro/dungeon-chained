// Checks the local dev environment. Usage: npm run doctor
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, run, has, python } from "./lib.mjs";

let problems = 0;
const ok = (m) => console.log(`OK    ${m}`);
const bad = (m, fix) => { problems++; console.log(`FAIL  ${m}${fix ? `\n      fix: ${fix}` : ""}`); };
const info = (m) => console.log(`INFO  ${m}`);

const major = Number(process.versions.node.split(".")[0]);
major >= 18 ? ok(`node ${process.versions.node}`) : bad(`node ${process.versions.node} (< 18)`, "install Node 18+ (LTS)");

const py = python();
if (py) ok(`${py}: ${run(py, ["--version"]).out.trim()} (needed for serve.py)`);
else bad("python not found", "install Python 3.10+ (serve.py dev server)");

existsSync(join(ROOT, "node_modules", "electron"))
    ? ok("node_modules/electron installed")
    : bad("electron not installed (npm start / npm run dist)", "npm install");

// graphify (pinned in requirements-dev.txt)
const req = readFileSync(join(ROOT, "requirements-dev.txt"), "utf8");
const pinned = (req.match(/graphifyy==([\d.]+)/) || [])[1];
if (py) {
    const show = run(py, ["-m", "pip", "show", "graphifyy"]);
    const ver = (show.out.match(/^Version:\s*(\S+)/m) || [])[1];
    if (!ver) bad("graphify not installed", `${py} -m pip install -r requirements-dev.txt`);
    else if (pinned && ver !== pinned) bad(`graphifyy ${ver} installed, pinned ${pinned}`, `${py} -m pip install -r requirements-dev.txt`);
    else ok(`graphifyy ${ver}`);
}
has("graphify", ["--help"]) ? ok("graphify CLI on PATH") : bad("graphify CLI not on PATH", "add Python user Scripts dir to PATH");
existsSync(join(ROOT, "graphify-out", "graph.json"))
    ? ok("graphify-out/graph.json present")
    : bad("graph not built", "npm run graph");

// optional tools
has("git") ? ok("git") : bad("git not found");
has("gh") ? info("gh CLI available (optional, PRs)") : info("gh CLI not found (optional)");
existsSync(join(ROOT, ".claude", "skills"))
    ? info(".claude/skills present (Claude Code)")
    : info(".claude/skills missing — Claude Code users: npm run agents:sync");

console.log(problems ? `\n${problems} problem(s).` : "\nAll good.");
process.exit(problems ? 1 : 0);
