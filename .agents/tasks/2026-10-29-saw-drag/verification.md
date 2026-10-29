# Verification — saw drag

## Automated
- `npm test`: 28/29 arquivos; só falha `test_modular_grid.js` (antigo, status.md #5). Novo `test_saw_drag.js` (18): toque não pega, segurar pega, velocidade 40%, soltar larga, limite de 2 tiles, sem giro, precisa soltar para pegar de novo, Peso 2 (4 tiles, 70%), obstáculo, parceiro reconecta, sem arrasto conectado/arremessado. `test_forge_menu.js` ajustado para as cinco receitas.

## No jogo (Electron + `python serve.py`, `_local/verify-drag.cjs`, não versionado)
Mapa `inicial.json` pelo teste do Editor 2.0 com "Serra no início" = com serra. Teclas reais via `sendInputEvent`. Console sem erros.
- Separar a dupla arrebenta o cabo; perto da serra aparece a dica de arrastar.
- Segurando E: P1 preso à serra, escala de velocidade 0,4. Segurando E + D por 2,2 s: a serra veio atrás e o cabo curto arrebentou com 129 px de arrasto (2 tiles); giro da serra 0.
- Segurando E e trazendo P2 para perto da serra: o cabo reconectou e o arrasto acabou.
- Captura: serra logo atrás do P1 enquanto ele anda.

## Not verified
- Controle e teclado reais, dois jogadores; sensação da velocidade e da distância.
- O cabo curto quase não aparece (46 px, por baixo dos sprites); arte provisória.
- Compra do Peso pelo menu no jogo (só no teste unitário).
