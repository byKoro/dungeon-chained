# Flame Golem playable baseline
Date: 2026-10-28 (America/Cuiaba). Branch: feat/flame-golem.
Scope: user approved slow, resistant melee baseline with all three attacks and full death. No sanctuary room or final herald moveset.
Existing: flameGolem sprite registration, AssetLoader, SpawnSystem and classic editor already work. No new class required: existing MeleeEnemy options cover this scope.
Read: AGENTS.md, architecture/conventions, status/glossary, combat-and-entities, rendering, room-editor, add-enemy playbook, dungeon-chained-router, game-ai + PROJECT-NOTES, ADRs and code-review skill.
Completed steps: inspect every sheet row and crop bounds; add combat config; release editor2 choice; add spawn/attack/dodge/death tests; render actual draw frames in Chromium; parallel standards/spec review; run check and graph.
Provisional tuning: 6 HP, speed 0.8 px/step, windup 65 ticks, recovery 48 ticks. Attack sequence 1/2/3, impacts frames 6/6/5. Full death 6 frames x 7 ticks. Standard melee range 44/58; no AoE, projectile or new special behavior.
Preserve original PNG, sprite scale and Dash. Previous uncommitted cinematic work preserved.
