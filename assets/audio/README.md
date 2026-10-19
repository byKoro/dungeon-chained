# Efeitos sonoros

Os arquivos usados pelo jogo são gravações e efeitos publicados por seus autores; não foram gerados por IA. Os créditos abaixo preservam a origem e a licença informada nas páginas de download.

| Uso no jogo | Arquivos | Fonte e licença |
| --- | --- | --- |
| Dano dos jogadores | `player-hurt-01.wav` a `player-hurt-06.wav` | [Grunts of male death and pain](https://lpc.opengameart.org/content/grunts-male-death-and-pain), thebardofblasphemy, CC0. O autor descreve gravações da própria voz; os seis arquivos são trechos curtos do WAV original. |
| Dano e ataque dos monstros | `monster-hurt-*.ogg`, `monster-attack-*.ogg` | [80 CC0 creature SFX](https://opengameart.org/content/80-cc0-creature-sfx), rubberduck, CC0. O autor informa que fez a maior parte dos efeitos com a própria voz e aplicou filtros. |
| Passos dos jogadores e monstros | `footstep-stone-*.ogg` | [Footsteps](https://opengameart.org/content/footsteps-0), GboxMikeFozzy, CC0. O autor informa que gravou os próprios passos; para os monstros, o jogo toca os mesmos passos mais lentos e graves. |
| Ataque dos monstros | `enemy-attack-*.wav` | [Swishes Sound Pack](https://opengameart.org/content/swishes-sound-pack), artisticdude, CC0. O autor descreve gravações feitas ao balançar objetos físicos diante de uma câmera. |
| Motor da serra (loop) | `saw-motor-loop.wav` | Derivado de `circular-saw.mp3` (arquivo já presente no projeto) por `tools/gen_sfx.py`: só o trecho em regime (0,9–5,8 s), loudness nivelada, emenda por crossfade de potência constante (4,44 s, sem soluço), pico em -3 dBFS. Em jogo, nível, tom e filtro seguem o giro (`js/weapons/SawMotorAudio.js`). |
| Golpe da serra | `saw-hit-01.wav` a `saw-hit-03.wav` | Derivados de `hit_sound.mp3` (arquivo já presente no projeto) por `tools/gen_sfx.py`: silêncio inicial cortado, cauda encurtada, variações de tom e camadas sintetizadas (sub-thump, "rip" dos dentes, transiente). |

## Música do trailer

| Uso | Arquivo | Fonte e licença |
| --- | --- | --- |
| Trilha contínua do trailer (rock/metal instrumental, ~174 BPM, 3:44, em loop) | `music/megasong.mp3` | [Megasong](https://opengameart.org/content/megasong), emmama, **CC0** (domínio público desde jan/2017). Crédito não exigido. |

## Sons do trailer (`tools/gen_trailer_sfx.py`)

Sintetizados com numpy (reaproveita os utilitários de `tools/gen_sfx.py`), seeds fixas, saída em `trailer/`. Tocados por `js/trailer/audio/TrailerAudio.js`.

| Uso no trailer | Arquivos |
| --- | --- |
| Cortes, câmera chicoteando, pulos | `whoosh-01..03.wav` |
| Pancadas cinematográficas (corte seco, entrada do boss, closes) | `impact-01..03.wav` |
| Explosões (portas, serra gigante, boss) | `boom-01..03.wav` |
| Tremor grave em loop (terremoto, presença do boss) | `rumble-loop.wav` |
| Subida antes dos grandes momentos | `riser.wav` |
| Golpe da cartela/título | `sting.wav` |
| Sangue, pedaços, gotas na lente | `splat-01..04.wav` |
| Fogo (cuspe, sumiço em chamas) | `flame-01..02.wav` |
| Raio do boss (carga e disparo) | `beam-charge.wav`, `beam-fire.wav` |
| Rugido (boss, horda) | `roar.wav` |
| Salas nascendo no mapa | `pop-01..03.wav` |
| Letras do balão de fala | `blip-01..02.wav` |
| Botão e porta de pedra | `stone-click.wav`, `stone-grind.wav` |
| Flecha cravando, corpo batendo | `thunk-01..02.wav`, `thud.wav` |
| Rachaduras de luz na caveira | `crack.wav` |
| Estroboscópio do título | `zap-01..02.wav` |
| Entrada em câmera lenta | `slowmo.wav` |
| Tranco da corda | `rope-01..02.wav` |
| Coração no salto final | `heartbeat.wav` |

## Sons sintetizados (`tools/gen_sfx.py`)

Gerados proceduralmente com numpy, sem amostras de terceiros. Rodar `python tools/gen_sfx.py` (ou `python tools/gen_sfx.py <grupo>`) regera os arquivos de forma determinística.

| Uso no jogo | Arquivos |
| --- | --- |
| Coleta do coração | `heart-pickup-01.wav`, `heart-pickup-02.wav` |
| Corrente arrebentando | `saw-snap.wav` |
| Lâmina pousando no chão | `saw-land-01.wav`, `saw-land-02.wav` |
| Serra recolhida (reconexão) | `saw-pickup.wav` |
| Queda no abismo | `player-fall.wav` |
| Sala limpa (portas destravam) | `door-open.wav` |
| Inimigo surgindo da chama | `enemy-spawn-01.wav` a `enemy-spawn-03.wav` |
| Jogador recebendo dano | `player-hit-01.wav` a `player-hit-03.wav` |
| Armadilha disparando flecha | `arrow-fire-01.wav` a `arrow-fire-03.wav` |
| Interface (foco, confirmar, abrir/fechar pausa) | `ui-move.wav`, `ui-confirm.wav`, `ui-open.wav`, `ui-close.wav` |
| Placa de pressão (pisar / sair) | `button-press-01.wav`, `button-press-02.wav`, `button-release.wav` |
| Ambiente em loop | `ambience-dungeon.wav` (20 s, estéreo, 22 050 Hz, periódico — emenda sem clique) |
| Inimigo surgindo da chama | `enemy-spawn-01..03.wav` |
| Armadilha de flecha disparando | `arrow-fire-01..03.wav` |
