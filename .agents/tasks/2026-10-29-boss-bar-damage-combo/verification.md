# Verificação

## Automatizada
- `node tests/test_damage_combo.js`: passou. Janela de 48 passos, soma incluindo o 1º golpe, invisível com 1 golpe, um combo por inimigo, acompanha o inimigo, golpe que mata congela no lugar, segura e some, golpe único que mata não deixa total, todas as faixas da escala de cores, desenho, limite, `clearDamageNumbers`/`clear` e a chamada do `CombatSystem._hitFeedback`.
- `node tests/test_arauto_das_brasas.js`: passou, com a altura do layout atualizada para incluir `dripRoom` e a checagem de altura 19 (RESUME).
- `node tests/test_combat_feel.js`: 80 passaram, 0 falharam.
- `node scripts/check.mjs`: 41/42 arquivos de teste; só falha `test_modular_grid.js` (antigo, #5). Mapa só com o erro antigo #4. Graphify não instalado.

## No navegador (Chrome headless, servidor só em 127.0.0.1, páginas temporárias removidas)
- Página com o `renderPixelButton('RESUME')` real ao lado da `BossHealthBar` real: fase 1 cheia, fase 1 com rastro, fase 2 com 35%. Moldura, face, reflexo, lábio e pingos de lava conferem com o RESUME; sem chamas; marcador de 50% visível.
- Totais de 2, 4, 6, 8, 11, 15 e 22 desenhados por cima dos números individuais com as cores da escala; o vermelho escuro continua legível com o contorno.
- Jogo clássico (`index.html?skipTrailer&classic`): golem criado por script ao lado dos jogadores com 72/100 de HP, 6 golpes por `combat._hitFeedback` a cada 120 ms. A barra apareceu no rodapé entre os retratos e o total "6" em amarelo ficou acima dos números individuais, sem erros no console.

## Não verificado
- Luta real contra o Arauto no mapa da demo (intro, troca de fase, morte) com golpes vindos da serra.
- Pulso dos pingos e da fase 2 em movimento (só quadros parados).
- Electron.
