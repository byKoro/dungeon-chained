# saw drag

Status: done   <!-- planned | in-progress | done | abandoned -->
Branch: feat/saw-drag (from feat/anvil-forge)  Base: e712050  Date: 2026-10-29

## Goal
Fatia 3 do design `../2026-10-29-inicio-core-loop/design.md` ("Arrastar a serra" e a melhoria Peso). Com o cabo arrebentado, um jogador sozinho segura interagir perto da serra e a arrasta devagar por um cabo curto, sem girar nem cortar; passada a distância de arrasto o cabo curto arrebenta; o parceiro chegando perto reconecta normalmente. Peso aumenta a distância (2 → 3 → 4 tiles) e a velocidade (40% → 55% → 70%).

## Context read
- Design (seção 2), `weapons.md`, `players-and-chain.md`, `js/core/Chain.js`, `js/weapons/SawWeapon.js`, `js/entities/Player.js` (`update`, `handleInput`), `js/Game.js` (`_updateGameplay`, `_renderView`).

## Decisions taken here
- "Segurar" = manter interagir apertado: segurar `grabSteps` (14) prende, soltar larga. Toque curto não prende (os toques são dos baús, da bigorna e das falas).
- A distância de arrasto conta o caminho percorrido pela serra. Ao arrebentar, é preciso soltar a tecla antes de pegar de novo.
- A serra arrastada não entra em buraco nem parede; esticada demais contra o obstáculo, o cabo curto arrebenta.
- Não arrasta a serra recém-forjada que está na bigorna (a primeira conexão é dos dois).

## Steps
- [x] 1. `Player.update({ speedScale })`.
- [x] 2. Peso no catálogo (`FORGE.recipes.weight`), `SAW_DRAG`, `sawDragStats`.
- [x] 3. `js/systems/SawDrag.js` + ligação no `Game` (ordem, dash bloqueado, dica, cabo curto desenhado, resets).
- [x] 4. Testes (`test_saw_drag.js`) e verificação no Electron.

## Docs to update when done
- [x] weapons.md, architecture.md, glossary.md, status.md
