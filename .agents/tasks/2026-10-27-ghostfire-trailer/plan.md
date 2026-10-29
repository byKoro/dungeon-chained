# Ghostfire fiel ao trailer

Status: done
Branch: boss  Base: ad62c18  Date: 2026-10-27 (America/Cuiaba)

## Goal
Make the existing Ghostfire boss match the opening trailer's skull, horizontal pixel-art beam, animation phases, summons and side switches. Keep the current boss branch and all pre-existing working changes.

## Context read
- AGENTS.md, architecture.md, conventions.md, status.md
- systems/combat-and-entities.md, systems/rendering.md, playbooks/add-enemy.md
- Skills: dungeon-chained-router, game-ai (+ PROJECT-NOTES), code-review
- ADRs 0001–0003; js/trailer/scenes/rush/BossWallShot.js as the visual/behavior reference
- graphify unavailable; using docs and rg (npm run doctor for environment setup).

## Steps
- [x] 1. Reuse the existing sprite sheet and trailer geometry with integer scale and correct animation frames. Files: GhostfireRenderer, GhostfireBoss, GhostfireConfig.
- [x] 2. Implement arrival/roar, summon, charge, locked warning, horizontal beam, fade, recovery and teleport. Respect boss health in CombatSystem; reuse trailer audio and add world lights.
- [x] 3. Verify full attack cycle, damage/cooldown/death, safe summons, rendering in headless Chrome and npm run check. Record review and limitations.

## Docs to update when done
- [x] .agents/context/systems/combat-and-entities.md, rendering.md
- [x] .agents/context/status.md, glossary.md
- No structural ADR needed.
