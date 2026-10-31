# Trailer — mapa de cenas e assets (notas para edições pontuais)

Levantamento de como o trailer de abertura funciona, para fazermos edições
cirúrgicas depois. Nenhum comportamento foi observado em runtime (não abri o
jogo); isto é leitura do código em `js/trailer/` + `js/ui/TrailerOverlay.js` +
`js/main.js` + configs de áudio.

## Como o trailer entra no boot

`js/main.js` → `bootstrap()`:
- `skipTrailer` = `?skipTrailer` na URL **ou** `?playtest=true`. Se ligado, pula
  direto pro jogo (sem `TrailerPlayer`).
- Query params que afetam o trailer: `?timer` (HUD de debug de tempo/cena),
  `?mute` (sem áudio).
- Cria `new TrailerPlayer(canvas, assets, {...})` **antes** do `assets.whenReady`
  porque o stage registra imagens próprias no AssetLoader.
- `TrailerOverlay` (botões SKIP/START) é criado depois; `trailer.play()` começa.
- `startGame()` (SKIP, START ou A/Start no controle) → `trailer.finish()` (recolhe
  as barras) → `trailer.stop()` → carrega mapa da demo e cria o `Game`.

## Orquestrador: `js/trailer/TrailerPlayer.js`

- Mantém a **lista fixa de cenas** `SCENES` (ordem = ordem de execução) e um
  mapa `SCENE_MOOD` (filtro/volume do áudio por cena: `[db, lowpassHz, segundos]`).
- Loop: `_tick` → `update(dt)` roda `current.update`, troca de cena quando
  `current.isDone`, aplica `cutIn` (corte 'impact' = flash+whoosh+duck, 'dry' =
  sem whoosh, senão whoosh padrão), toca áudio, expressões, fala, blood screen.
- Fim do trailer: última cena expõe `reachedEnd` → chama `onEnd` (mostra START).
- Pausa (`Esc`/Start): cria `PauseScreen` com `rootId: 'trailer-pause'`.
- `_drawGate`: tela "CLICK OR PRESS ANY BUTTON (sound on)" que destrava o
  AudioContext antes de começar (gesto do usuário).
- Timer de debug: `_drawTimer` imprime `tempo · cena N NomeDaCena +tempoDaCena`.

### Para editar a ORDEM/SELEÇÃO de cenas
Mexer no array `SCENES` e no objeto `SCENE_MOOD` (ambos no topo do arquivo). O
nome da chave em `SCENE_MOOD` é `Scene.constructor.name`.

## Stage compartilhado: `js/trailer/TrailerStage.js`

Estado comum a quase todas as cenas (injetado via `new Scene(stage)`):
- `renderer` (Renderer do jogo), `p1`/`p2` (`Player` reais) + expressões
  (`TRAILER_EXPRESSIONS`), `saw` (`SawWeapon`), `bars` (`CinematicBars`,
  letterbox), `bloodScreen`, `logo` (`assets/keyart/logo.png`).
- Helpers de câmera (`_camTo`, `_zoomFit`, `portraitClampY`), fog (`drawFogOn`),
  fala (`_speak`/`tickSpeech`/`drawSpeech`), logo (`drawTitleLogo`, inclui versão
  vermelha `_redLogo`), glow da serra.
- `portrait` muda layout (retrato vs paisagem) — toda cena trata os dois.
- Expressões carregadas de `assets/player_01/expressions/<nome>.png` e
  `assets/player_02/expressions/<nome>.png`. Lista de expressões:
  neutro, assustado, espantado, raiva, furia, preocupado, desconfiado,
  olhando_esquerda, olhando_direita, olhando_cima, olhos_fechados.

## Kits de cena de ação

- `kit/ActionArena.js` (28k) — mini-engine de arena: players tethered, serra,
  inimigos, holes, câmera (`focus`/`snapCamera`/`setCam`), slowmo, lunge, hop,
  swerve, arrows, kills. É a base das cenas de "rush"/montagem.
