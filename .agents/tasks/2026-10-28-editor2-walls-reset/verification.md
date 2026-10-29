# Verificação: reset de sala e pincel de Parede (editor 2.0)

Branch: `feat/editor2-walls-reset` (a partir da `main`).

## Executado
- `node tests/test_wall_autotile.js` e `node tests/test_room_reset.js`: passam.
- `npm test`: 16 de 17 arquivos passam; falha só `test_modular_grid` (pré-existente, `status.md` #4).
- Editor 2.0 no Edge headless (servidor estático): ferramenta Parede ativa, traço vertical pintou a coluna de parede com sombra no piso vizinho, o lado sem centro/portas/spawns virou vazio, "Resetar sala" pediu confirmação e Ctrl+Z (`_undo`) restaurou. Sem erros de página. Captura conferida.

## Não verificado
- Arrastar com o mouse real (o traço foi disparado por `_beginStroke`/`_continueStroke`/`_endStroke`).
- Variações de tile (topo 1–4, base 41–44, laterais 10/20/30 e 15/25/35, sombra 12/13 e 32/33) vêm do mapa de tiles do código, não de conferência do tileset sprite a sprite.
- Salas com traços que cortam portas ou formam áreas fechadas complexas; teste do mapa no jogo com salas que têm vazio.
