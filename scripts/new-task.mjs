// Creates .agents/tasks/<YYYY-MM-DD>-<slug>/{plan,review,verification}.md
// Usage: npm run new-task -- <slug> ["Optional title"]
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, run } from "./lib.mjs";

const raw = process.argv[2];
if (!raw) {
    console.error('Usage: npm run new-task -- <slug> ["Title"]');
    process.exit(1);
}
const slug = raw.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
const title = process.argv[3] || slug.replace(/-/g, " ");
const date = new Date().toISOString().slice(0, 10);
const dir = join(ROOT, ".agents", "tasks", `${date}-${slug}`);
if (existsSync(dir)) {
    console.error(`Already exists: ${dir}`);
    process.exit(1);
}
const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"]).out.trim();
const head = run("git", ["rev-parse", "--short", "HEAD"]).out.trim();

const files = {
    "plan.md": `# ${title}

Status: planned   <!-- planned | in-progress | done | abandoned -->
Branch: ${branch}  Base: ${head}  Date: ${date}

## Goal
<!-- 1-3 sentences: what changes for the player/dev and why -->

## Context read
<!-- context docs, ADRs, graphify queries, files read -->
- .agents/context/...

## Steps
<!-- ordered; each step leaves the game loadable -->
- [ ] 1. ...
      Files: js/...
      Verify: ...

## Docs to update when done
- [ ] .agents/context/systems/...
- [ ] .agents/context/status.md
- [ ] ADR (only if structural)
`,
    "review.md": `# Review — ${title}

Verdict: pending   <!-- approved | changes-requested -->
Range: ${head}..HEAD

## Findings
<!-- severity · file:symbol · issue · suggestion -->
`,
    "verification.md": `# Verification — ${title}

## Automated
- [ ] npm run check

## Manual (python serve.py → http://localhost:8000)
- [ ] ...

## Not verified
<!-- be explicit about anything you could not run -->
`,
};

mkdirSync(dir, { recursive: true });
for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body, "utf8");
console.log(`Created ${dir}`);
