# Verificação
- `node tests/test_arauto_intro.js`: passa (pose, faixas, fase 2, ordem dos quadros 5→0 + attack2 0→8, um impacto, 6 estalos, curta/completa/forçada, skip, sem dano no atraso, segurar E com armar/esvaziar, Game abre a cena e não o intro genérico, E bloqueado após pular, expressões no PlayerFactory).
- `test_arauto_effects`, `test_arauto_das_brasas`, `test_cinematic_bars`: passam.
- `npm test`: 40/41; só `test_modular_grid` (item antigo #4).
- `npm run check`: falha só nos itens antigos #4 (`test_modular_grid`) e #5 (`corridor_vertical_ns_1.json` fora do `index.json`); grafo reconstruído (3223 nós). `node --check js/editor2/ContentTools.js` ok.
- Não verificado: nada foi visto no jogo (câmera, barras sobre os avatares, tecla E/anel, som dos estalos, transição morte→attack2, expressões em campo, checkbox do editor).
