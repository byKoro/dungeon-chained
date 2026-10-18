---
inclusion: fileMatch
fileMatchPattern: '{js/trailer/**,js/trailer.js,trailer.html}'
---

# Trailer do Dungeon Chained — contexto

Trailer "simulador de gameplay" renderizado em tempo real no canvas, usando as
mesmas classes do jogo (Renderer, Player, SawWeapon, partículas, PostProcessor,
combate). Não é vídeo: é código roteirizado. Tudo em `js/trailer/`.

## Onde roda

- `index.html` + `js/main.js`: abertura do jogo (itch.io). Carrega assets do jogo
  e do trailer juntos, toca o trailer no `#gameCanvas`, mostra `PULAR ▶` após
  1.2s (Esc também pula) e `COMEÇAR` quando o trailer chega ao fim (Enter/Espaço).
  Ao começar: `trailer.stop()` e o `Game` assume o mesmo canvas e o mesmo
  `AssetLoader`.
  - `?skipTrailer` ou `?playtest=true` vão direto pro jogo.
  - `?timer` mostra o cronômetro discreto (`12.4s · cena 3 ZigZagShot +1.2s`).
- `trailer.html` + `js/trailer.js`: página de edição. `?cena=N` começa na cena N,
  botão `↻ REPETIR CENA`/Espaço/Enter repete, `window.trailer` exposto no
  console. Não passa `showTimer` (o cronômetro só existe via `index.html?timer`).
  - Índices de `?cena=N` vão de 0 a 6 (listados no topo de `trailer.js`).
- CSS do overlay: `css/style.css` (`body.trailer-mode`, `#trailer-overlay`,
  `.tr-skip`, `.tr-start`).

Importante: crie o `TrailerPlayer` ANTES de `assets.whenReady()` — o stage
registra no loader as folhas de expressão.

## Arquitetura

```
js/trailer/
  TrailerPlayer.js      sequência de cenas, loop rAF, corte de impacto, letterbox, timer
  TrailerStage.js       palco compartilhado (canvas, renderer, p1/p2, serra, BloodScreen, helpers)
  anim.js               clamp01, lerp, easeInOut/easeOut/easeIn, hash01
  fx/BloodScreen.js     sangue em TELA (spray -> flood -> drain), pixel grosso
  fx/LensSplatter.js    respingos translúcidos "na lente" a cada abate
  kit/ActionArena.js    "set de filmagem" com canvas próprio (sim 60 Hz, câmera drone)
  kit/arenaRender.js    desenho da arena (rotação do drone, luzes, serra por cima)
  kit/ArenaShot.js      base das cenas de montagem (1 arena em tela cheia, duração fixa)
  kit/SeamlessTileset.js tileset sem frestas entre tiles (usado por stage e arenas)
  scenes/IntroScene.js
  scenes/TitleBloodScene.js
  scenes/frenzy/FrenzyScene.js + FrenzyBeats.js + HordeDirector.js
  scenes/montage/ZigZagShot.js, SnapShot.js, SplitShot.js
  scenes/mapgen/MapGenScene.js + mapLayout.js + mapBake.js
  kit/rushKit.js        RushShot (base), dressRoom (cenografia), handheld (tremido do drone)
  fx/ArrowWipe.js       cortina de flechas em tela (transição via stage.overlay)
  scenes/rush/ArrowRunShot.js, HoleRunShot.js, ButtonDoorShot.js, GiantSawShot.js
```

### Contrato de cena (TrailerPlayer)

Cada cena: `constructor(stage)`, `start()`, `update(dt)`, `render()`, `isDone`,
opcionais `reset()`, `reachedEnd`, `cutIn = 'impact'`.

- Sem `cutIn`: a próxima cena começa no mesmo quadro (transição contínua).
- `cutIn = 'impact'`: corte seco com ~0.06s de imagem invertida (`difference`)
  + clarão branco até 0.22s.
- `onEnd` dispara uma vez quando a ÚLTIMA cena tem `reachedEnd`. A última cena
  nunca termina (`isDone = false`), segue em loop por baixo do botão COMEÇAR.
