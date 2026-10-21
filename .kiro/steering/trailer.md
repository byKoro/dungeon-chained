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
  e do trailer juntos, toca o trailer no `#gameCanvas`, mostra `PULAR ▶`
  `SKIP_DELAY_MS` (3s) depois que o trailer COMEÇA de fato (gancho `onBegin`
  do TrailerPlayer; nunca na tela de gesto; só o botão pula; Esc PAUSA) e
  `COMEÇAR` quando o trailer chega ao fim
  (Enter/Espaço, ignorados com o trailer pausado).
  Ao começar: `trailer.stop()` e o `Game` assume o mesmo canvas e o mesmo
  `AssetLoader`.
  - `?skipTrailer` ou `?playtest=true` vão direto pro jogo.
  - `?timer` mostra o cronômetro discreto (`12.4s · cena 3 ZigZagShot +1.2s`).
- `trailer.html` + `js/trailer.js`: página de edição. `?cena=N` começa na cena N,
  botão `↻ REPETIR CENA`/Espaço/Enter repete, `window.trailer` exposto no
  console (também em index.html). `?timer` e `?mute` valem nas duas páginas.
  - Índices de `?cena=N` vão de 0 a 11 (listados no topo de `trailer.js`).
- CSS do overlay: `css/style.css` (`body.trailer-mode`, `#trailer-overlay`,
  `.tr-skip`, `.tr-start`). SKIP (face `gold`) e START (face `red`, pop +
  `pixel-idle` como o RESTART da morte) são `PixelButton` em `main.js`.

Importante: crie o `TrailerPlayer` ANTES de `assets.whenReady()` — o stage
registra no loader as folhas de expressão.

- Vídeo MP4: `node tools/trailer-render/render.mjs [--fps 60] [--from N]
  [--max S] [--hold S] [--out ...]` → `dist/trailer/dungeon-chained-trailer-1080p60.mp4`
  (1920×1080, H.264 crf 14 + AAC 256k; ~12 q/s, ~10 min). Sem deps npm: servidor
  local + Chrome headless via DevTools Protocol + ffmpeg (o do Remotion em
  `pitch/video/node_modules` ou `--ffmpeg`). `tools/trailer-render/record.html`
  troca `performance.now`/rAF por relógio virtual e o `AudioContext` por um
  `OfflineAudioContext` avançado por `suspend/resume` a cada quadro (imagem e
  som sincronizados). Sem gesto/SKIP/START/pausa; no fim, no lugar do START, a
  CTA `js/trailer/fx/ItchCta.js` (placa vermelha "DOWNLOAD NOW" no estilo do
  PixelButton + `imkoro.itch.io/dungeon-chained` na barra de baixo), segura
  `--hold` 6s e escurece imagem e som no último 1s.
- Vídeo vertical (Reels/Shorts): `--vertical` (1080×1920; `--size WxH` muda) →
  `dist/trailer/dungeon-chained-trailer-reels-1080x1920-60fps.mp4`. Prévia
  rápida: `--snap 0.5 --fps 30 --frames [--snapdir DIR]` (snaps + folhas de
  contato `sheet_NN_Cena_P.png` + `index.json`, sem MP4).
  - Retrato = `stage.portrait` (H > W). TODA adaptação fica atrás dele: a
    paisagem não pode mudar.
  - Escala pelo lado curto (`stage.refSize`; `zoomRef`/`_zoomFit` usam ele).
  - Área útil do `fit` em retrato: `fitW 0.45`, `fitH 0.36` e `fitDown 0.30`
    (nada abaixo de 30% do centro em tela cheia: rodapé do Reels).
    `portraitClampY`/`A.clampY` não mostram o vazio acima/abaixo da sala.
  - Por cena: Split divide CIMA/BAIXO; MapGen usa grade retrato 7×15
    (`useGrid('portrait')`); BossWall tem `DIST.portrait` e zoom ×1.2;
    CTA (`ItchCta._drawPortrait`) com logo a ~25% e placa a ~67% da altura.

