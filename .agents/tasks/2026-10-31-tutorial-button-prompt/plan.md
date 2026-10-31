# tutorial button prompt

Status: done
Branch: main (uncommitted work from other tasks already present)  Base: 2262dbf  Date: 2026-10-31

## Goal
Tutorial cards (first: the dash card) show which button to press, as a clear pixel-art icon of the device each player is using (keyboard key, Xbox, DualShock). The icon "presses" in sync with the action in the card video. Reusable pattern for the next quick tutorials.

## Context read
- AGENTS.md, systems/ui.md (InteractPrompt), js/ui/AbilityCard.js, js/ui/DashDemo.js, js/systems/InteractPrompt.js, js/config/InteractPromptConfig.js, scripts/gen-interact-prompt.py, js/core/InputHandler.js (devices, dash = pad 0/5, interact = pad 2), EntityConfig.playerConfigs (controls, colors).

## Steps
- [ ] 1. Asset: `scripts/gen-button-prompts.py` → `assets/ui/button_prompts.png` (keycaps 1-wide/wide, Xbox A/X, DualShock ✕/□; normal + pressed rows). Same palette as the interact prompt.
      Verify: `--preview` contact sheet, viewed.
- [ ] 2. Config `js/config/ButtonPromptConfig.js` (sheet rects, action → icon per device/player, key labels via i18n) + `js/ui/ButtonPrompt.js` (resolve + draw into an art-px canvas).
- [ ] 3. AbilityCard: `CARDS` table (key → action, demo loader); bottom row with the button of each player (deduped; P1/P2 tags when different), pressed in sync with `demo.pressed`; text cards pulse.
      Files: js/ui/AbilityCard.js, js/ui/DashDemo.js, js/core/AssetLoader.js, i18n.
- [ ] 4. Tests: update test_ability_card (icons per device instead of btn text). Electron frame export for keyboard/xbox/playstation.

## Docs to update when done
- [ ] .agents/context/systems/ui.md (tutorial card pattern + button prompt)
- [ ] .agents/context/systems/rooms-and-maps.md (dash card bullet)
- [ ] .agents/context/status.md