- `dt` limitado a 0.05s. Ordem do render: cena → BloodScreen → impacto →
  letterbox (10% em cima/embaixo) → timer.
- Para adicionar cena: criar em `scenes/`, importar no `TrailerPlayer.js` e
  inserir em `SCENES`.

### TrailerStage (host compartilhado)

- `p1` = VERMELHO (`redPlayer`), `p2` = AZUL (`bluePlayer`), criados com
  `playerConfigs(assets)` do jogo. `saw` = `SawWeapon`.
- Expressões (`TRAILER_EXPRESSIONS`): `neutro, assustado, espantado, raiva,
  furia, preocupado, desconfiado, olhando_esquerda, olhando_direita,
  olhando_cima, olhos_fechados`. Arquivos em
  `assets/player_0X/expressions/<nome>.png`, gerados por
  `tools/gen_expressions.py` (repinta olhos/sobrancelhas da `player_walk.png`,
  8 frames de 100x100). `Player.expression` escolhe a folha (null = normal).
- Helpers: `_express(p, n)` (permanente, vira base), `_expressFor(p, n, s)`
  (temporária, volta à base), `_bothExpressFor`, `_tickExpressions`.
- Câmera: `_zoomFit()` = zoom de referência (sala padrão cabe na tela; cenas
  usam múltiplos dele), `_camTo(x, y, zoom, k)` interpola sem clamp.
- Efeitos: `_drawSawGlow` (azul-aço aditivo), névoa (`tickFog`, `_drawFog`,
  `drawFogOn(ctx,w,h,ph)` para outros canvas), `drawLetterbox`,
  `drawTitleText(red, alpha)` ("DUNGEON CHAINED" / "acorrentados no calabouço").
- Fala: `_speak(who, text, dur)` + `drawSpeech()` — balão de pedra pixel art
  (`ui/SpeechBubble.js`), máquina de escrever ~40 chars/s, pixel = 0.5× o do jogo.
- `resetActors()` limpa atores/serra/sangue/shake/zoom ao (re)começar.

## Roteiro atual (ordem de `SCENES`)

| # | Cena | Duração | Entrada |
|---|------|---------|---------|
| 0 | IntroScene | ~21.4s (soma dos beats) | — |
| 1 | TitleBloodScene | 5.0s | contínua (cartela já no fim da intro) |
| 2 | FrenzyScene | variável (corta 0.3s após o 1º abate da investida) | contínua (revelada pelo sangue escorrendo) |
| 3 | ZigZagShot | 3.4s | impacto |
| 4 | SnapShot | até 11s (termina ~0.7s após cruzar a horda) | impacto |
| 5 | SplitShot | 6.4s | impacto |
| 6 | MapGenScene | 14.15s (termina no mergulho) | impacto |
| 7 | ArrowRunShot | até a cortina de flechas cobrir (~5.1s) | contínua (clarão do mergulho via overlay) |
| 8 | HoleRunShot | 4.0s | contínua (revelada pela cortina) |
| 9 | ButtonDoorShot | ~6.1s (0.25s após a serra pousar) | impacto |
| 10 | GiantSawShot | infinita; `reachedEnd` ~8.5s → COMEÇAR | impacto |

### 0 — IntroScene (sala padrão, porta S, iluminação sombria)

Ambiente `30,26,40`, vinheta 0.8, `SPOT_DIM = 0.6`, tochas e props fixos, vento.
Beats `{ dur, enter?, update(k) }`, k = 0..1:

1. (2.6s) Câmera bem perto da porta (`fit×2.0→1.7`); os dois entram.
2. (2.0s) Serra NASCE no centro (`saw.drop`, clarão, shake 10); espanto.
3. (2.8s) Andam até a serra, ela desliza até o meio deles, PEGAM
   (`saw.pickup`, corda aparece em 0.45s com pulso de luz), zoom até `fit×2.8`.