- `kit/ArenaShot.js` — classe base fina: cria uma `ActionArena`, `duration`,
  `cutIn='impact'`, chama `setup(A)`. `isDone` por tempo (`duration`).
- `kit/rushKit.js` — `RushShot` (ArenaShot com ambient/vignette default),
  `handheld(t)` (tremor de câmera "na mão") e `dressRoom(A, opts)` (props,
  entulho, estandartes, poças de sangue, velas — índices de tile em CRATES/
  RUBBLE/LOOT).
- `kit/SeamlessTileset.js`, `kit/arenaRender.js` — render do tileset/arena.

## As 12 cenas (em ordem) — o que cada uma faz e onde mexer

Índice e nome batem com o `SCENES`/timer.

0. **IntroScene** (`scenes/IntroScene.js`, ~26k) — abertura narrativa. Sala
   autoral com tochas/props, 2 players entram pela porta S, a serra cai, eles
   pegam, conversam ("Look how sharp this saw is…" / "Totally. It cuts through
   anything!"), close-ups de raiva, tremor, saída. **Sequência por "beats"**
   (`_buildBeats`, cada beat tem `dur`/`enter`/`update`). Falas em `_speak`.
   Layout em `_layout`. Decoração em `_decorateRoom`.

1. **TitleBloodScene** (`scenes/TitleBloodScene.js`, curta) — logo pisca,
   spray de sangue cobre a tela e escorre. Tempos em `TITLE_TIMING`
   (flickerStart/sprayStart/sprayFull/drainStart). Usa `stage.bloodScreen`.

2. **FrenzyScene** (`scenes/frenzy/FrenzyScene.js`, ~24k) — arena fechada 22x13,
   combate real (CombatSystem/SpawnSystem/gibs/sangue). Dirigida por **beats**
   em `scenes/frenzy/FrenzyBeats.js` + `HordeDirector.js`. Sala/tochas em
   `_decorate`. Constantes no topo: `COLS/ROWS`, `ROPE_LEN`, `CAM_CLOSE`.

3. **ZigZagShot** (`scenes/montage/ZigZagShot.js`) — montagem: dupla sobe em
   zigue-zague (seno) cortando inimigos. Parâmetros no topo: `SPEED/AMP/WAVE/HALF`.

4. **SnapShot** (`scenes/montage/SnapShot.js`) — o cabo estica, arremessa os
   players na parede, eles se reconectam e avançam. Fases: run→split→thrown→
   look→dash→connected. Câmera por fase em `_camera`.

5. **SplitShot** (`scenes/montage/SplitShot.js`) — tela dividida (duas arenas
   `left`/`right`): uma com holes/zigue-zague, outra desviando de flechas. Barra
   divisória desenhada no `render`. `ROWS` no topo.

6. **MapGenScene** (`scenes/mapgen/MapGenScene.js`, ~30k) — "mapa se montando":
   salas/corredores aparecem em ondas e a câmera mergulha numa sala. Tempos em
   `POPS` (ondas por nível), `DIVE_AT`/`DIVE_DUR`. Layout procedural em
   `scenes/mapgen/mapLayout.js`; bake de tiles em `mapBake.js`. `SEED` no topo.

7. **ArrowRunShot** (`scenes/rush/ArrowRunShot.js`) — corrida horizontal
   esquivando de chuva de flechas; termina num "wipe" de flechas (`fx/ArrowWipe`).
   `SPEED/DIVE/WIPE_AT` no topo.

8. **HoleRunShot** (`scenes/rush/HoleRunShot.js`) — corrida vertical pulando
   buracos (`GAPS`), inimigos nas laterais. `COLS/ROWS/SPEED/AMP/WAVE/GAPS/BRIDGE`.

9. **ButtonDoorShot** (`scenes/rush/ButtonDoorShot.js`) — dupla pisa em dois
   botões (`PressureButton`), portas abrem, horda entra, uma serra solta
   (`freeSaw`) varre tudo. Fases run→pressed→saw→clear. `SAW_SPEED` no topo.

10. **GiantSawShot** (`scenes/rush/GiantSawShot.js`) — encurralados, esticam o
    cabo e a serra **cresce gigante** limpando a arena; termina com zoom na serra.
    Fases flee→wall→trapped→stretch→grow→zoom. `BIG`/`GROW_DUR`/`ZOOM_DUR`.

11. **ArautoBossShot** (`scenes/rush/ArautoBossShot.js`) — luta contra o **Arauto
    das Brasas** (sprite `flameGolem`, 6×), chefe corpo a corpo: salta em cima da
    dupla, dá socos; a dupla desvia e corta com dash (`ActionArena.dash`), 6 cortes;
    no final soltam a serra, dão dash nela e ela voa até o peito (`_dropSaw` →
    `_tackle` → `_launch`) → racha → explosão → jogadores sobem → título
    (`reachedEnd` dispara o START). Sala 72x14. Coreografia na lista `this.events`
    em `setup` (tempo da arena); câmera por "planos" em `_camera` (`_shot.type`:
    intro/boss/cut/swing/leap/player/final/saw/tackle/launch). Constantes no topo:
    `BS`, `LANE_UP/LANE_DN`, `ROPE`, `LAUNCH_SPEED`, `SWING`, `FREEZE_AT`/`TITLE_AT`.
    É a cena final. (Substituiu o `BossWallShot.js`.)

## FX do trailer: `js/trailer/fx/`
- `ArrowWipe.js` — transição de flechas (usada no fim de ArrowRunShot).
- `BloodScreen.js` — spray/flood/drain de sangue (TitleBloodScene).
- `FxParticles.js` — partículas de explosão/embers (BossWallShot).
- `LensSplatter.js` — respingo "na lente" em mortes de perto.
- `SawIris.js` — íris em formato de serra (abertura de BossWallShot).

## Áudio do trailer

- Runtime próprio: `js/trailer/audio/TrailerAudio.js` (WebAudio, compressor,
  mood/duck/excite, slowmo, panning). Catálogo em `SOUNDS`/`LOOPS` no topo.
- Música: `assets/audio/music/megasong.mp3` (loop `music`).
- SFX exclusivos do trailer: `assets/audio/trailer/*.wav` (whoosh, impact, boom,
  splat, flame, pop, blip, thunk, zap, rope, riser, sting, beam-charge/fire,
  roar, stone-click/grind, thud, crack, slowmo, heartbeat, rumble-loop).
- Alguns sons do jogo também viram placeholders a partir do trailer — ver
  `js/config/AudioConfig.js` (ghostfire*, scrapPickup, chestOpen, voiceBlip usam
  `assets/audio/trailer/...`). Cuidado ao mexer nesses arquivos: afeta o jogo.

## Assets usados pelo trailer
- `assets/keyart/logo.png` — logo do título.
- `assets/player_01/expressions/*.png`, `assets/player_02/expressions/*.png`.
- Tileset do jogo (via `assets.tileset`), serra/cabo (`assets.saw`/`assets.cable`),
  botão (`assets.button`), sprites de tocha, `assets/fx/explosion.png`.
- Boss: sprite `ghostfire` (`assets/enemies/ghostfire.png`).

## Resumo de "onde mexer" por tipo de edição
- Ordem/quais cenas aparecem → `TrailerPlayer.js` (`SCENES`, `SCENE_MOOD`).
- Duração/tempo de uma cena → `duration` no construtor da cena (ArenaShot) ou os
  `dur`/`T`/`TIMING`/`POPS` dentro do arquivo da cena.
- Diálogo da intro → `IntroScene._buildBeats` (`_speak(...)`).
- Coreografia/câmera de uma cena → `setup(A)`/`script`/`_camera` da própria cena.
- Mood/áudio por cena → `SCENE_MOOD` + chamadas `audio.*` dentro da cena.
- Decoração das salas de ação → `dressRoom(...)` em `rushKit.js` + opts na cena.
- Boss da cena final → `ArautoBossShot.js` + sprite `flameGolem`
  (`js/config/FlameGolemConfig.js`). Debug: `?scene=N` abre o trailer na cena N.
