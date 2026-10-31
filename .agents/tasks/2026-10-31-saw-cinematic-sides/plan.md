# saw cinematic sides

Status: done   <!-- planned | in-progress | done | abandoned -->
Branch: main  Base: 2262dbf  Date: 2026-10-31

## Goal
Nova cinemática da Serra: depois da compra, os dois jogadores andam sozinhos até um lado cada da bigorna, vêm as três marteladas, a serra nasce (salta e pousa) sem o círculo branco de brilho, e no fim ela se conecta direto nos dois. Some a etapa "os dois precisam chegar perto da serra".

## Context read
- AGENTS.md, dungeon-chained-router
- .agents/context/systems/ui.md (Saw cinematic), architecture.md (sawCinematic)
- js/systems/SawForgeCinematic.js, js/config/ForgeConfig.js, js/Game.js, js/core/Chain.js, js/weapons/SawWeapon.js (drawAt, pickup), js/entities/Player.js, js/systems/RoomProps.js, js/core/PropBodies.js
- map/demo/inicial.json (bigornas com "saw" em 1,1 e 2,1: há chão dos dois lados)

## Steps
- [x] 1. `Player.autoMove`: direção roteirizada lida pelo `handleInput` no lugar das teclas.
      Files: js/entities/Player.js
- [x] 2. `SawForgeCinematic`: fase de caminhada (lado esquerdo/direito pela posição x, contorna a base da bigorna pela frente), linha do tempo da forja relativa à chegada, pose sem `glow`, serra desce até o meio dos dois antes do fim.
      Files: js/systems/SawForgeCinematic.js, js/config/ForgeConfig.js, js/weapons/SawWeapon.js
- [x] 3. `Game`: injeta jogadores, caixa da bigorna e colisão; no fim `chain.reset({ present: true })` + primeira reconexão. Remove `_sawOnAnvil` / `_sawFirstConnect` e a fala `talk.sawReady`.
      Files: js/Game.js, js/i18n/pt-BR.js, js/i18n/en.js
- [x] 4. Teste da cinemática atualizado (caminhada, lados, sem glow, conexão).
      Files: tests/test_saw_cinematic.js
      Verify: npm test, npm run check

## Docs to update when done
- [x] .agents/context/systems/ui.md
- [x] .agents/context/architecture.md
- [x] .agents/context/status.md
- ADR: não (não é estrutural)