4. (2.6s) Vermelho: "Olha como essa serra é afiada…"
5. (2.4s) Azul: "Com certeza. Corta qualquer coisa!"
6. (1.6s) Close (`fit×5`) no vermelho: `desconfiado → raiva`.
7. (1.6s) Close no azul: `olhos_fechados → furia`.
8. (2.2s) Sala TREME (`worldQuake` desloca o mundo + shake 22); espanto.
9. (3.6s) Recuam devagar pela porta; fade para preto a partir de 55%; no fim
   desenha o título (vira o primeiro quadro da cena 1).

Serra/disco desenhados DEPOIS da luz e da névoa (destaque) usando o transform
do mundo salvo no quadro (`_worldTf`).

### 1 — TitleBloodScene

`TITLE_TIMING`: `flickerStart 2.0`, `sprayStart 2.6`, `sprayFull 4.6`,
`drainStart 5.0`. Cartela pisca vermelho (estroboscópio `hash01`), título treme,
`BloodScreen` borrifa gotas grandes até cobrir, `flood()`, e no `startDrain()`
a cena acaba. O drain é atualizado pelo `TrailerPlayer` por cima da próxima cena.

### 2 — FrenzyScene (arena 22×13, 4 portas, horda pela porta LESTE)

Usa o renderer/canvas do stage e os `p1/p2` do stage. Sim em passos fixos de
60 Hz com câmera lenta (`_slowmo(secs, scale)`, rampa suave). Jogadores com
"piloto" desengonçado (`goal` de velocidade ou destino, `accel` baixo, `wobble`,
`stumble`, `hopZ` falso, `shiver`, `tiltKick`). Corda: `ROPE_LEN 230` com tranco
elástico (`onYank`), trombada `BUMP_DIST 34` (`onBump`). Inimigos miram proxies
sem dano (`targets`); com `aimRope` miram o meio da corda.

Beats em `FrenzyBeats.js` (`{ max, until?, enter, update(t), cam, onKill?,
onYank?, onBump? }`; `S._stage(t, [[tempo, fn], ...])` dispara uma vez):

0. CORRERIA para a esquerda olhando para trás; azul tropeça; demônio solitário
   (`lone`) é cortado sem querer → slowmo 0.22.
1. CHOQUE: olham os pedaços, se olham, tremem.
2. PORTA: rugido, brilho infernal na porta (`doorGlow`), horda de 16 (`HORDE`)
   entra escalonada.
3. DESESPERO: correm em voltas aleatórias fugindo da horda e das paredes; corda
   dá tranco; caretas de pânico a cada 0.42s.
4. ESBARRÃO: correm um contra o outro, trombam, vermelho fica com raiva.
5. A HORDA VEM: avança em bloco (`advance`, holdDist 340); eles recuam.
6. DECISÃO: se olham, raiva, formam linha (±85px em Y), horda segura a 360.
7. INVESTIDA em linha reta (`rush`): no 1º abate, slowmo e `_cutAt` → corte
   para a montagem.
8. DEPOIS (respiro em loop) — só roda se a investida acabar sem abate.

`HordeDirector`: horda como UM grupo; centro do grupo segue o modo
(`enter | menace | advance | rush | swarm`) e cada membro ocupa um lugar em
girassol (ângulo áureo, achatado 0.72 em Y) com balanço próprio. No corredor da
porta ficam espremidos na faixa do vão. O demônio solitário usa a IA normal do
jogo (`combat.updateEnemies`).

Câmera: `_camFocus` multiplica todo zoom por `CAM_CLOSE = 1.3` (mais perto dos
jogadores), `leanK` é reduzido a 60% e o `fit` usa margem 70/80 com limite
0.5 W / 0.4 H (mantém os dois dentro do quadro fora do letterbox).

Visual: mesmo clima da intro um pouco mais aberto (ambiente `44,36,54`, vinheta
0.72), luz de preenchimento roxa, jogadores quentes ×1.35, serra azul que cresce
com o giro, spot infernal na porta, clarões vermelhos nos abates, gibs que somem
ao sair da TELA, `ScreenGore` + `LensSplatter`, clarão vermelho residual nos
primeiros 0.6s.

### 3–5 — Montagem (ActionArena)

