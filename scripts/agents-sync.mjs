// Copies .agents/skills into tool folders that do not read .agents/ natively.
// Claude Code reads only .claude/skills (gitignored here), so each Claude user runs this locally.
// Codex and Gemini CLI read .agents/skills directly; nothing to do for them.
// Usage: npm run agents:sync              -> .claude/skills
//        npm run agents:sync -- --check   -> exit 1 if .claude/skills is out of date
import { cpSync, rmSync, existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { ROOT } from "./lib.mjs";

const src = join(ROOT, ".agents", "skills");
const dest = join(ROOT, ".claude", "skills");

function listFiles(base, dir = base) {
    if (!existsSync(dir)) return [];
    const out = [];
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) out.push(...listFiles(base, p));
        else out.push(relative(base, p));
    }
    return out.sort();
}

function inSync() {
    const a = listFiles(src);
    const b = listFiles(dest);
    if (a.join("|") !== b.join("|")) return false;
    return a.every((f) => readFileSync(join(src, f)).equals(readFileSync(join(dest, f))));
}

if (process.argv.includes("--check")) {
    const ok = inSync();
    console.log(ok ? ".claude/skills is in sync." : ".claude/skills is out of date: npm run agents:sync");
    process.exit(ok ? 0 : 1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log(`Synced ${readdirSync(dest).length} skills -> ${relative(ROOT, dest)}`);
