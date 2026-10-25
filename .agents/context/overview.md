# Overview — Dungeon Chained

Local 2-player co-op roguelike. P1 (yellow, "Amarelo") and P2 (blue, "Azul") are tethered by an elastic cable with a circular saw at its midpoint. Moving together sweeps the saw through enemies; over-stretching snaps ("arrebenta") the cable, the saw drops, and both players must walk back to it to reconnect. Rooms are authored pieces (`map/*.json`) laid out by a procedural dungeon graph. Losing all lives on either player ends the run.

- Team: 2 devs (GitHub `byKoro/dungeon-chained`, authors `bykoro`, `rryuto`). AI assistants used: Claude (Opus), Codex, Gemini, Kiro.
- Stack: vanilla JavaScript ES modules + HTML5 canvas 2D. No engine, no bundler, no runtime npm deps. Desktop build via Electron (`electron/main.cjs`, custom `app://game/` protocol). Python only for the dev server (`serve.py`).
- Online mode was removed; only local co-op exists (keyboard + gamepads).
- Language: code identifiers English; UI text English; editor UI, room-piece labels, enemy labels, test messages and remaining comments pt-BR. See `glossary.md`.

## Run

| Goal | Command |
|---|---|
| Play in browser (with editor save API) | `python serve.py` → http://localhost:8000 (game), http://localhost:8000/editor.html (room editor) |
| Play desktop | `npm install` once, then `npm start` |
| Build installer + portable (Windows x64) | `npm run dist` → `dist/desktop/` |
| Tests + map validation + doc drift + graph update | `npm run check` |
| Environment check | `npm run doctor` |

Opening `index.html` via `file://` does NOT work (`fetch` of `map/*.json`).

## Repo map

```
index.html, css/style.css     game page + DOM overlays (loading/pause/death)
editor.html, css/editor.css   room-piece editor
js/main.js                    bootstrap only
js/Game.js                    orchestrator: owns every subsystem, _step/_render
js/core/                      loop, input, renderer, tileset, assets, audio, chain, physics, dungeon graph
js/rooms/                     room catalog, room manager, room state, tile queries, spawn safety
js/entities/                  Entity, Player, MeleeEnemy, traps, buttons, hearts
js/combat/CombatSystem.js     enemy updates, saw hits, deaths, heart drops
js/weapons/                   Weapon, SawWeapon, SawMotorAudio
js/systems/                   lighting, post-process, particles glue, gore, wind, challenge corridors, AI, spawns
js/particles/                 particle types + ParticleSystem + BloodCanvas
js/ui/                        pixel UI (font, buttons, slider, screens, VtuberHud)
js/config/                    ALL tuning: GameConfig, EntityConfig, AudioConfig, TinyRpgEnemies
js/editor/EditorApp.js        RoomEditor (single big class)
map/                          room pieces + index.json (must list every piece)
assets/                       png/wav/ogg loaded at runtime (no build step)
tests/                        standalone node scripts (no framework)
electron/                     desktop shell
scripts/                      dev scripts (npm run …)
.agents/                      AI context (this folder)
```

## Where to read next

1. `architecture.md` — boot, subsystem ownership, update/render order, dependency rules.
2. `conventions.md` — code style, units, testing, definition of done.
3. `systems/<area>.md` for the area you touch; `../playbooks/` for common additions.
4. `../decisions/` before changing anything structural.
5. `status.md` for open branches and known bugs.