`ActionArena(stage, { cols, rows, doors, seed, ambient, vignette, ropeLen, torches })`:
canvas próprio (permite tela dividida), clones de `p1/p2` (mesmas folhas e
expressões), serra própria, sangue/gibs/partículas/combate do jogo, flechas,
buracos (`setHoles`), névoa, vento, respingos.

- Roteiro: `A.script = (t) => {...}` chamado a cada passo de 60 Hz (t = tempo de
  simulação, respeita slowmo). Callbacks: `onKill, onWallHit, onYank, onBump`.
- Câmera drone: `snapCamera(x, y, zoom, rot)` e `focus({ x, y, zoom, rot, k,
  fit, pad })` — zoom em múltiplos de `zoomRef` (pela ALTURA, igual em tela
  cheia e meia tela) × `camClose` (opção da arena, padrão 1.3 = câmera mais
  colada nos jogadores, aplicado em `focus` e `snapCamera`); `fit` garante
  pontos no quadro considerando a rotação (pad efetivo = pad × 0.65; limite
  0.5 da largura / 0.4 da altura — não aumentar, senão os pontos saem do quadro).
  `ws(x, y)` = mundo→tela com rotação.
- Reações: `expr, exprFor, blink, hop, look, swerve, slowmo, both`.
- Corda: `snap()` (arrebenta, serra cai, faíscas) e `reconnect()` (clarão azul,
  anel de choque, zoom-punch). `connected`/`sawVisible` controlam corda e serra.
- Inimigos: `spawnEnemy(x, y, type, { speed, chase, goal, stopDist, lookAt,
  entering, intro })`, `lunge(e, tx, ty, power)`; flechas `fireArrow(x, y, vx, vy)`.
- Piloto aceita `goal` `{vx,vy,holdX?,holdY?}`, `{x,y,speed}` ou
  `{follow:true,x,y,gain,max}`; `airborne` = arremessado até bater na parede.

`ArenaShot` (base de 3 e 4): arena em tela cheia, `cutIn = 'impact'`, shake 18
no corte, subclasse implementa `setup(A)`.

- 3 ZigZagShot (14×28, porta N, 3.4s): sobem num corredor em zigue-zague
  (`AMP 140`, `WAVE 170`, `SPEED 6.4`) cortando 10 inimigos que dão bote + 5 nos
  flancos; slowmo no 3º e 7º abate; drone girando de −20° a +9°.
- 4 SnapShot (18×11, porta E, ropeLen 190, até 11s): fases
  `run → split → thrown → look → dash → connected`. Demônio dá bote no meio da
  corda, eles pulam para lados opostos, corda ARREBENTA, são arremessados; close
  no vermelho batendo na parede (shake 30); câmera recua mostrando a serra no
  chão; horda de 8 entra; correm até a serra desviando de 2 botes; RECONECTA;
  atravessam a horda cortando. Há "garantias" de tempo para o roteiro não travar.
  Corta 0.3s depois do ÚLTIMO abate da investida (`_chargeKills`, vivos = 0) ou,
  se sobrar inimigo, quando P1 passa de `maxX − 300` — nunca chegam a correr
  contra a parede (~6.8s no total).
- 5 SplitShot (duas arenas, 32 linhas, porta N): tela dividida com divisória de
  pedra. Esquerda: zigue-zague com buracos do lado de fora das curvas e 9
  inimigos. Direita: separados e sem serra, 14 flechas agendadas cruzando à
  frente (freiam + pulam) ou atrás (arrancam). Após 6s param ofegantes;
  corta em 6.4s para a geração de mapas.

### 6 — MapGenScene (geração de mapas)

Não usa ActionArena nem o Renderer: câmera própria (pos/zoom/rotação contínuos,
sem quantização) direto no canvas do stage, PostProcessor próprio.

