# Conventions

Observed in the code; follow them unless an ADR says otherwise.

## Code style
- One class per file, filename = PascalCase class name (`Game.js`, `SawWeapon.js`). Folders by role (`core/`, `rooms/`, `entities/`, `systems/`, `particles/`, `ui/`, `config/`).
- Named exports only (`export class X`, `export const X`, `export function x`). No default exports.
- Relative imports always include `.js`. No bare imports in browser code (no bundler).
- 4-space indent, semicolons. Quotes are mixed (imports often single, runtime strings mostly double): match the file you edit.
- Private members: leading underscore (`_step`, `_render`). Getters for derived state (`isConnected`, `speedMag`).
- Config: `UPPER_SNAKE` constant objects + camelCase helper functions in `js/config/*`. Config imports only config.
- Comments: commit `9b13c52` stripped most comments ("remove comentarios de IA"). Do not add verbose AI-style comments. Add a short comment only when the *why* is not obvious. pt-BR or English both acceptable; keep the file's existing language.
- Optional APIs are duck-typed with `?.` (`weapon.setStrain?.()`). Keep new optional hooks guarded the same way.

## Architecture rules (see `architecture.md`, ADR 0002)
- `js/main.js` is bootstrap only. New behaviour = a subsystem class constructed in `Game` and called from `Game._step`/`Game._render`.
- Dependencies are injected via constructor options (`{ renderer, particleSystem, audio }`) or getter closures (`getP1: () => this.p1`). Nothing imports `Game.js` except `main.js`.
- Audio/FX are triggered by the orchestrator or a system (`CombatSystem`, `Game`) reacting to one-frame entity flags (`justStepped`, `justAttacked`, `justFired`). Entities never call audio.
- Draw only in `draw()`/`_render`, never in `update()`.
- Tuning numbers go to `js/config/*`, not inline (several legacy literals still exist; see `status.md`).

## Units & time
- Fixed 60 Hz simulation (`SIM_HZ`, `SIM_STEP`). Speeds are px per step, timers count steps. Exceptions: traps and intro/door-flash timers use real seconds (`deltaSeconds`).
- Render-frame effects (shake, zoom punch, HUD, torch flicker) run per animation frame and are not paused.
- World px: `TILE = 64`; art is 16 px per tile (art pixel = 4 world px). Room = 14×9 tiles. Tile coords `col,row`, origin top-left, `floor[row][col]`.

## Assets
- Under `assets/<group>/`, registered in `js/core/AssetLoader.js` (`this.load(key, path)`). Audio files go to `assets/audio/` (kebab-case, `-0N` variants) and are referenced from `js/config/AudioConfig.js`.
- Pixel art: `imageSmoothingEnabled = false`, integer scales, CSS `image-rendering: pixelated`.
- Missing images do not reject loading; draw code checks `img.complete && img.naturalWidth > 0`.
- For new art use the `create-game-assets` skill and keep provenance/licensing notes.

## Testing
- No framework. Each `tests/test_*.js` is a standalone ESM script with a hand-rolled assert that prints ✅/❌ and exits non-zero on failure (`process.exit(fails ? 1 : 0)` or a throw).
- `npm test` runs every `tests/test_*.js` (scripts/run-tests.mjs). Add tests for pure logic (math, spawn rules, data transforms); browser-only code (Audio, canvas, DOM) is verified manually.
- Temporary test files: `tests/_tmp_*.js` (gitignored).
- `node --check file.js` validates syntax only, not imports.
- Runtime verification: `python serve.py` → open the game, watch the devtools console (zero errors), exercise the change. If you could not run it, say so explicitly.

## Work flow (keep additions linear)
1. Read `AGENTS.md` → relevant `context/systems/*.md` → ADRs. For code questions, query graphify first (`graphify query "..."`).
2. Non-trivial change: write a plan in `.agents/tasks/<YYYY-MM-DD>-<slug>/plan.md` (`npm run new-task -- <slug>`).
3. Implement in small steps on a feature branch; one concern per commit.
4. Review (`code-review` skill) → `review.md`; verify → `verification.md` (what was run, what was not).
5. Update docs in the same commit: the touched `context/systems/*.md`, `status.md` (bugs fixed/found), a new ADR if a structural decision was made, `glossary.md` for new domain terms.
6. `npm run check` must pass before commit/PR.

## Git
- Default branch `main`; feature branches named by feature (`flame-thrower`, `inimigos-novos`). PR into `main`.
- Commit messages: short, pt-BR or English, conventional prefixes welcome (`feat:`, `fix:`, `chore:`, `docs:`).
- Not versioned (see `.gitignore`): `node_modules/`, `dist/`, `/docs/`, `/pitch/`, `/_local/`, `/graphify-out/`, `/.claude/`, `/.kiro/*` except `.kiro/skills/`.
