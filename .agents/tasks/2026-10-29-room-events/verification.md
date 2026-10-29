# Verification — room events

## Automated
- `npm test`: 29/30 arquivos; só falha `test_modular_grid.js` (antigo, status.md #5). Novo `test_room_events.js` (22): `parseWaves`/`formatWaves`, zona por cantos, grade, gaiola com API falsa (início pela zona, corda automática, levas em ordem de corte e acumulando, aspirar ao limpar, morte restaura, queda da gaiola, baú escondido/aberto, grades sobem, concluído sobrevive à morte e à recriação).
- `inicial.json` passa `normalizeMap` + `validatePlayable` (sem erros).

## No jogo (Electron + `python serve.py`, `_local/verify-events.cjs`, não versionado)
Teste do Editor 2.0 na sala `inicial` com serra; jogadores posicionados por script, inimigos mortos com `startDying`. Console sem erros.
- `_runRules` ativo; baú 2 escondido no início.
- Os dois no salão: corda 1 arrebenta, 6 caixas de grade ativas, 3 inimigos, fala "Ainda tem cordas segurando aquilo...". Capturas: gaiola pendurada com cordas, grades no corredor vertical e no norte, sombras das levas caindo.
- Cortes passando o cabo perto das estacas (3,10) e (4,16): leva 2 (4 inimigos) e leva 3 (3).
- `p1.lives = 0` no meio: dupla de volta ao spawn (3,27) com 3 vidas, sucata 0, encontro em `idle`, grades abertas, sem game over.
- Encontro completo de novo: 4º corte → gaiola caída com 5 inimigos; matando todos → `done`, baú 2 aberto, grades abertas. Morte depois disso mantém `done`.
- Editor 2.0: zona `salao` por dois cliques, grade num tile, encontro com duas levas salvo e listado. Sem erros.
- Uma primeira rodada travou com a posição do P1 em NaN: era erro no próprio script de verificação (desestruturação errada), confirmado com uma trava no setter; o jogo não tinha problema.

## Not verified
- Jogando de verdade com dois jogadores (cortes reais com a serra girando, dificuldade das levas, inimigos contra as grades).
- Sons e leitura visual dos placeholders sob a iluminação real.
- Morte em outra sala do mapa (o `inicial` é a única sala do mapa de teste).