## Som (js/trailer/audio/TrailerAudio.js)

Web Audio próprio do trailer (não usa o AudioManager do jogo). `stage.audio`
(null com `?mute` ou sem Web Audio). Arquivos: trilha `assets/audio/music/
megasong.mp3` (Megasong, emmama, CC0) e sfx em `assets/audio/trailer/`
(`tools/gen_trailer_sfx.py`) + sons do jogo (serra, passos, flechas...).

- Tela "CLICK OR PRESS ANY KEY" (`TrailerPlayer._showGate/_drawGate`) quando o
  navegador bloqueia o áudio: o trailer só começa depois do gesto (nunca mudo).
  Mostra a logo no centro e o convite em `PixelFont` (escala da logo − 1,
  cache em `_pixelText`); o gesto toca `playUi('uiConfirm')` (mesmo som dos
  botões pixel art; não toca se o gesto foi num botão, que já tem som).
  `stop()` faz `audio.stopAll()` (o jogo assume).
- Volume geral: `core/MasterVolume.js` (0..1, passos de 5%, padrão 0.8,
  localStorage `dungeonChained.masterVolume`, ganho = v²), compartilhado com o
  jogo (AudioManager e fallback do UiSound). No trailer vira o nó `user`
  depois do compressor.
- Pausa (`TrailerPlayer.setPaused/togglePause`, getter `paused`): Esc (main.js
  e trailer.js), START do controle (`_pollPad`: d-pad navega/ajusta, A
  confirma, B retoma) ou trocar de aba (visibilitychange). Não pausa na tela de
  gesto. Usa `ui/PauseScreen.js` com `rootId 'trailer-pause'` (criado na 1ª
  pausa; só RESUME + VOLUME `ui/PixelSlider.js`). `_frame` congela update/
  render; áudio: `pauseGain` → 0 em 0.15s e `ctx.suspend()`; ao retomar,
  `ctx.resume()` e rampa de 0.25s. `_begin`/`stop()` despausam.
- Grafo: música → passa-baixa → humor → duck → master; sfx → passa-baixa da
  câmera lenta → master; leitos (ambiente, rumble) → master; master →
  compressor/limitador. Loops: música, ambiente, rumble, motor da serra, vento.
- Dinâmica: `mood(db, lpHz, s)` por cena (`SCENE_MOOD` no TrailerPlayer) e por
  beat nas cenas; `excite(k)` (abates/impactos sobem a música e abrem o filtro,
  decai ~0.55/s); `duck(db, hold, rel)` nas pancadas grandes; câmera lenta
  (`timeScale`) abafa a música e baixa o tom dos sfx (`noSlow` ignora).
- `tick(dt, estado)` a cada quadro com `TrailerPlayer._audioState()` (câmera,
  tremor, serra, jogadores, câmera lenta; arenas detectadas por `scene.arena`/
  `scene.left`, palco pelo `stage.renderer`); a cena pode sobrescrever com
  `audioState(base)`. Daí saem: vento da câmera (velocidade na TELA: pan +
  zoom + giro), ronco pelo `screenShake` (+ `rumble` extra), motor da serra
  (giro/escala), passos pela distância andada (pan pela tela).
- Ganchos genéricos: `hookRendererAudio(renderer)` — tremor forte (≥16) vira
  pancada/baque, `triggerZoomPunch` vira passagem de ar; `ActionArena.sfx(name,
  x, y, o)` (pan pela tela da arena + `panBias` na tela dividida) já toca em
  abates, gibs, snap/reconnect, spawn com intro, botes, flechas (disparo e
  cravada), parede, tranco da corda, trombada, pouso e `slowmo`.
