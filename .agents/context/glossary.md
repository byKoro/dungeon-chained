# Glossary

Domain language of Dungeon Chained. Code identifiers are English; pt-BR terms appear in the editor UI, labels, map file names, commit messages and team conversation. Skills that mention `GLOSSARY.md` mean this file.

## Core terms

| Term | pt-BR | Meaning |
|---|---|---|
| Player 1 / P1 | Amarelo | Yellow player, keyboard WASD or gamepad 0 |
| Player 2 / P2 | Azul | Blue player, arrow keys or gamepad 1 |
| Chain / cable | corrente, cabo | Elastic tether between P1 and P2 that carries the saw (asset `rope.png`, key `cable`) |
| Saw | serra | The only weapon: disc at the cable midpoint; kills ordinary enemies on contact and damages bosses through their hit/cooldown interface |
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
| Ghostfire | Ghostfire, boss do trailer | Giant floating fire skull (`type: "ghostfire"`), with staggered minion summons and a horizontal beam; alternates arena sides |
| Beam warning | aviso do raio | Locked, harmless line before Ghostfire fires; gives players time to dodge vertically |
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
| Hit stop | congelamento de impacto | Per-enemy freeze (`MeleeEnemy.freezeOnHit`, durations in `HIT_FEEL.hitStop`) on each saw hit; players, saw and the rest of the room keep simulating. `GameLoop.triggerHitStop` (global freeze) still exists but `Game` no longer calls it |
| Stagger / hurt | atordoamento curto | Short interruption + knockback of a surviving enemy after a saw hit (`"hurt"` state) |
| Poise | poise, postura | Invisible per-enemy buffer for strong enemies (`combat.poise`); breaking it causes a long stun (`"stunned"`) and a vulnerability window |
| Scrap | sucata | Shared currency of the pair (`ScrapSystem`, one pot). Drops from enemies and chests, rests 0,4 s, then a magnet pulls it to the nearest player within ~2,5 tiles. Editor 2.0 maps only |
| Vacuum | aspirar, puxar a sucata | `ScrapSystem.vacuum()`: every scrap on the floor flies to the nearest player, any distance (used when a wave is cleared, slice 4) |
| Chest | baú | Prop `chest`/`mini_chest` that sits still with a sweeping shine while closed; a player right next to it (1 tile) presses interact to open it once, and it bursts its authored scrap (`prop.scrap`) |
| Solid prop | prop sólido | Animated prop with a `base` footprint (`PropConfig`): blocks players' and enemies' feet only and is y-sorted with them (anvil, chests) |
| Interact icon | indicador de interagir | Round icon floating above a chest or anvil while a player is in range, one per player in their colour with the button of the device they used last (`InteractPrompt`, `assets/ui/interact_prompt.png`). The prop also gets a white 1 art px outline (borda branca) while someone is in range |
| Speech bubble | balão (de fala) | Text bubble above the speaking player, typed letter by letter with a voice blip (`DialogueSystem.say`) |
| Anvil / forge | bigorna / forja | Prop `anvil`; interact opens the forge menu (`ForgeSystem`), which sells the recipes the anvil offers (`prop.recipes`) for scrap |
| Recipe | receita | Catalog entry in `FORGE.recipes`: an item (`saw`) or an upgrade of an item (`size`, `elasticity`, `doubleSaw`), with a cost per level |
| Upgrade | melhoria | Tamanho (+20% disc), Elasticidade (+15% cable), Serra dupla; Peso comes in slice 3 |
| Double saw | serra dupla | Upgrade: near the break distance the disc splits into two at 1/3 and 2/3 of the cable and merges back when the pair closes in |
| Drag the saw | arrastar a serra | With the cable snapped, one player holds interact near the dropped saw and pulls it on a short cable, slower; the Peso upgrade extends distance and speed |
| Zone | zona | Named rectangle of a room (`room.zones`); "enter the zone" means both players inside |
| Encounter / wave | encontro / leva | Named list of waves (`room.encounters`); the room script decides when each wave drops |
| Bars | grade | Bar tiles at a zone's accesses; closed (solid) while an encounter runs |
| Cage / rope / stake | gaiola / corda / estaca | The Salão set piece: vertical ropes tied to stakes, each holding a hidden cage above; cutting a rope drops its cage, which shatters and releases a wave |
| Run death | morte da run | On maps with an anvil: respawn at the start with full lives, scrap lost, items and finished events kept (ADR 0012) |
| Saw cinematic | cinemática da serra | Craft cutscene after buying the Serra (`SawForgeCinematic`) |
| i18n key | chave de idioma | String id looked up with `t('chave')` in `js/i18n/*` (pt-BR default) |

## Enemies (editor labels)

Demônio = Demon (fast melee) · Monstro de Sangue = Blood Monster (tank) · Cavaleiro Negro = Black Knight · Demônia = Demoness · Voador = Flying · Rápido / Normal / Lento = fast / normal / slow (spike timing).

## Player expressions (asset file names)

neutro = neutral · assustado = scared · espantado = startled · raiva = anger · furia = fury · preocupado = worried · desconfiado = suspicious · olhando_esquerda/direita/cima = looking left/right/up · olhos_fechados = eyes closed.

## Misspellings kept for compatibility
- `assets/buttom/` = button. `assets/peaks/` = spikes ("picos"). `map/corredor_ne_01.json` = legacy pt-BR file name.

- **Cavaleiro Negro B / Black Knight B** (`blackKnightB`): tanque lento com três ataques alternados e morte animada.

- **Cultista / Cultist** (`cultist`): inimigo à distância que marca um ponto fixo e invoca um pilar de fogo após aviso. `preferredDistance`: distância desejada aos jogadores, em pixels.

- **Flame Golem / Golem de Chamas** (flameGolem): slow resistant melee baseline using flame_golem.png; planned visual identity for the sanctuary herald. Final herald behavior remains undecided.

- **Golem phase / fase do golem**: HP-triggered permanent combat stage; phase 2 increases speed and uses two charges per cast.
- **Marked charge / investida marcada**: saved player positions telegraph the charge before launch; trackingStrength controls subsequent steering toward a live target.

| Arauto das Brasas | boss (Flame Golem) | Nome aprovado do chefe `flameGolem`: 100 HP, sem stagger, três saltos com slam na fase 2, morte com escombros e barra de chefe |
| Super armor | `superArmor` | Flag de `sprite.combat`: o inimigo recebe dano mas não sofre stagger, empurrão nem hit stop local |
| Slam | slam | Salto do chefe que aterrissa numa marca fixa e causa dano radial com empurrão |
| Escombros | `room.corpses` | Corpo decorativo no último quadro da animação de morte, sem gibs |
| Vida infinita | `infiniteLives` | Opção de teste: acertos e quedas continuam, a vida não desce |


## Chain presentation
| Term | pt-BR | Meaning |
|---|---|---|
| Chain effort | esforço da corrente | Smoothed physical load, including subtle anticipation before damage accumulation; drives local vibration, metallic creak and shared player faces |
| Rupture risk | risco de ruptura | Current distance/time danger, respecting dash protection and double-saw paused accumulation; drives critical urgency |
