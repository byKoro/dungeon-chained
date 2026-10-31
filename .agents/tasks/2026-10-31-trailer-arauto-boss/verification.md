# Verificação — Trailer cena 11 Arauto das Brasas

## Comandos rodados
- `node --check js/trailer/scenes/rush/ArautoBossShot.js` → OK (sintaxe válida).
- `npm test` → 61/63 arquivos passam. Falhas:
  - `test_modular_grid.js` — conhecida pré-existente (status.md #5, Curva SE).
  - `test_arauto_effects.js` — **pré-existente nesta branch**, não causada por esta
    task. Confirmado com `git stash push -- js/trailer js/main.js` + rerun: falha
    igual sem as minhas mudanças. A asserção (linha 43) espera
    `FLAME_GOLEM.telegraph.showMarks === false`, mas o config está `true` na
    `feat/cage-visual-editor`. Fora do escopo desta task.
- `npm run check` → `CHECK FAILED (2 step(s))`:
  - tests: as falhas conhecidas acima.
  - map: único ERROR é `corridor_vertical_ns_1.json` não listado em `index.json`
    (status.md #4, pré-existente).
  - docs drift: OK (46 code / 11 docs). graph: rebuild OK.

Conclusão: nenhuma falha nova introduzida. `test_ghostfire`, `test_player_dash`,
`test_saw_*`, `test_cinematic_bars` continuam verdes (não quebrei o Ghostfire do
jogo nem o final do trailer).

## Checado por leitura/estática
- Construtor `FlameGolemEnemy(x, y, sheet, sprite, floor)` e métodos usados
  (`setNavigationFloor`, `_applyPhaseStats`, `forceAttack`, `update`, `draw`,
  `drawShadow`, `drawAttackEffect`, `lightInfo`, `emitEmbers`) existem.
- `onDrawOver` roda dentro do `worldTf` (arenaRender) e `onLights` recebe
  `(pp, ws, pix)` — compatível com o uso na cena.
- `TrailerPlayer` aponta pra `ArautoBossShot` (import + `SCENES` + `SCENE_MOOD`).
  `BossWallShot.js` removido; nenhum outro import o referenciava.
- `?scene=N` em `js/main.js` → `trailer.play(N)`; `play(from)` já faz clamp.

## NÃO verificado (preciso de smoke no navegador)
Não abro o runtime. Precisa conferir em `http://localhost:8000/?scene=11`
(via `python serve.py`):
- A coreografia inteira (entrada/slam, passadas de corte, dodge, pico, golpe final).
- O pico: a `FlameGolemEnemy` real casando com a câmera coreografada (risco
  sinalizado no plano; se ficar esquisito, troco por um dash encenado).
- Visual do sprite do Arauto (crop/escala/âncora dos pés) e as explosões de brasa.
- Áudio (slam/dash/impacto; sting/heartbeat no final).
- Retrato (afinei paisagem primeiro).

## 2ª iteração (pedido do usuário: boss corpo a corpo, mais energia, sem serra gigante)
Mudanças: raios/brilho de rachadura só no golpe final; boss 6× (+20%); socos e salto em cima
da dupla; jogadores usam dash de verdade (`ActionArena.dash`) e acertam 7 vezes; câmera respira
(zoom vai e volta), chicoteia nos cortes, abre no salto, fecha no soco e no final. Removidos
`SAW_BIG` e o pico com a `FlameGolemEnemy` real.

- `node --check` nos três arquivos alterados: OK.
- `npm test`: 61/63, mesmas falhas pré-existentes (`test_arauto_effects`, `test_modular_grid`).
- Electron (`npx electron _local/verify-arauto-trailer.cjs`, servidor `python serve.py`):
  `/?scene=11&mute`, loop parado e avançado à mão; 48 capturas em `_local/verify-arauto-trailer/`.
  Chega no título (`reachedEnd true`), 0 erros no console. Conferi nas capturas: entrada,
  rugido, cortes com rastro de dash e flash branco no boss, salto (boss visível por cima da
  parede), soco, raios só no golpe final, explosão e título.
- Corrigido durante a verificação: boss sumia no ar (cortado pelo recorte da sala); quadro do
  rugido/salto lia `raisedFrame` de um lugar que não tem esse campo; câmera do salto abria demais.
- Não conferido: retrato, áudio e o ritmo em tempo real (capturas são quadros parados).

## 3ª iteração (corda curta, câmera próxima, serra lançada no final)
- Corda 420 → 250; faixas -170/+50; giros com raio 120. Medido no Electron: distância máxima
  entre os jogadores = 250 (era até 420).
- Contato contínuo (`_stepGrind`): disco dentro do corpo sem corte armado agora raspa.
  Medido: 17 amostras com o disco sobre o boss, 15 com flash visível (as outras 2 caem entre
  dois toques de raspagem, a cada 4 passos).
- Câmera reescrita em planos próximos. Zoom médio na luta 1,70 (era ~1,0); close no rugido
  (até 2,7), no soco (2,3), perseguição do disco nos cortes, close na serra caída (2,4) e no
  peito rachando (até 2,6).
- Golpe final: `A.snap()` → close na serra no chão → dash duplo nela → quadro de impacto →
  serra voa (`freeSaw`) com rastro → crava no peito → rachaduras → morte → título.
- Electron: `reachedEnd true`, 0 erros no console. `npm test` 61/63 (mesmas falhas antigas).
- Corrigido no caminho: um replace pelo PowerShell estragou os acentos do arquivo (lido como
  ANSI); revertido convertendo de volta e reescrito em UTF-8 com LF.
- Não conferido: retrato, áudio e ritmo em tempo real.

## 4ª iteração (mais frenesi, serra cortando de verdade, movimento natural, separação)
- Serra parada em cima do boss: a causa principal eram os giros em volta dele (o meio do cabo
  fica no centro do giro). Removidos. Cada corte agora "morde": no instante em que o disco
  entra no corpo, a dupla trava 5 passos (`dashFreeze`) com chuva de faísca, lava, pedaços de
  pedra, flash branco, achatamento do boss e tranco forte de câmera; depois o dash termina e o
  disco sai pelo outro lado. Medido no Electron, passo a passo: maior sequência com o disco
  dentro do corpo fora de uma mordida = 8 passos (0,13 s), que é o disco saindo em movimento.
- Jogadores atacados: o soco acerta o vermelho e depois o azul e os arremessa (`fly`); o
  salto cai entre eles, o cabo arrebenta e cada um voa para um lado; um soco é desviado com dash.
- Separação: sem cabo, distância chega a ~400; a serra sai deslizando, eles correm até ela por
  lados opostos e religam (`A.reconnect`).
- Menos robótico: dash em arco e com freio (`ActionArena.dash(..., { curve })`), um sai alguns
  passos depois do outro (`_later`), espera com passinhos e pulinhos aleatórios em ritmos diferentes.
- Electron: `reachedEnd true`, 0 erros; 7 mordidas capturadas (`BITE-*.png`). `npm test` 61/63.
- Não conferido: retrato, áudio, ritmo em tempo real. O anel azul da reconexão é o visual
  padrão de `A.reconnect()` (também usado no SnapShot); não foi alterado.