- `play(name, {vol, rate, pan, jitter, cool, delay, noSlow})`: sorteia o
  arquivo (sem repetir), varia tom/volume, cooldown por nome, teto de 28 vozes.
  Blips de fala em `TrailerStage.tickSpeech` (40 letras/s, tom por personagem);
  gotas do `BloodScreen` via `onSplat`.

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
  fx/SawIris.js         disco da serra abrindo em espiral (transição 10 → 11 via stage.overlay)
  fx/FxParticles.js     brasas, explosões e pedaços de tile (emissivos, mundo ou tela).
                        Explosão = brilho suave aditivo + PIXEL NORMALIZADO (`pixel`):
                        fogo e brasas viram um campo de calor numa camada de baixa
                        resolução na grade fixa de `pixel` px (cena 11: = BS, o pixel
                        do boss), pintado em faixas da paleta do ghostfire e ampliado
                        sem suavizar; bolas sobrepostas se fundem. `fx.rays`
                        [{x,y,ang,len,wid,heat}] = feixes de luz em cunha na mesma
                        grade (eixo claro, borda âmbar; cena 11: rachaduras via
                        `_crackRays`, só um brilho leve por baixo). Reusa a camada se
                        nada andou (câmera lenta/congelado). Sem `pixel`, cai na folha
                        assets/fx/explosion.png (tools/gen_explosion.py)
  scenes/rush/ArrowRunShot.js, HoleRunShot.js, ButtonDoorShot.js, GiantSawShot.js
  scenes/rush/BossWallShot.js  boss parede de fogo (ghostfire) + plano final
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
  `drawTitleLogo(red, alpha, cy)` (logo `assets/keyart/logo.png` de
  `tools/gen_keyart.py`, escala inteira ~50% da largura, versão vermelha acima
  de `red` 0.5 + tremor; usada no fim da intro, na cartela e na tela de
  entrada e no plano final da cena 11).
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
| 10 | GiantSawShot | ~8.2s (termina com o disco enchendo a tela) | impacto |
| 11 | BossWallShot | infinita; `reachedEnd` ~21s reais → COMEÇAR | contínua (SawIris abre o disco) |

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
  mergulho de 1.7s até o disco encher a tela (1.05 × diagonal). `isDone` logo
  depois do mergulho (+0.05s).

### 11 — BossWallShot (boss "parede de fogo", última cena)

Estilo Wall of Flesh. `RushShot` com `cutIn = null`; no `start()` cria
`stage.overlay = SawIris` (o disco da cena 10 gira e abre um buraco em
catavento de 3 braços em 0.8s). Sala 72×14 sem portas, tochas só na parede N;
câmera nunca mostra pontas L/O nem a parede S (`CAM_Y 300`, `FIGHT_ZOOM 1.12`).
Faixa de jogo em Y: `Y_TOP 175 … Y_BOT 520`, meio `Y_MID 345`.

- Boss = `ghostfire` escalado `BS = 21` (px de mundo por px de sprite, ~85% da
  altura da tela). Objeto `this.B` { side 'R'|'L', x, tx (base que avança
  `ADV 0.8`/passo), y (= linha da boca/raio), act, actT, row, frame, alpha,
  stretch, crack }. Âncora na célula: y 42 (linha do raio), x 52.5 nos frames
  0–2 e 39.5 nos frames 3+ da linha 3 (a caveira recua no sprite). Sprite olha
  para a direita: lado R espelha.
- Folha (100×100): linha 1 idle, 2 cuspe (spit), 3 raio (f0–2 carga, f3 aviso
  fino, f4 raio grosso, f5 apagando, f6 recupera), 4 morte, 0 silhueta clara
  (usada nas rachaduras). Raio no f4 = 3 px (linhas 41–43): frame até a coluna
  88, depois o trecho quente 66–88 repetido rolando (`BEAM_FLOW`) até
  `BEAM_EXT 150` e a ponta 89–99 no fim; aviso/apagando = coluna 99 esticada.
  Brilho: nasce dentro da boca (4·BS) e ganha força em ~2 tiles, ~4.5 px de
  sprite de espessura ondulando, mais fraco ao longe (montado coluna a coluna
  numa camada pequena `glowLayer` e ampliado — sem emendas) + clarão pequeno
  na boca. Luzes do chão: 14 achatadas (0.4) a cada 190 px desde a boca,
  pulsando. Pixels do raio (grade BS, calor ≤ `BEAM_HEAT` = sem rosado):
  `_beamSuck` (carga/aviso), `_beamBurst` (disparo), `_beamSparks` (faíscas
  ao longo + crepitar nas bordas), `_beamRemains` (apagando).
