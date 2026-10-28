# Verification — Cultista

## Automated
- npm run check: 15/16 arquivos de teste passaram, inclusive test_cultist.js, test_editor2_content_catalog.js e test_combat_feel.js.
- Gate falha somente nos dois problemas preexistentes: Curva SE em test_modular_grid.js e corridor_vertical_ns_1.json ausente do índice.
- Grafo reconstruído; git diff --check passou.
- test_cultist: spawn da subclasse, distância ajustável, aproximação/recuo, tile de fuga caminhável, alvo mais próximo vivo, marca fixa, esquiva, entrada na área ativa, dano uma vez por jogador, AoE nos dois, stagger cancela conjuração, congelamento de spawn e 70 ticks de morte.

## Browser
Jogo iniciado no Chromium headless via servidor localhost; zero exceções JavaScript no boot. Spawn real e PNG decodificada; todos os 14 quadros de ataque com o pilar separado e os 10 quadros da morte renderizados via draw real, inspecionados em /tmp/cultist-verification.png. preferredDistance observado: 220.

## Not verified
Partida cooperativa com controles reais, balanceamento, som e empacotamento Electron. Recuo pode ser limitado por paredes ou jogadores cercando o cultista; preparação e recuperação são estacionárias.
