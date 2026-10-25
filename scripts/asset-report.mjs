// Wrapper for the create-game-assets skill's asset_report.py (needs Python + Pillow).
// Usage: npm run assets:report -- assets/enemies/*.png [--require-alpha] [--max-colors 32] [--json]
//        npm run assets:report            (defaults to every PNG under assets/)
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT, run, python } from "./lib.mjs";

const py = python();
if (!py) { console.error("python not found"); process.exit(1); }
if (!run(py, ["-c", "import PIL"]).ok) {
    console.error(`Pillow missing: ${py} -m pip install -r .agents/skills/create-game-assets/scripts/requirements.txt`);
    process.exit(1);
}

function pngs(dir) {
    const out = [];
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) out.push(...pngs(p));
        else if (e.toLowerCase().endsWith(".png")) out.push(relative(ROOT, p));
    }
    return out;
}

let args = process.argv.slice(2);
if (!args.some((a) => !a.startsWith("--"))) args = [...args, ...pngs(join(ROOT, "assets"))];
const script = ".agents/skills/create-game-assets/scripts/asset_report.py";
const r = run(py, [script, ...args], { inherit: true });
process.exit(r.ok ? 0 : 1);