- Desenho emissivo via ganchos novos da ActionArena: `A.onDrawOver(ctx)`
  (mundo, depois de luz/névoa/respingos, antes da serra) e
  `A.onLights(pp, ws, pix)`. `killFlashes` aceitam `scale`.
- Linha do tempo `T` (simulação): calma 0–0.8 (brasas da direita, tremor) →
  `slam 0.8` (entra em `SLAM_IN 0.18`s, clarão, shake 42, onda empurra os dois)
  → `roar 1.25` → `spit1 1.8` (5) → `beam1 3.3` → `spit2 4.95` (6) →
  `vanish1 6.3` → `appearL 6.75` → `beam2 7.1` → `spit3 8.75` (5) →
  `beam3 9.95` → `vanish2 11.6` → `appearR 12.05` → `beam4 12.4` (final).
  Raio: `BEAM` carga 0.4 (mira o meio da corda) / aviso 0.42 (trava, os dois
  correm lado a lado 175px fora da linha) / disparo 0.5 (mata minions na linha,
  slowmo) / apaga 0.15 / recupera 0.15.
- Modos dos jogadores: `calm, shock, shock2` (recuam cambaleando), `fight`
  (NUNCA param: o meio da corda segue um Lissajous no tempo global entre
  330 e 900 px da parede, puxado 60% para o minion mais próximo; `_formation`
  põe a corda de través ao movimento, girando suave, ±95), `dodge` (vaivém
  paralelo ao raio, `_dodge`), `charge` (serra
  cresce até `SAW_BIG 2.6`), `impale` (seguram a serra cravada; rachaduras
  0.75s, slowmo), `blown` (morte, linha 4, 14 estouros em cascata pelo quadro).
  Minions (`hellbat`, `demonessA`, `demonessB`) perseguem o meio da corda,
  dão 1 bote e morrem ao encostar no disco (garantia).
- Câmera de luta: troca de "posição de drone" a cada 1.3s (`wide` boss a ~85%
  da largura, `push` aproximando, `dutch` inclinado ±0.14, `dolly` deslizando
  e girando) e reage às ações (`mouth` no cuspe, `beamAim`/`beamFire` no raio,
  `charge` na investida, tranco `_kick` em cada abate, lead pela velocidade).
  Todo plano usa `fit: [p1, p2, frente da caveira]` (o zoom cede para caber).
  Na entrada/sumiço/choque: plano aberto, e no sumiço a câmera já vai para o
  lado onde ele ressurge.
- Plano final em TELA (`_drawLeap`, tempo real `leapLT`): fundo em câmera lenta
  0.12 até congelar em `FREEZE_AT 2.0`; os dois crescem de 10% a 42% da altura
  (frame de passada, `furia`, inclinados para fora), corda desenhada no espaço
  escalado, serra no meio girando; logo em `TITLE_AT 1.9` (sombra no tamanho dela);
  depois do congelamento cada jogador FLUTUA (`FLOAT_AMP` px de arte, fases
  alternadas, em degraus de 1 px de arte; corda e serra acompanham) e o fundo
  dá uma pulsada vermelha leve a cada `PULSE_PERIOD 1.6`s (mais forte nas bordas);
  brasas de tela seguem em loop.

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

## Match cuts do vídeo de apresentação (js/trailer/matchcut/)

