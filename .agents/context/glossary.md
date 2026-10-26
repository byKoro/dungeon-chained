# Glossary

Domain language of Dungeon Chained. Code identifiers are English; pt-BR terms appear in the editor UI, labels, map file names, commit messages and team conversation. Skills that mention `GLOSSARY.md` mean this file.

## Core terms

| Term | pt-BR | Meaning |
|---|---|---|
| Player 1 / P1 | Amarelo | Yellow player, keyboard WASD or gamepad 0 |
| Player 2 / P2 | Azul | Blue player, arrow keys or gamepad 1 |
| Chain / cable | corrente, cabo | Elastic tether between P1 and P2 that carries the saw (asset `rope.png`, key `cable`) |
| Saw | serra | The only weapon: disc at the cable midpoint; kills any enemy it or the cable touches |
| Snap | arrebentar, ruptura | Cable breaks from over-stretch or a hole fall; saw is dropped |
| Dropped saw / blade | lâmina largada | Saw lying on the floor until both players reach it |
| Reconnect | reconectar | Both players pick the saw back up |
| Spin | giro | Saw spin speed (0..1), grows when both players move |
| Motor stutter | engasgo | Pitch dip of the saw motor sound on hits/snap |
| Lives / heart | vidas / coração | Each player has 3 lives; heart pickup heals 1 |
| Dungeon | masmorra | One run: a graph of cells (rooms + corridors) |
| Cell | célula | One grid slot of the dungeon graph |
| Room | sala | A cell of kind `room` |
| Corridor | corredor | A cell of kind `corridor` carved between rooms |
| Room piece | peça (de sala) | Authored 14×9 layout in `map/*.json` that fills a cell |
| Door signature / shape | forma | Which doors are open, written `N,E,S,W` (e.g. `1,0,1,0`) |
| Variant | variação | Another piece with the same signature and type |
| Start room | câmara inicial, hub | `type: "start"` piece; run begins here |
| Boss room | sala do chefe | `type: "boss"` (no pieces authored yet) |
| Challenge room/corridor | desafio, sala-trap | Room with hazards; solved by holding ≥2 pressure buttons |
| Lock rule | trancamento | How a room keeps doors closed: `auto`, `none`, `enemies`, `buttons` |
| Hazard / trap | perigo, armadilha, trap | `spike`, `spikeRow`, `arrow`, `button` |
| Spike / spike row | espinho (peaks) / fileira de espinhos | Floor spikes; a row fires as a travelling wave |
| Arrow trap | atirador de flecha | Wall-mounted shooter |
| Pressure button | botão de pressão, placa | Co-op plate; needs players standing on it |
| Hole / void | buraco, abismo | Floor `-1`: players fall, lose a life, respawn |
| Empty floor | vazio, espaço | Floor `-2`: dark flat tile, no fall, not walkable for spawns |
| Wall block | parede | Authored interior/border wall tile with collision |
| Torch / candlestick | tocha / castiçal | Light sources authored in pieces |
| Prop / scatter | prop / espalhar | Decorative tiles, manual or random scatter |
| Gib | pedaço, gib | Enemy body chunk after death |
| Room intro | intro da sala | Zoom-in, frozen staggered enemy spawn, zoom-out |
| Playtest | Testar | Editor runs one piece in the game (`?playtest=true`) |
| Coverage | Cobertura | Editor report of pieces per shape |
| VTuber HUD | HUD vtuber | Animated player portraits with expressions + heart rows |
| Juice | game feel | Shake, slow-mo, particles, flashes, ducking |
| Dash | dash, investida | Individual burst (Space / Enter / pad A·RB), only while the chain is snapped: i-frames, passes enemies, jumps 1-tile holes, 1 s cooldown shown under the hearts |

## Enemies (editor labels)

Demônio = Demon (fast melee) · Monstro de Sangue = Blood Monster (tank) · Cavaleiro Negro = Black Knight · Demônia = Demoness · Voador = Flying · Rápido / Normal / Lento = fast / normal / slow (spike timing).

## Player expressions (asset file names)

neutro = neutral · assustado = scared · espantado = startled · raiva = anger · furia = fury · preocupado = worried · desconfiado = suspicious · olhando_esquerda/direita/cima = looking left/right/up · olhos_fechados = eyes closed.

## Misspellings kept for compatibility
- `assets/buttom/` = button. `assets/peaks/` = spikes ("picos"). `map/corredor_ne_01.json` = legacy pt-BR file name.