- `mapLayout.js` (puro, testável no node): `buildDungeon(SEED)` determinístico.
  Grade 15×9 células de 18×13 tiles; níveis por distância ao centro
  (`LEVEL_SPAN`: 1 sala, 3×3, 7×5, 15×9; níveis ≥2 com 84% de chance e sempre
  conectados). Sala centrada na célula (larguras pares, alturas ímpares);
  corredores de 2 tiles nas linhas 5-6 / colunas 8-9 da célula (= faixas do
  meio de qualquer sala). Formatos: `rect, L, cross, T, octagon` (chanfro em
  escada), `pillars` (blocos 2×2), `hall` (chanfro + pilares); as 2 linhas e 2
  colunas centrais ficam sempre inteiras. Temas: `showcase` (sala do centro),
  `plain, spikes, pits, buttons, arrows` (só rect), `treasure, lair`;
  `buttons`/`treasure` (+12% das demais) são trancadas.
- AUTOTILE de parede por vizinhança 8 (`wallTile`): face 2/3 (piso S), tampa
  42/43 (piso N), faixas 10/20/30 e 15/25/35, quinas externas 0/5/40/45,
  internas 50/54 (N+O) e 55/53 (N+L), e COMPOSTAS na quina interna de cima
  (face 2 + faixa do tile 5 ou 0). Parede de 1 tile entre pisos ou beliscão
  diagonal = inválido; `validateDungeon(D)` confere global e cada sala selada
  (manter 0 erros ao mexer em formatos). Buraco conta como piso para paredes.
- `mapBake.js`: cada sala é assada SELADA (sem corredores) em canvas 16 px/tile
  (`base`, `front` = paredes da base por cima dos atores, `flash` = silhueta);
  cada corredor assa a versão GLOBAL das células que ele muda (`cover` = piso
  + 8 vizinhos) e é desenhado por cima das salas. Nada de props/tochas nas
  células `cover`.
- Fim: `DIVE_AT 13.0` + `DIVE_DUR 1.15` — mergulho (zoom acelerando, gira até
  0.32 rad, riscos saindo do centro) na sala retangular de nível 1-2 mais perto
  do centro (`diveRoom`); clarão branco 0.8 que segue como `stage.overlay`
  (`whiteFade`) por cima da cena 7. Luz de tocha só com tile ≥14 px na tela.
- Roteiro (`POPS`): panorâmica da sala do centro até 3.0s; pops em 3.0 / 6.6 /
  10.2 (`POP_DUR 0.8`: antecipa +6%, recua com easeOutBack em escala log,
  riscos de velocidade, shake 16, clarão). Salas do nível nascem escalonadas
  (3×3 em sentido horário; depois ondas por distância), escala com overshoot +
  silhueta branca + luz; contorno tracejado das células some quando a sala
  nasce. Corredor nasce 0.14s depois das duas salas; portas abrem ~0.3s depois
  (salas trancadas ficam fechadas: N 66/67, S 36/37, L 47/57, O 48/58).
- Vivo: `SpikeTrap`, `PressureButton` (apertado pelos pés dos inimigos),
  `ArrowTrap` (flechas cravam na parede oposta), tochas/castiçais animados,
  inimigos vagando (`_wander`: alvo aleatório com caminho livre, pausa, às
  vezes ensaia um golpe). Ambiente escurece de perto e clareia de longe
  (`AMBIENT_DARK → AMBIENT_MAP` pelo tamanho do tile na tela).

### 7–10 — Sequência "desespero" (RushShot)

`RushShot` = `ArenaShot` com `smoothZoom` (zoom contínuo, sem quantizar —
o SeamlessTileset segura as frestas), `camClose 1.0` (zooms das cenas já
colados: ~1.7–2.9 × zoomRef), vinheta 0.88, ambiente `32,22,36`. Cenografia
por `dressRoom(A, {seed, crates, rubble, loot, banners, blood, avoid})`
(props/castiçais só na 1ª vez; sangue velho recarimbado a cada start).
Drone: `handheld(t, amp)` somado a x/y/rot em todo `focus`.