Clipes curtos papel -> jogo do `pitch/04-video-apresentacao.md`, tocados pelo
MESMO `TrailerPlayer` com `{ scenes: [Shot], letterbox: false, music: false }`
(o trailer não muda; `TrailerAudio.start({ music })`).

- `layout.json` = fonte da verdade (câmera, pose-base, props, ator de cada
  plano). Lido pelo jogo (`MatchShot.js`, via fetch + top-level await) e por
  `tools/matchcut_layout.py` (folha 4 `tools/gen_boss_room.py`, folha 5
  `tools/gen_matchcut_pieces.py`, conferência `tools/check_matchcut_align.py`).
  Mexeu nele: regerar as folhas e reimprimir.
- Geometria: arena 18×11; a folha A4 paisagem (3508×2480, 351 px/tile) é a
  janela centrada na câmera (576, 352), zoom 3 em 1920 de largura (192 px/tile,
  10 tiles = largura da folha). Canvas fixo 1920×1080.
- `MatchShot` (base): sem impacto/shake no corte, câmera travada (`setCam`),
  `FREEZE 0.5` s congelado (sem `arena.update`) = quadro do papel, depois
  `A.flat` 1 -> 0 em `MOOD_IN 0.4` s (luz ambiente branca -> clima, vinheta,
  e `arenaRender` some com sombras/névoa/vento/brilho da serra enquanto
  `flat > 0`), `TAIL 1` s de sobra. `poseBase` = P1 olhando para a direita,
  P2 espelhado, serra parada.
- Câmera: `camTo({x, y, z, rot, k})` = mola em TEMPO REAL (z = multiplicador
  do zoom do papel; não estica na câmera lenta); `hitstop(secs)` pula o
  `arena.update` por um instante. Arena com `smoothZoom`.
- Planos (`shots.js`, tecla = letra): A `KillShot` (demônio empurrado de cima para baixo ->
  bote -> hit-stop + soco de câmera com giro + faíscas/tranco -> gibs com 2º
  tranco -> fúria, câmera assenta e deriva); B `PullShot` (P2 dispara para a
  direita -> `onYank` da corda: hit-stop + soco de câmera no meio da corda,
  P1 arrancado (hop + impulso) e arrastado -> P2 freia e olha para trás ->
  P1 pousa cambaleando e fecha a cara; câmera segue `A.mid`); C `BreakShot`
  (cabo de guerra: `saw.setStrain` + `setVignetteBreath` + câmera fechando ->
  `A.snap()` com hit-stop, câmera abre com giro, os dois arremessados ->
  pousam, olham a serra e um para o outro -> voltam juntos (`BACK_SPEED 4.6`)
  -> `A.reconnect()` com soco de câmera; garantia 1.9 s após o snap; 4.7 s);
  D `WideShot` (arena com `doors:{N:true}`, fora da janela do papel: andam
  para a esquerda até `SPOT` com a corda em pé enquanto a câmera recua a
  `WIDE` z 0.56 = sala inteira -> 3 pancadas + porta N abre (`doorOpen.N`,
  `red`) -> horda de 12 em girassol achatado no `BLOB`, cada um guarda a sua
  faixa `e._lane` -> investida reta (`CHARGE_V`); na investida a horda anda
  reto para a esquerda NA SUA FAIXA (quem ainda desce converge rápido; faixas
  fora da `PLAYER_SAFE_ZONE` 46 dos dois — o corte é o SEGMENTO p1–p2, não a
  corda curvada) -> freia 0.25 s depois do último abate (ou `BRAKE_X`/garantia
  2.2 s), se viram, câmera assenta; 7 s); E `CardShot` (cartas de
  `pitch/print/cartas/` — PNG = arte 62×82 ampliada 10×, desenhada sem
  suavizar a `shots.E.artPx` px de mundo por px de arte, em `onDrawOver` —
  nas posições de `shots.E.cards`; as de fora saem voando para os lados,
  Arremesso sobe/treme/brilha e vira blocos 2×2 da própria arte que estouram
  e são sugados pela serra -> clarão + brilho vermelho -> câmera recua a
  `WIDE` z 0.56 enquanto demônios nascem em `ENEMY_ARC` (distâncias ao longo
  do caminho; pula os que ficam a < 150 px dos jogadores) -> fúria ->
  `A.freeSaw` com `BOUNCES` 4 reflexões nas paredes (caixa = limites menos o
  raio do disco) -> volta mirando `A.mid` (`HOME_TURN`), `_catch` =
  `saw.drop` + `A.reconnect()` + soco de câmera; garantia `RETURN_GUARANTEE`
  2.75 s de voo; 6.3 s). O roteiro atual do doc 04 tem um único match cut:
  B–E são extras.
