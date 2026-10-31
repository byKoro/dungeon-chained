# Verificação — trailer reformulado

## Etapa 1: kit (`js/trailer/kit/fightKit.js`)
- Kit: `HIT_TIERS` + `bite()` (mordida por nível), `knock()`, `hold()`/`stepHold()` (espera viva),
  `ActionQueue`, `ShotCamera` (plano atual, `until`, tranco, tremida de mão, retrato, foco).
- Arauto passou a usar o kit (câmera, tranco, fila, espera, arremesso). Electron
  (`_local/verify-arauto-trailer.cjs`, 4 execuções): `reachedEnd true`, 0 erros; maior sequência
  de disco parado no corpo fora de mordida = 7–9 passos (antes 7–8).
- Achado no caminho: numa execução apareceu 31 passos parados — o boss andava para dentro do
  cabo enquanto a dupla esperava. Corrigido: ele para antes de entrar no cabo, e o contato
  empurra os pontos de espera para fora.

## Etapa 2, cena 1: Intro (serra cai na bigorna)
- `IntroScene.js`: bigorna (PropSprites, `anvil`) no centro, y-sort com os jogadores; a serra
  cai e crava no tampo (faísca, flash, poeira, clangor, luz quente), gira presa raspando o
  tampo e salta em arco para o meio dos dois. Tempos encurtados: 13,2 s (era ~21 s).
- Electron (`npx electron _local/verify-trailer-scene.cjs 0 24`): cena termina em 13,2 s,
  0 erros, 32 capturas em `_local/verify-scene-0/`.
- Não conferido: áudio e ritmo em tempo real; retrato.