Extensões da ActionArena usadas aqui: `red`/`redHz` (luz vermelha pulsando +
vinheta vermelha), `doorOpen[dir]` 0..1 (porta fechada que abre recolhendo
as folhas; S por cima da parede frontal), `freeSaw {x,y,vx,vy}` (serra solta,
corta sozinha), `sawScale` (serra gigante, desenhada à mão sem o tremor do
jogo, mata todo o disco), `arrowsKill`, flechas com `stopX`/`stuckDur`
(cravam no chão), `killEnemy(e)`, `inHole(x,y)` (inimigos não pisam em
buraco), `setCam` (zoom absoluto p/ mergulhos), ganchos `onDrawFloor/onDrawTop`.
`stage.overlay {update, draw, done}` é desenhado pelo TrailerPlayer por cima
de qualquer cena (atravessa cortes).

- 7 ArrowRunShot (46×11, porta O): continua o mergulho (sala inteira → colado
  em 1.0s), correm para a esquerda, câmera à frente com o lado direito livre;
  flechas de trás cada vez mais densas (5→27/s, 60/s no fim), 42% cravam no
  chão, passa-raspando a cada ~0.5s (pulinho, careta, olhada), 4 demônios
  espetados por flechas. Em `WIPE_AT 3.9` (simulação) cria a `ArrowWipe`
  (cobre em 0.42s, segura 0.12s, revela em 0.5s) e termina quando cobre.
- 8 HoleRunShot (18×30, porta N): ponte em zigue-zague (meia largura 2.7
  tiles) num abismo, beiradas de 2 tiles nas paredes, 2 fendas atravessando a
  ponte (pulam com `hop 6.6`, câmera lenta no 1º salto). Inimigos: 6 nas
  beiradas acompanhando, 5 na ponte à frente (bote), 4 atrás (param na fenda).
- 9 ButtonDoorShot (16×11, portas N e S fechadas, sem serra): cada um corre a
  um botão e pisam juntos (garantia 2.2s) → porta N treme e abre, 10 inimigos
  saem, recuam até a parede de baixo → porta S arrebenta (+2.25s) e a serra
  solta entra, persegue o inimigo mais próximo (16 px/passo) e serra todos;
  depois pousa entre os dois.
- 10 GiantSawShot (20×13, porta L): fogem da horda (15) e esbarram na parede
  O; horda fecha semicírculo (raios 175–259, ±1.25 rad); closes rápidos
  (raiva / fúria); esticam a corda (ropeLen 720, `setStrain` pisca); serra
  cresce até `BIG 8.6` (raio ~275) em 0.85s matando todos (garantia no auge);
  mergulho de 1.7s até o disco encher a tela (1.05 × diagonal). Última cena.

## Convenções e armadilhas

- Transições sempre suaves dentro das cenas: muda-se o OBJETIVO (goal, câmera,
  expressão), nunca se teleporta posição/câmera. Teleporte só em `start()`.
- Sprite olha para a direita por padrão; `look()` decide `olhando_direita` vs
  `olhando_esquerda` considerando o flip (`facingLeft`).
- Serra é sempre redesenhada por último (depois de luz/névoa/respingos) com o
  transform do mundo do quadro, para ficar em destaque e alinhada com o shake.
- Arenas atualizam as expressões dos PRÓPRIOS clones em `update`; o
  `TrailerPlayer` só atualiza as dos `p1/p2` do stage.
- Intro e Frenzy compartilham `stage.renderer`, `stage.p1/p2` e `stage.saw`; as
  arenas têm tudo próprio.
- `FrenzyScene.reachedEnd`/beat 8 só importam se ela voltar a ser a última cena.
- Tempos de beats da Frenzy e das arenas são de SIMULAÇÃO (slowmo estica o
  tempo real).
- Sem frestas entre tiles: o stage e as arenas usam `kit/SeamlessTileset.js`
  (cada tile ~1px de tela maior + origem na folha recuada 0.02 texel). Zoom
  interpolado, tremor da sala e rotação do drone abriam linhas claras de 1px.
  Qualquer novo Renderer do trailer deve usar esse tileset.
- Da cena 2 em diante a câmera deve ficar próxima dos jogadores (mostrar ação e
  reações); preferir aumentar `camClose`/`CAM_CLOSE` a afastar.
- Pedido de ajuste fino: abrir `index.html?timer` e informar
  "cena N, +X.Xs" do cronômetro.
