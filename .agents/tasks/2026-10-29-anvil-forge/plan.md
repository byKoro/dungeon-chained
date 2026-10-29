# anvil forge

Status: in-progress   <!-- planned | in-progress | done | abandoned -->
Branch: feat/anvil-forge (from feat/scrap-chest)  Base: be85582  Date: 2026-10-29

## Goal
Fatia 2 do design `../2026-10-29-inicio-core-loop/design.md` (seções 1, 2 "Bigorna e forja" e "Melhorias da serra", 4). Nos mapas do Editor 2.0 que oferecem a receita da Serra, a dupla começa sem cabo e sem serra. A bigorna abre um menu (jogo congelado, cursor único) para craftar a Serra com sucata e comprar Tamanho, Elasticidade e Serra dupla. Craftar a Serra toca uma cinemática curta; a serra fica na bigorna até os dois chegarem perto. A tuning do cabo sai do construtor do `Game` para config (bug #11, parte do cabo).

## Context read
- Design (seções 1, 2, 4, 8, 9), handoff, `AGENTS.md`, `architecture.md`, `conventions.md`, `systems/ui.md`, `weapons.md` (via context-gatherer), `status.md`.
- Code: `js/core/Chain.js`, `js/weapons/SawWeapon.js`, `js/combat/CombatSystem.js` (`resolveWeaponHits`), `js/systems/ThrownSaw.js`, `js/systems/DemoProgress.js`, `js/core/GameLoop.js`, `js/systems/DemoCamera.js`, `js/core/InputHandler.js`, `js/core/MenuPad.js`, `js/Game.js` (`_step`, `_updateGameplay`, `setPaused`, `_pollMenuPad`, `newDungeon`, `transitionThroughDoor`, `_renderView`).

## Decisions taken here (design leaves them open)
- "Começar sem serra" vale quando alguma bigorna do mapa oferece a receita `saw`. Mapas sem bigorna (ex.: `demo_campaign.json`) continuam começando com a serra. O teste do Editor 2.0 ganha a caixa "Serra" (como Dash/Lançar Serra/Chave).
- Menu desenhado no canvas (não DOM), para o cursor único não depender do foco do navegador. Navegar: W/S, setas, D-pad/analógico. Comprar: Espaço/Enter/A. Fechar: interagir (E / Shift direito / X), B ou Esc.
- "Não abre com inimigos vivos na zona": zonas são da fatia 4; por ora, inimigos vivos na sala.
- Peso fica para a fatia 3 (não aparece no menu). Botas e a bigorna da sala das Botas ficam fora (conteúdo fora do escopo).
- Compras e itens zeram no `newDungeon` (restart); a regra de morte que preserva itens é da fatia 4.

## Steps
<!-- ordered; each step leaves the game loadable -->
- [ ] 1. Tuning do cabo em `js/config/ChainConfig.js` (`CHAIN`), lida pelo `Game`.
      Verify: testes existentes; jogo carrega igual.
- [ ] 2. Serra ausente: `Chain` com `present`, `removeSaw()`, `spawnSaw(x, y)`; `reset()` e a troca de sala respeitam a ausência. `DemoProgress.state.saw`; início sem serra quando o mapa oferece a receita; caixa "Serra" no teste do editor.
      Verify: teste de Chain (sem reconexão, sem desenho; spawn exige os dois perto).
- [ ] 3. `js/config/ForgeConfig.js` (catálogo) + `js/systems/ForgeState.js` (comprar, apagado por item/sucata, níveis).
      Verify: teste unitário.
- [ ] 4. Melhorias na serra: Tamanho (raio do disco e de acerto), Elasticidade (tensão e ruptura), Serra dupla (duas serras em 1/3 e 2/3 acima de ~85% da ruptura, junta de novo ao aproximar). `CombatSystem` e a colisão consideram todas as serras.
      Verify: teste (raios, distâncias, divisão/junção com histerese, dois discos acertam).
- [ ] 5. Menu da bigorna: `ForgeSystem` (proximidade, abrir/fechar, compra, congelamento) + `js/ui/ForgeMenu.js` (desenho). Editor 2.0: receitas por bigorna.
      Verify: teste da lógica de input do menu; observar no jogo.
- [ ] 6. Cinemática da serra (~4 s): letterbox, foco da câmera na bigorna, três marteladas com faísca e shake crescente, serra salta girando e cai na bigorna; fala "Juntos, perto da serra!"; reconexão ampliada e título "SERRA".
      Verify: observar no jogo por script.

## Assets requested (placeholders in this slice)
- Ícones dos itens/melhorias no menu; arte do martelo (as marteladas usam só faísca e som).
- Sons: martelada (placeholder: impacto do trailer), compra na bigorna.

## Docs to update when done
- [ ] .agents/context/systems/weapons.md, players-and-chain.md, ui.md, room-editor.md, architecture.md
- [ ] .agents/context/status.md (#11 parcial), glossary.md (forja, melhorias, serra dupla)
