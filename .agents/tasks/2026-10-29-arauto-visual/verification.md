# Verificação: Arauto das Brasas — visual

## Executado
- `node tests/test_arauto_das_brasas.js`, `test_flame_golem.js`, `test_flame_golem_abilities.js` e `npm test`: passam (só falha o `test_modular_grid`, pré-existente #4).
- `node --check` nos arquivos JS alterados.
- Uma captura isolada da barra de chefe (Edge headless, tela de 360 px de altura, escala 2x) mostrou a placa de nome com chamas, a moldura, o emblema, as marcações e a marca dos 50%, sem erro de página.

## Não verificado
- Nada foi visto no jogo: pose de espera de cada ataque, sombra, contorno, luz, brasas, a barra em resolução real e junto do HUD.
- O resultado de `drawHeight` 195 na arena.
- O contorno e a luz dependem de DOM/canvas e não têm teste automatizado além de "não lança sem DOM".
