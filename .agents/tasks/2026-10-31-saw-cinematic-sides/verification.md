# Verification — saw cinematic sides

## Automated
- [x] `npm test -- saw_cinematic`: 18/18 asserts (três marteladas, shake crescente, salto, squash, sem `glow`, caminhada antes das marteladas, um de cada lado, simétricos, viram para a bigorna, ninguém atravessa a base, `autoMove` limpo no fim, serra termina no meio dos dois).
- [x] `npm run check`: falha só em itens fora desta tarefa: #4 (`corridor_vertical_ns_1.json` fora do index), #5 (`test_modular_grid`), `test_arauto_effects` (falha também no HEAD limpo, testado num worktree) e `test_arauto_das_brasas` (instável: passou 5 de 6 execuções, não importa nada desta mudança).

## Manual (Electron, `_local/verify-saw-cinematic.cjs`, mapa `demo/inicial`, sala 1,1)
- [x] Dupla colocada à esquerda da bigorna (um na frente, um atrás), 20 de sucata, compra da Serra pelo `ForgeSystem`.
- [x] Os dois andam (Azul contorna pela frente da base), chegam em ~1,7 s a x = 1536 / 1664 (bigorna em 1600), viram para a bigorna (R / L).
- [x] Marteladas depois da chegada; a serra salta, pousa e desce até o meio dos dois (1600, 1720); sem círculo de brilho nos quadros capturados.
- [x] No fim: `hasSaw` e `connected` = true, `reconnectTimer` 29 (pulo da primeira conexão rodando), distância 128 px. Sem erros no console.

## Not verified
- Sensação de ritmo com jogadores de verdade (os passos foram chamados por script com `game._step`, sem o loop real nem som ouvido).
- Bigorna da sala 2,1 (também vende a Serra) e bigornas perto de parede: a rota e a colisão foram testadas só na 1,1.
- A serra no ar continua sob a escuridão (limite antigo da cinemática).
