# coop heal juice
Status: done
Branch: feat/tackle-unlock  Base: d499dd6  Date: 2026-10-31
## Goal
Make the Vínculo (proximity heal) readable and satisfying: show the charge filling around each player and give the heal moment a pixel-art payoff.
## Context read
- AGENTS.md, .agents/skills/game-feel (SKILL + PROJECT-NOTES), .agents/context/systems/visual-effects.md, weapons.md
- js/systems/CoopHeal.js, js/systems/SawTackleFeedback.js (pattern), js/particles/DamageNumber.js, Game.js render/update order
## Decisions (grill round, user answers)
Q1 ring per player + rising motes · Q2 green · Q3 only when someone is missing life, nothing in cooldown · Q4 intensity grows (motes, ring, light) · Q5 heal: expanding ring + "+1" + burst, no shake/hit-stop · Q6 fade on separation, shatter on damage, silent · Q7 no charge sound · Q8 not answered → kept existing `pickup` · Q9 reduced motion respected · pixel-art particles at the game's art pixel (4 world px).
## Steps
- [x] 1. One-step flags `healed`/`broke` in CoopHeal. Files: js/systems/CoopHeal.js. Verify: test_coop_heal.
- [x] 2. CoopHealFeedback + COOP_HEAL_FEEL. Files: js/systems/CoopHealFeedback.js, js/config/CoopHealFeelConfig.js, js/particles/DamageNumber.js (`opts.text`).
- [x] 3. Wire in Game (construct, update, resets, drawFloor, overlay, lights). Files: js/Game.js. Verify: headless Chrome captures.
## Docs to update when done
- [x] .agents/context/systems/visual-effects.md, weapons.md
- [x] .agents/context/status.md
- [ ] ADR (not structural)
