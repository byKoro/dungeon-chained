# Game-feel dos acertos da serra

Status: done   <!-- planned | in-progress | done | abandoned -->
Branch: feat/combat-hit-gamefeel  Base: 1e609a5  Date: 2026-10-27

## Goal
Cada acerto da serra em inimigo fica claro e pesado: som (`sawHit`), reação do inimigo (stagger, knockback, poise nos fortes), flash, faíscas/sangue direcionais, número de dano e hit stop curto. Escopo do handoff `handoffs/combat-hit-gamefeel.md`; dano recebido pelos jogadores, Dash, serra lançada, câmera, mobs novos e mapas ficam fora.

## Context read
- AGENTS.md, handoffs/combat-hit-gamefeel.md
- .agents/context/systems/{combat-and-entities,weapons,visual-effects,audio}.md
- skills game-feel, audio-design, game-ai (PROJECT-NOTES.md)
- js/combat/CombatSystem.js, js/entities/MeleeEnemy.js, js/core/GameLoop.js, js/particles/ParticleSystem.js, js/Game.js, js/config/{GameConfig,DemoCombatConfig,EntityConfig}.js

## Steps
- [x] 1. Config: `js/config/CombatFeelConfig.js` (`ENEMY_HIT`, `HIT_FEEL`, `DAMAGE_NUMBER`), `HIT_STOP` em `GameConfig`, `poise` do tanque em `DemoCombatConfig`.
- [x] 2. `MeleeEnemy`: `takeHit(damage, hit)` com resultado, estados `hurt`/`stunned`, poise, vulnerabilidade, flash, knockback que não entra em buraco.
- [x] 3. Partículas: faíscas e sangue direcionais, `DamageNumber`, pool/draw em `ParticleSystem`.
- [x] 4. `CombatSystem`: ponto de impacto (disco/cabo), `onHit` por golpe e `onKill` só ao matar, feedback por tier; `hitFeedback` desliga tudo nos trailers.
- [x] 5. `GameLoop.triggerHitStop` (tempo real, render ativo, compõe com pause e slow-mo); ligação em `Game`.
- [x] 6. Testes: `tests/test_combat_feel.js`. Docs de sistema, glossário e status.

## Decisões
- Inimigo comum = `hp 1` (morre). Forte = `combat.poise > 0` (hoje só o tanque: hp 4, poise 3 ⇒ 3 golpes quebram a poise, o 4º vulnerável faz 2 de dano).
- Vulnerabilidade = multiplicador de dano (`vulnerableDamageMult`) + pulso amarelo; assim o número mostrado é o dano real aplicado.
- Hit stop por tier (`hit` 0,035 s, `kill` 0,07 s, `poiseBreak` 0,09 s), sempre clampado a 0,02–0,10 s; slow-mo de abate agora só em abates.
- `hitFeedback` é opt-in no `CombatSystem` para os trailers ficarem idênticos.

## Docs to update when done
- [x] .agents/context/systems/{combat-and-entities,weapons,visual-effects,audio}.md
- [x] .agents/context/glossary.md, .agents/context/status.md
