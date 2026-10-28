# Verificação: armadilhas (flecha leste/oeste e fileira de espinhos)

## Causas
- Flecha: o tile de parede leste/oeste tem tijolo só em metade (oeste: colunas de pixel 9 a 15; leste: 0 a 6) e o resto é sombra. A posição do jogo é o centro do tile e a cabeça do lançador fica ~15px atrás da origem do sprite, então caía na sombra. Norte/sul têm tijolo no tile todo.
- Fileira: o editor 2.0 não gravava `wave`/`phase`; o jogo usa `el.wave || 0` e disparava todos os espinhos juntos. O mapa também desenhava um único `peaks3`, sem seta nem os tiles da fileira, e a colocação não ajustava a fileira à sala.

## Automatizada
- `node tests/test_hazard_layout.js`: passou. Cobre direção/deslocamento da flecha (oeste, leste, norte, sul e parede interna), fases e ordem de subida dos espinhos nos dois sentidos (primeiro tile primeiro para `right`, último primeiro para `left`, passo de 0,12 do ciclo), `fitSpikeRow`, `_arrowMount` (parede, encaixe no chão, porta) e `_applyHazard`/`_placeHazard` (remover a fileira por qualquer tile, recusar sobreposição).
- `node scripts/run-tests.mjs`: 13/14; só falha `test_modular_grid.js` (antigo, status.md #5).

## No navegador (Chrome headless, servidor só em 127.0.0.1, páginas temporárias removidas)
- Página com `Tileset`, `RoomTiles` e `ChallengeCorridor` reais (sem a iluminação escura do jogo): cabeças dos lançadores oeste/leste ficam sobre os tijolos, flechas disparam para dentro, norte/sul inalteradas; fileiras mostram a onda (espinho 1 levantado, 2 subindo, 3 e 4 recolhidos).
- Editor 2.0 com as mesmas armadilhas: lançadores girados e sobre a parede, espinhos por tile com seta laranja de direção.
- Primeiro valor de deslocamento (10px) ainda deixava a cabeça sobre a sombra; ajustado para 33px após medir a captura.

## Não verificado
- Jogo real com iluminação e jogadores (só o desenho dos hazards foi conferido), clique real do mouse no editor, Electron.
- Flechas em peças legadas `map/*.json` no jogo (devem acompanhar o mesmo deslocamento).
