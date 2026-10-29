# Arauto entrance scene
Status: implemented; branch codex/arauto-entrance-scene; base c92e13a.

## Approved design
Enter room -> bars -> three slow safe automatic steps -> notice dark crouched Arauto -> curiosity ahn, P1 then P2 -> embers wake (no lava fissures) -> rise/arms up -> gasp -> ground impact (new deep stone audio/dust/debris/shake/blur) -> safe recoil -> determined portraits and hm -> name/bar -> restore camera/controls -> 0.8s before boss attacks.
Full ~6s, short ~2s on subsequent attempts in same session across death/restart; hold either interact1s to skip, editor checkbox repeats full. Entire gameplay frozen/protected during scene. New original scene sounds and six distinct synthesized vocal reactions, P1 higher/expressive P2 lower/restrained. User confirmed design and implementation after grilling rounds1-15.

## Context read
architecture, conventions, glossary, status, systems/room-editor, rendering, visual-effects, audio; add-sound playbook; router, grilling, game-feel and audio-design skills/notes. Read prior phase scene and Game entry/death hooks. Read-only facts agent inspected map and animations. No dedicated wake art exists; compose existing attack2 poses. No structural ADR required.

## Implementation
- ArautoEntranceConfig/Scene: timeline, bars, camera, expressions, voices, skip, storage and cleanup.
- Game: replace generic room intro for authored flameGolem; dormant before fade; deferred start after fade; freeze, safety constraints, HUD gating, skip key release latch and death retry reset.
- FlameGolemEnemy: optional cinematic pose/darkening/light suppression, presentation only.
- Editor ContentTools repeat flag in test session; i18n skip hint.
- AudioConfig plus ten original procedural WAVs and deterministic builder/provenance.
- Tests: scene, input/skip, reset/retry, actual clamp, raised/downstroke frame, audio asset properties; Electron Game recording and screenshots.

## Preserved local work
Torch placement/docs/test changes, DemoConfig camera tuning and demo_campaign.json user map edits predate this task; preserved. No map edit by this task.
