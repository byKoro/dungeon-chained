---
name: dungeon-chained-router
description: Routes any Dungeon Chained gameplay, content or tooling task to the right project context doc, playbook and skill. Use at the start of a game task (enemy, trap, room piece, weapon, sound, VFX, UI, camera, input, physics, generation, assets, performance) or when unsure which skill applies in this repo.
---

# Dungeon Chained router

This repo is a vanilla JS + canvas co-op roguelike (no engine). Generic gamedev skills give the ideas; project docs give the APIs. Always read in this order: `AGENTS.md` → the context doc → the playbook → the skill (and its `PROJECT-NOTES.md`).

## Routing table

| Task | Context doc (`.agents/context/`) | Playbook (`.agents/playbooks/`) | Skill |
|---|---|---|---|
| New enemy / enemy AI | `systems/combat-and-entities.md` | `add-enemy.md` | `game-ai` |
| New trap / challenge room | `systems/combat-and-entities.md`, `systems/rooms-and-maps.md` | `add-trap.md` | `level-design` |
| New room piece / layout | `systems/rooms-and-maps.md`, `systems/room-editor.md` | `add-room-piece.md` | `level-design` |
| Dungeon generation | `systems/rooms-and-maps.md` | — | `procedural-gen`, `roguelike` |
| Weapon / chain / saw | `systems/weapons.md`, `systems/players-and-chain.md` | `add-weapon.md` | `game-feel`, `physics-tuning` |
| Sound / music / mix | `systems/audio.md` | `add-sound.md` | `audio-design` |
| Particles, shake, hit-stop, juice | `systems/visual-effects.md` | `add-particle-effect.md` | `game-feel` |
| Lighting / rendering / camera | `systems/rendering.md`, `systems/visual-effects.md` | — | `game-feel`, `performance-optimization` |
| Menus, HUD, screens | `systems/ui.md` | `add-ui-screen.md` | `game-ui-ux` |
| Input, gamepad, bindings | `systems/players-and-chain.md` | — | `input-systems` |
| Collisions, movement feel | `systems/players-and-chain.md` | — | `physics-tuning` |
| Sprites, tiles, art direction | `conventions.md` (Assets), `systems/rendering.md` | — | `create-game-assets` |
| FPS drops, stutter | `architecture.md` | — | `performance-optimization` |
| Old branch port | `status.md` | `port-old-branch.md` | — |
| Hard bug | relevant system doc | — | `diagnosing-bugs` |
| Plan / spec a feature | `conventions.md` (Work flow) | — | `grill-me`, `to-spec`, `to-tickets` |

## Rules
- Translate engine examples (Godot/Unity) into this codebase's APIs; never add an engine or npm runtime dependency (ADR 0001).
- New behaviour goes into a subsystem constructed in `Game` (ADR 0002); tuning goes in `js/config/*` (ADR 0003).
- Finish with `npm run check` and update the context doc you used.