- Prévia: `matchcut.html?shot=A` (`?timer`, `?mute`, `?noloop`). MP4:
  `render.mjs --set matchcut --shot A [--mute]` -> `dist/matchcut/`;
  `--still` = PNG do quadro 0; `--snap` também funciona com `--set`.

## Clipes do Bloco 3 do vídeo de apresentação (js/trailer/b3/)

Um clipe por fala do B3 (`pitch/04-video-apresentacao.md`), tocados pelo mesmo
`TrailerPlayer` (sem letterbox, sem música, só SFX, sem HUD). 1920×1080 60 fps.

- `B3Shot` (base, estende `ArenaShot`): `cutIn = 'dry'` (corte seco: o
  TrailerPlayer só toca o whoosh se `cutIn !== 'dry'`), `TAIL` 1 s,
  ambiente `44,36,54`, vinheta 0.72, `camClose 1`, `smoothZoom`. Câmera
  `frame(A, t, {x, y, zoom, k, fit, pad, amp})` = de cima + `handheld` leve
  (sem giro de drone). Mecânica real decide o resultado (`ArenaHazards` em
  `arenaHazards.js` porta `SpikeTrap`/`ArrowTrap`/`PressureButton`; buraco
  com `HOLE_FALL`; dano por `Player.takeDamage`), com garantias de tempo.
  O wrapper de `A.script` decrementa `invulnerableTimer`/`scaredTimer`,
  preenche `moveX/moveY` pela velocidade (> 0.3; o `_assist` do
  PressureButton solta o pé de quem sai) e detecta dano pela queda de
  `lives` → `onHurt` (flash, shake 10, `hitstop 0.05`, `playerHit`).
  `unlockDoors(A)` = feixe amarelo `DOOR_LIGHT` + zoom-punch + `doorOpen`.
  Lower-third só com `?labels` (`this.label`).
- Clipes (`shots.js`, 0..6): `OpenShot` (~2,5 s, tranco da corda + câmera
  revela a sala), `HoleShot` (~5 s, bote do demônio, P2 escorrega, corda
  segura), `SpikeShot` (3,6 s, flecha → P2 pula → P1 arrastado pros
  espinhos), `ButtonShot` (3,6 s, botões co-op → porta N), `LockShot` (4,6 s,
  entra pela W, portas batem em 0.4, 4 inimigos, último com hitstop/slowmo →
  unlock → sai pela E), `MapShot` (~5 s, sala padrão cresce em lobos com
  paleta própria por hue-rotate do `tileset.png`, peças de `map/*.json`,
  clarão → 2ª run; layout em `mapGrow.js`), `CouchShot` (3,2 s, dois
  controles em pixel art nas cores P1 `#ffd166` / P2 `#6bb4db`).
- SFX novos no `TrailerAudio`: `playerHit`, `buttonPress`, `buttonRelease`.
- Prévia: `b3.html?shot=0..6|all` (`?labels`, `?timer`, `?mute`, `?noloop`).
  MP4: `render.mjs --set b3 --shot all|N [--mute]` ->
  `dist/b3/b3-<SHOT>-1920x1080-60fps.mp4`; `--still`, `--snap` valem.
