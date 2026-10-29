# Handoff — Sala Início (core loop)

Written 2026-10-29 at the end of the grill session, because the user is moving to another PC and the chat session will be lost. A fresh agent should be able to continue from this file alone.

The `handoff` skill says to save to the OS temp folder. This file lives in the repo instead, so it travels with `git pull` to the other PC.

## What the next session is for
Implement the Início core loop, one slice at a time, starting with **slice 1, `feat/scrap-chest`**.

## Read first (do not duplicate, these are the source of truth)
1. `AGENTS.md`: project rules and commands.
2. `.agents/tasks/2026-10-29-inicio-core-loop/design.md`: the **approved** design. It has every decision from the grill: flow, systems, values, positions, dialogue script, assets, delivery order, out of scope.
3. `.agents/tasks/2026-10-29-scrap-chest/plan.md`: plan for slice 1, with the list of docs to read before coding.

## Git state when this was written
| Branch | Commit | Pushed? | Content |
|---|---|---|---|
| `feat/editor2-anvil-prop` | `ae41338` | yes (this handoff) | anvil prop (`01f4f2b`) + `inicial.json` layout (`ae41338`) |
| `feat/scrap-chest` | this handoff commit, on top of `14c7bb7` | yes (this handoff) | design.md, slice 1 plan, this handoff |
| `main` | `ae41338` | yes (user asked for a direct push) | fast-forward to `feat/editor2-anvil-prop` (anvil prop + `inicial.json` layout) |

`feat/editor2-anvil-prop` is fully merged into `main` and can be deleted. `feat/scrap-chest` branches from `main` at `ae41338`.

## Resume on the new PC
```powershell
git clone https://github.com/byKoro/dungeon-chained   # or: git fetch origin
git switch feat/scrap-chest
npm install
python -m pip install -r requirements-dev.txt
npm run doctor
npm run graph            # graphify-out/ is gitignored, rebuild it
npm run agents:sync      # only if using Claude Code
python serve.py          # http://localhost:8000 and /editor2.html
```
To play the start map while developing, open it from Editor 2.0 playtest. Pointing `map/demo/active.json` at `inicial.json` is slice 5; don't do it earlier unless the user asks.

## Where we stopped
- The grill is closed and the user confirmed the design. Last addition: **solid props**. The anvil and chests get collision only at their base footprint, and they are y-sorted with the entities so players can stand in front of or behind them without stepping on top (design.md, section "Props sólidos").
- Nothing in `js/` has been written yet.
- Next action: start slice 1, step 1 of `plan.md`. Read the docs listed under "To read before coding" first, set `Status: in-progress` in the plan, and keep small commits, one concern each.

## Preferences and nuances from the conversation (not obvious from design.md)
- **Talk to the user in pt-BR.** Code identifiers are English. Game text goes through i18n with pt-BR as the default. The editor UI stays pt-BR.
- The user wants **game feel detailed later**. Keep juice minimal for now and don't over-polish placeholders.
- The dialogue script is **"vamos testar"**: it may be removed later, so keep it data-driven and easy to switch off.
- Things the user **rejected or postponed** (don't reintroduce):
  - character names or personalities (they are just Amarelo and Azul);
  - "first time" contextual hints;
  - on-screen "Onda X" text;
  - bonus enemies for cutting ropes fast (accumulation only);
  - the pit/fosso trigger (postponed);
  - saw upgrades in the Boots-room anvil (that anvil shows only the boots for now);
  - the final "all upgrades" room (later).
- The user chose: zones drawn in Editor 2.0, and events written in **code**, as a per-room script inside a new subsystem (ADR 0002). Enemy spawn on room entry is replaced by encounters only for Editor 2.0 maps; classic procedural mode stays as it is.
- Death: the pair respawns at the `inicial` spawn with full lives. Scrap resets to 0. Items, upgrades and completed events persist. An encounter interrupted midway restarts.
- When asking the user for decisions, they responded well to the grill format: numbered questions, each with a recommended answer, in pt-BR.

## Facts already verified (save a lookup)
These are summarized in design.md section 8. Extra details:
- `Game._renderView` sorts `drawables` by `y`. Props are drawn earlier by `PropSprites`, in the floor layer.
- Player feet are at `p.y + 14` (`HOLE_FALL.footOffset`). `PressureButton` has the `sortY`/occluder pattern that can be reused.
- Interactives live in `js/systems/DemoProgress.js`: per-player keys `e` / `shiftright`, a single player is enough, prompts are drawn as a plain sans-serif bar in `Game._render`.
- The anvil prop is `ANIMATED_PROPS.anvil` in `js/config/PropConfig.js` (w 2, h 1, art 24×24, native size). Chest art is in `assets/chest/`, coins in `assets/coin/`.
- Editor 2.0 enemies: `EDITOR2_ENEMY_KEYS` in `js/editor2/ContentCatalog.js` (`demon`, `bloodMonster`, `blackKnightB`, `cultist`). The design uses only the first three.

## Known gate failures (pre-existing, don't chase)
`npm run check` fails on `status.md` items #4 (`corridor_vertical_ns_1.json` not in `map/index.json`) and #5 (`test_modular_grid` "Curva SE"). Don't add new failures.

## Suggested skills
- `dungeon-chained-router`: start here for each slice.
- `implement` (and `tdd` for pure logic: wallet, magnet, `t()`, chest open-once, base collision box).
- `game-ui-ux`: HUD counter, speech bubbles, anvil menu (slice 2).
- `game-feel`: only the minimal juice the design lists.
- `audio-design` / playbook `add-sound.md`: placeholder sounds.
- `code-review` → `review.md`, then `pr`.
- Later slices: `level-design` (slice 5), `game-ai` (encounters, slice 4), `physics-tuning` (saw drag, slice 3).
- `grill-me` if a new design question comes up (Boots/Penhasco rooms are still undesigned).

## Suggested first prompt for the new session
> Leia `.agents/tasks/2026-10-29-inicio-core-loop/handoff.md` e continue: implementar a fatia 1 (`feat/scrap-chest`) seguindo o `plan.md`.
