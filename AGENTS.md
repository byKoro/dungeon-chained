# AGENTS.md — Dungeon Chained

Entry point for every AI assistant (Claude/Opus, Codex, Gemini, Kiro). `CLAUDE.md` and `GEMINI.md` only import this file. All project context lives in `.agents/` (ADR 0010).

## Project in one paragraph
Local 2-player co-op roguelike. Two players tethered by an elastic cable with a saw in the middle sweep through enemies; over-stretch snaps the cable. Vanilla JavaScript ES modules on a 2D canvas, no engine, no bundler, no runtime npm deps (ADR 0001). Electron wraps it for desktop. Rooms are authored JSON pieces in `map/` placed by a procedural dungeon graph. Details: `.agents/context/overview.md`.

## Commands
| Task | Command |
|---|---|
| Dev server (game + editor save API) | `python serve.py` → http://localhost:8000 · editor http://localhost:8000/editor.html |
| Desktop | `npm install` then `npm start` · build `npm run dist` |
| Tests | `npm test` (all `tests/test_*.js`) · one file: `npm test -- safe_spawn` |
| Validate room pieces | `npm run validate:map` |
| Definition-of-done gate | `npm run check` (tests + map + doc drift + graph update) |
| Environment check | `npm run doctor` · Python tools: `python -m pip install -r requirements-dev.txt` |
| Knowledge graph | `npm run graph` (update) · `npm run graph -- --force --hubs` |
| New task folder | `npm run new-task -- <slug>` |
| Claude Code skills | `npm run agents:sync` (copies `.agents/skills` → `.claude/skills`, gitignored) |
| Asset check | `npm run assets:report -- <png...>` (needs Pillow) |

`file://` does not work (map JSON is fetched). Never expose `serve.py` beyond localhost: it has no auth and writes/deletes `map/`.

## Read before you change code
1. `.agents/context/architecture.md` — boot, subsystem ownership, exact update and render order.
2. `.agents/context/conventions.md` — style, units (px per 60 Hz step), testing, workflow.
3. The system doc for the area: `.agents/context/systems/` → `players-and-chain`, `rendering`, `rooms-and-maps`, `room-editor`, `combat-and-entities`, `weapons`, `audio`, `visual-effects`, `ui`.
4. A playbook if the task is a common addition: `.agents/playbooks/` (room piece, enemy, trap, weapon, sound, particle, UI screen, porting an old branch).
5. `.agents/decisions/` (ADRs) — do not re-litigate them without writing a new ADR.
6. `.agents/context/status.md` — open branches, backlog, known bugs. Check it before "fixing" something odd; it may be listed.
7. `.agents/context/glossary.md` — pt-BR ↔ English domain terms.

## Codebase navigation (graphify)
A code knowledge graph lives in `graphify-out/` (gitignored, regenerate with `npm run graph`; `.graphifyignore` keeps it to game code).
- For codebase or architecture questions, first run `graphify query "<question>"`; use `graphify explain "<Symbol>"`, `graphify path "A" "B"`, `graphify affected "<Symbol>"` for impact. These return scoped subgraphs, smaller than grep output.
- Read `graphify-out/GRAPH_REPORT.md` only for broad architecture reviews.
- After modifying code, run `npm run graph` (AST only, no API cost). On PowerShell graphify writes warnings to stderr; judge success by the "Rebuilt"/"No code-graph topology changes" line.
- If graphify is missing, fall back to the context docs + search; tell the user to run `npm run doctor`.

## Hard rules
- `js/main.js` is bootstrap only. New behaviour = a subsystem class in its own file, constructed in `Game` and called from `Game._step`/`Game._render`, with dependencies injected via constructor options (ADR 0002).
- Tuning numbers and sound cues go in `js/config/*`; config imports only config (ADR 0003). Entities raise one-frame flags; `Game`/systems play audio and FX.
- No npm runtime dependencies, no bundler, no TypeScript in `js/`. Imports are relative with `.js`.
- Keep pixel art crisp: `imageSmoothingEnabled = false`, integer scales.
- Every new room piece must be listed in `map/index.json` (`npm run validate:map`).
- Editor (`js/editor/EditorApp.js`): removing an element from `editor.html` requires removing or null-guarding its `getElementById`; keep the `e.target !== this.canvas` guard in `_onMouseDown`; keep `_saveState` and `_playtestInGame` intact.
- Do not add verbose comments (the team stripped AI-style comments in `9b13c52`). Comment only the non-obvious *why*.
- Do not claim runtime behaviour you did not observe. If you could not open the game, say so.

## Workflow (keeps additions linear)
1. Non-trivial change → `npm run new-task -- <slug>` and fill `plan.md` (goal, docs read, steps with files + verification).
2. Work on a feature branch from `main`; small commits, one concern each.
3. Review with the `code-review` skill → `review.md`. Verify → `verification.md` (commands run, what was not verified).
4. Same commit as the code: update the touched `context/systems/*.md`, `status.md` (bugs fixed/found, branches merged), `glossary.md` for new terms, a new ADR in `.agents/decisions/` (next number) only for structural decisions.
5. `npm run check` must pass, then PR to `main`. `npm run check` currently fails on two pre-existing issues listed in `status.md` (#4, #5); don't add new failures.

## Agent skills
Skills live in `.agents/skills/<name>/SKILL.md` (Codex and Gemini CLI load them natively; Claude Code via `npm run agents:sync`; other tools: open the SKILL.md when the task matches). Start game tasks with `dungeon-chained-router`.

- Game dev (literal upstream copies; read the `PROJECT-NOTES.md` next to each): `game-feel`, `create-game-assets`, `roguelike`, `procedural-gen`, `level-design`, `audio-design`, `game-ui-ux`, `game-ai`, `input-systems`, `performance-optimization`, `physics-tuning`.
- Planning & design: `grill-me` / `grilling` (interview), `grill-with-docs`, `to-spec`, `to-tickets`, `to-questionnaire`, `prototype`, `research`, `domain-modeling`, `codebase-design`, `improve-codebase-architecture`.
- Build & ship: `implement`, `tdd`, `diagnosing-bugs`, `code-review`, `pr`.
- Session: `handoff`, `retro`, `chief-of-staff`, `wait-what`, `writing-for-agents`, `caveman` (optional terse mode; only when the user asks).

Path mapping for skills written for other repo layouts:
| Skill expects | Use here |
|---|---|
| `GLOSSARY.md` | `.agents/context/glossary.md` |
| `docs/adr/` | `.agents/decisions/` (`NNNN-slug.md`) |
| issue tracker / `.scratch/` / `issues/` | local markdown in `.agents/tasks/<date>-<slug>/` (see `.agents/tasks/README.md`) |
| triage labels, `/setup-matt-pocock-skills` | not used; skip those steps |
| `CONTEXT.md` / project docs | `.agents/context/` |

Note: `.kiro/skills/` holds the full upstream game-dev skill set for Kiro users (includes engine-specific skills that do not apply here). The curated, project-relevant set is `.agents/skills/`.
