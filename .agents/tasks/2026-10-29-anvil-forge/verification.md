# Verification — anvil forge

## Automated
- `npm test`: 27/28 arquivos; só falha `test_modular_grid.js` (antigo, status.md #5). Novos: `test_forge` (21: serra ausente, spawn, catálogo, compras), `test_saw_upgrades` (12: Tamanho, Elasticidade, Serra dupla com histerese, dois discos acertam), `test_forge_menu` (19: proximidade, bloqueio por inimigos, abrir/fechar, cursor, compra, teclas seguradas), `test_saw_cinematic` (9: marteladas, shake crescente, salto, squash, fim único, câmera devolvida).
- `npm run check`: falha só nos itens antigos #4 e #5.

## No jogo (Electron do projeto + `python serve.py`, `_local/verify-forge.cjs`, não versionado)
Mapa `map/demo/inicial.json` pelo teste do Editor 2.0 (sala isolada, "Serra no início" = conforme o mapa). Jogadores posicionados por script; teclas reais via `sendInputEvent`. Console sem erros.
- Início: `hasSaw` false, sem cabo, sem disco.
- Baú 1 rendeu 10 (6 coletados pelo ímã + 4 creditados por script).
- Perto da bigorna aparece a dica; E abre o menu com as quatro receitas e o saldo 10. Segurando D por 0,5 s com o menu aberto, P1 andou 0 px (jogo congelado). Captura: menu conferido (Serra disponível, melhorias apagadas, custo com ícone, descrição, dica de teclas).
- Espaço compra a Serra: menu fecha, saldo 0, cinemática começa. Capturas: letterbox + câmera aproximada na bigorna; serra no alto do salto. Ao fim: serra largada na bigorna, fala "Juntos, perto da serra!".
- Os dois perto da serra: conecta e aparece "SERRA" grande (captura).
- Com +100 de sucata: reabre com o cursor na primeira melhoria comprável; compras de Elasticidade e Serra dupla aplicadas (`breakDistance` 276, `strainDistance` 189,75, `doubleSaw` true). E fecha.
- Serra dupla: segurando os jogadores a 90% da ruptura, duas serras na tela (captura) e o cabo continua conectado.
- `game.restart()`: volta sem serra, compras e sucata zeradas.
- Mapa principal (`demo_campaign.json`, sem bigorna): começa com a serra (`hasSaw` true).
- Editor 2.0: com Bigorna selecionada aparecem as quatro caixas de receita; desmarcar Serra dupla grava `recipes: ["saw","size","elasticity"]`. Sem erros.

## Not verified
- Jogando com teclado/controle reais e dois jogadores; navegação do menu com controle físico (só `MenuPad` simulado no teste unitário).
- Sensação da Serra dupla: no jogo real ela vive na faixa acima da tensão e o cabo arrebenta em ~0,5 s (ver status.md). Tamanho no jogo (só o valor de `sizeScale` e o teste).
- Sons novos (`forgeBuy`, `forgeHammer`) não foram ouvidos.
- Modo split (F6) durante a cinemática; trailer; build empacotado.
- No `demo_campaign.json` o cabo arrebenta no primeiro frame porque os jogadores nascem ~470 px afastados. O código de spawn não mudou nesta fatia; tentei comparar com a `main` num worktree temporário, mas o Electron travou e não confirmei.
