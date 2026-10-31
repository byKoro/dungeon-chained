# tackle unlock

Status: done   <!-- planned | in-progress | done | abandoned -->
Branch: feat/tackle-unlock  Base: d499dd6  Date: 2026-10-31

## Goal
O tackle da serra (dash na serra solta a lança) passa a ser a receita grátis "Investida" da bigorna da Penhasco.
Nos mapas do Editor 2.0 fica travado até a dupla pegar a receita; ao pegar, a forja fecha e uma telinha com
"vídeo" (dash na serra → serra voa sobre um vão e mata um demônio numa ilha) ensina o uso. O F1 ganha
Moedas, telinhas e abrir bigorna para testar.

Decisões (entrevista grill-me, 2026-10-31):
- id `tackle`, `costs: [0]`, `item: "saw"`; menu mostra "GRÁTIS"/"FREE" no lugar do preço.
- Só na bigorna da Penhasco, primeira linha; fora de `defaultRecipes`.
- Desbloqueio = nível da forja (`forge.has("tackle")`): morte na sala desfaz (ADR 0014), debug já cobre.
- Editor 2.0: sempre travado até pegar (mesmo em mapa sem a receita). Modo clássico: liberado.
- Travado: dash na serra solta não lança; empurrão/arrasto seguem iguais; sem feedback de travado.
- Arauto lançando a serra solta (`onBossImpacts`) não muda.
- Compra: forja fecha em silêncio e mostra o card `ability.tackle`; some no primeiro tackle ou em 9,5 s.
- Demo: serra já solta, Amarelo dá dash nela, voa sobre vão, mata demônio na ilha, volta; ~4,5 s; botão afunda.
- Sala Penhasco não muda (fora a lista da bigorna).
- Teste do editor: checkbox "Investida" (desmarcada) que começa com a receita.
- F1 no topo: "Moedas: N" (±10), "+100 moedas", "Telinha: <card>" (mostra sem liberar), "Abrir bigorna: <sala>"
  (abre a forja daquela bigorna onde a dupla está; ignora inimigo vivo, não em transição/game over).
- Glossário: Scrap em pt-BR = "moedas"; código segue `scrap`.

## Context read
- AGENTS.md, .agents/backlog/tackle-serra.md, status.md (tackle, botas, ADR 0014)
- js/systems/SawTackle.js, ForgeState.js, ForgeSystem.js, DebugMenu.js; js/ui/AbilityCard.js, DashDemo.js, ForgeMenu.js
- js/Game.js (forja, tackle, card, morte na sala), js/config/ForgeConfig.js, js/i18n/*.js, js/editor2/ContentTools.js

## Steps
- [x] 1. Receita `tackle` + "GRÁTIS" + i18n + bigorna da Penhasco
      Files: js/config/ForgeConfig.js, js/ui/ForgeMenu.js, js/i18n/pt-BR.js, js/i18n/en.js, map/demo/inicial.json
      Verify: npm run validate:map, teste de ForgeState
- [x] 2. Trava: `canTackle` no SawTackle; Game passa `!mapData || forge.has("tackle")`; teste do editor força
      Files: js/systems/SawTackle.js, js/Game.js, js/editor2/ContentTools.js, editor2.html
      Verify: tests/test_saw_tackle.js
- [x] 3. Compra fecha a forja e mostra o card; dismiss no `sawTackle.justTackled`
      Files: js/Game.js, js/ui/AbilityCard.js
- [x] 4. TackleDemo + entrada em CARDS (dismiss por ação, não por dash)
      Files: js/ui/TackleDemo.js, js/ui/AbilityCard.js
- [x] 5. F1: Moedas, +100, Telinha, Abrir bigorna
      Files: js/systems/DebugMenu.js, js/systems/ForgeSystem.js (lista de bigornas do mapa)
- [x] 6. Testes headless; docs; npm run check; graph

## Docs to update when done
- [x] .agents/context/systems/weapons.md / ui.md (forja, card, F1)
- [x] .agents/backlog/tackle-serra.md (ponto em aberto 3)
- [x] .agents/context/status.md
- [x] .agents/context/glossary.md (Investida, moedas)
- ADR: não (decisão de conteúdo, sem mudança estrutural)
