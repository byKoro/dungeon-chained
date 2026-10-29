# Verification — Black Knight B

## Automated
- `node tests/test_black_knight_b.js`: passou; spawn, resistência via combate, intervalo de dano, ciclo de três ataques com dano e quatro quadros de morte.
- `npm run check`: 10/11 arquivos passaram; falhas preexistentes em test_modular_grid.js (Curva SE) e mapa corridor_vertical_ns_1.json ausente de map/index.json. Grafo reconstruído com sucesso.

## Browser
Chromium via CDP, módulos recarregados sem cache: SpawnSystem retornou hp=4, três attackKeys e dyingDuration=28. Imagem PNG carregada (900px); renderização dos três ataques e quatro quadros da morte pelo draw real em canvas inspecionada em /tmp/black-knight-b-verification.png.

## Not verified
Partida cooperativa completa, controles reais e balanceamento com jogadores. Screenshot demonstra as sprites, não uma partida completa.
