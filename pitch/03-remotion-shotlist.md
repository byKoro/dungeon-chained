# Dungeon Chained — Remotion Shot List (Shot List de Produção)

> **Instruções de produção:** pt-BR. **Textos de tela (on-screen text):** inglês.
> Documento para a skill `remotion` montar o vídeo com **HTML/CSS/SVG + assets reais do jogo**.
> **Premissa (decisão do usuário):** o Remotion anima **tudo do zero** com os assets — não é captura de tela de gameplay. Zoom nos personagens, sangue exagerado, efeitos amplificados.
> **Timeline:** 30fps · total ~3:00 = **~5400 frames**. Cada cena abaixo lista duração em **segundos** e **frames**.
> **Arma:** só a serra. Nunca "laser".

---

## 0. Setup global (vale para todas as cenas)

**Dimensões:** 1920x1080, 30fps.

**Assets reais (caminhos exatos, relativos à raiz do projeto):**
- Players: `assets/player_01/player_walk.png`, `assets/player_01/player_walk_scared.png`, `assets/player_01/player_hurt.png` · `assets/player_02/player_walk.png`, `assets/player_02/player_walk_scared.png`, `assets/player_02/player_hurt.png` (+ `assets/player_02.png` solto se precisar de pose única).
- Inimigos: `assets/enemies/demon.png`, `assets/enemies/blood_monster.png`.
- Cenário: `assets/tileset/tileset.png` (grade 16x10, tiles de 16px; escalar para 64px, `image-rendering: pixelated`). Preview: `assets/tileset/_preview.png`.
- Perigos: `assets/peaks/peaks_0.png`..`peaks_3.png` (spike: 0=recolhido/seguro → 3=estendido/letal, 16x16).
- Luz/ambiente: `assets/torch/torch_1.png`..`torch_4.png` (animar 4 frames em loop ~8fps), `assets/torch/side_torch_1..4.png`, `assets/torch/candlestick_*`.
- Recompensa/futuro: `assets/chest/chest_1..4.png` e `assets/chest/chest_open_1..4.png`.
- Áudio: pasta `assets/audio/` — ex.: `footstep-stone-01..06`, `player-hurt-01..06`, `monster-attack-01..03`, `monster-hurt-01..03`, `enemy-attack-01..03`, `item-pickup.flac`. (Música/trilha de pitch: adicionar faixa própria royalty-free; os .wav/.ogg acima são SFX.)

**Regra de pixel art:** todas as imagens de sprite/tile com `image-rendering: pixelated` e escala inteira (2x, 3x, 4x) para não borrar.

**Paleta:** fundo `#1a1622` (ambiente escuro), âmbar de tocha `#ffd166`, destaque da serra `#ff5470`, corda `#8d99ae`, P1 `#ffd166` (amarelo), P2 `#6bb4db` (azul).

### Componente reutilizável: `<ChainSaw />` (a serra = a corrente = a arma)
A serra **não tem sprite**; recriar em SVG/CSS exatamente como o jogo desenha (`js/weapons/SawWeapon.js`):
- Uma **linha** (corda) entre o centro do P1 e o centro do P2: `stroke="#8d99ae"`, `stroke-width:4`.
- **5 serras** distribuídas na linha nas frações t = 1/6, 2/6, 3/6, 4/6, 5/6 entre P1→P2.
- Cada serra = disco dentado SVG. **Raios alternados:** lâminas de índice par ~14px, ímpar ~11px.
- Cor da lâmina `fill="#ff5470"`, borda `stroke="#fff" stroke-width:1.5`.
- **Rotação contínua**, com **sentido alternado** por lâmina (par horário, ímpar anti-horário), velocidade ~ `angle += 0.2/frame` (≈ 360°/~1s). Usar `useCurrentFrame()` para o ângulo.
- Prop: posições de P1 e P2 (as serras recalculam a cada frame conforme os personagens se movem).

### Componente reutilizável: `<Hud />`
Barra superior: `DUNGEON — FLOOR 1`, P1 (amarelo) com N corações, P2 (azul) com N corações. Usar emoji ❤️ ou um ícone de coração. Discreto, estilo overlay de jogo.

### Efeitos reutilizáveis
- **BloodBurst**: 20–30 partículas vermelhas (`#6e0f1c`, `#5c0a18`, `#4a0612`) saindo do ponto de morte, EXAGERADO (muito mais que no jogo), + splatter que fica no chão. Gib: quadradinhos que voam e caem.
- **ScreenShake**: deslocamento x/y senoidal + ruído, 6–12px, decaindo em ~0,3s.
- **Vignette**: radial-gradient escuro nas bordas, sempre on.
- **TorchGlow**: `radial-gradient` âmbar `#ffd166` com flicker (opacidade oscilando ~0,9–1,0, ruído leve), atrás das tochas.
- **SlowMo**: nos impactos-chave, segurar o frame / reduzir avanço por ~0,3s.

---

## CENA 1 — Cold Open: a forja (↔ Spoken Block 1) — 6s · 180f

- **Fundo:** `#0d0b12` quase preto, `Vignette` forte.
- **Centro:** faísca de forja — partículas âmbar `#ffd166` subindo de um ponto. `TorchGlow` pulsando.
- **Personagens:** `assets/player_01/player_walk.png` e `assets/player_02/player_walk.png` de costas (flip vertical do sprite ou pose estática), martelando — pequena oscilação vertical de 2px a cada 0,5s.
- **Câmera:** push-in lento (scale 1.0 → 1.08 em 6s).
- **On-screen text (fade-in 0,5s):** `They forged Thor's hammer.` (0–3s) → `They died for him.` (3–6s), fonte serifada pesada, branca, centralizada baixo.
- **Áudio:** batida grave de martelo a cada ~1s; brasa de fundo.

---

## CENA 2 — Hela rouba Mjölnir (↔ Block 1) — 5s · 150f

- **Fundo:** masmorra sombria — montar sala com `assets/tileset/tileset.png` (chão + paredes), `TorchGlow` acendendo tochas (`assets/torch/torch_1..4.png` em loop) uma a uma da esquerda pra direita.
- **Elemento central:** silhueta de **Mjölnir** (SVG simples de martelo) flutuando; uma mão/silhueta escura (Hela) entra pela direita e **arranca** o martelo (anima para fora de quadro em 0,4s com `SlowMo` no instante).
- **Câmera:** leve pan lateral seguindo o martelo.
- **On-screen text:** `Now the chain binds them.` (entra em 3,5s).
- **Transição p/ Cena 3:** quando a serra "estala" — corte seco.
- **Áudio:** sussurro grave; clang metálico no roubo.

---

## CENA 3 — A serra nasce (↔ Block 1 fim) — 4s · 120f

- **Composição:** os dois irmãos a ~400px de distância, de perfil, virados um para o outro.
- **`<ChainSaw />`:** a corda `#8d99ae` se desenha entre eles (anima o comprimento 0→100% em 0,6s), depois as 5 lâminas rosa **aparecem e começam a girar**.
- **Efeito:** flash branco curto quando a serra "liga"; faíscas rosa.
- **Câmera:** `ScreenShake` leve no "liga".
- **Áudio:** clang + zunido da serra ganhando rotação.

---

## CENA 4 — Gameplay apresentação (↔ Block 2) — 8s · 240f

- **Fundo:** sala jogável montada com `tileset.png`, 2 tochas com `TorchGlow`.
- **Personagens:** `player_01/player_walk.png` (P1) e `player_02/player_walk.png` (P2) andando — animar o walk (se o PNG for sprite sheet, ciclar os frames; senão, bob vertical de 3px + leve inclinação).
- **`<ChainSaw />`** sempre entre eles. **`<Hud />`** visível (3+3 corações).
- **Câmera:** começa enquadrando os dois, **zoom suave** (scale 1.0→1.12) centralizando no par.
- **On-screen text:** `2-PLAYER COUCH CO-OP ROGUELIKE` (entra 0,5s, grande, embaixo).
- **Áudio:** música (beat) entra aqui; `footstep-stone-*` nos passos.

---

## CENA 5 — Sofá + stream (↔ Block 2 fim) — 6s · 180f

- **Layout split:** esquerda = silhueta/ícone de duas pessoas no sofá (SVG simples); direita = o gameplay da Cena 4 continuando.
- **3,5s em diante:** sobrepor uma **moldura de webcam fake** (retângulo arredondado no canto inferior) sobre o gameplay, estilo stream. Selo do **logo Dungeon Chained** pequeno no canto superior direito.
- **On-screen text:** `One keyboard. Two friends.` (0–3,5s) → `Built for friends. Built to go viral.` (3,5–6s).
- **Áudio:** stinger curto de risada.

---

## CENA 6 — Close na serra / física da tensão (↔ Block 3) — 10s · 300f

- **0–3s:** close-up na `<ChainSaw />` — câmera aproxima (scale 1.3). Destacar as 5 lâminas rosa girando com `glow` (filter: drop-shadow rosa). On-screen: `The saw IS the chain.`
- **3–7s:** os dois personagens se **afastam** → a corda estica, os sprites trocam para `player_walk_scared.png` (os dois). Depois se aproximam → voltam a `player_walk.png`. Mostrar a mola: ao esticar além do limite, puxão de volta (ease-out). On-screen: `Walk apart — it pulls taut.`
- **7–10s:** um `demon` (`assets/enemies/demon.png`) entra e os players o **alinham no meio da linha**; as lâminas o atravessam → `BloodBurst` EXAGERADO + `SlowMo` 0,3s + `ScreenShake`. On-screen: `Line them up. Shred them.` → `Your sword, your rope, your leash.`
- **Áudio:** zunido da serra; `monster-hurt-01`; squish no corte.

---

## CENA 7 — Caos 1: puxão pros spikes (↔ Block 4) — 7s · 210f · CORTES RÁPIDOS

> Ritmo picado: 3 micro-planos.

- **Plano A (0–2,2s):** P1 anda pra esquerda; P2 **dispara** pra direita. A corda estica e **arrasta P1**. On-screen: `You go left.`
- **Plano B (2,2–4,5s):** no caminho forçado há **spikes** — ciclar `assets/peaks/peaks_0.png`→`peaks_3.png` (sobe para letal). P1 é arrastado para cima deles → `player_01/player_hurt.png` piscando (alterna com walk a cada 4 frames), `ScreenShake`, `BloodBurst` pequeno. HUD de P1 perde 1 coração (anima o coração sumindo).
- **Plano C (4,5–7s):** reação cômica — os dois `player_walk_scared.png`. On-screen: `Your partner drags you in.`
- **Áudio:** `player-hurt-02`; som metálico do spike.

---

## CENA 8 — Caos 2: beira do abismo + portas co-op (↔ Block 4 fim) — 8s · 240f

- **0–3s:** sala com **buraco** (tiles de abismo escuros do tileset / área preta). Um player perto da beira; a corda puxa o outro **em direção ao buraco** (`player_walk_scared.png`), freia na borda. `Vignette` fecha um pouco pra tensão.
- **3–8s:** dois **botões de pressão** co-op (recriar em SVG: base `#3a2f4a`, anel `#8a7fb0`, topo solto `#6bb4db` → pressionado `#54d98b`). Os dois players pisam **ao mesmo tempo** → os botões ficam verdes → uma **porta** destranca com glow rosa `#e53170`. Ambos atravessam. On-screen: `Doors open only together.`
- **Áudio:** vento do abismo; duplo "click"; porta abrindo.

---

## CENA 9 — Inspirações & valor (↔ Block 5) — 30s · 900f

> **Importante (licença):** NÃO usar artwork/logos dos jogos originais. Apenas o **NOME em texto** + 1 palavra de valor, sobre o NOSSO gameplay. Cada card = ~7s.

- **Card 1 (0–7s):** gameplay caótico (reaproveitar Cena 7) ao fundo, card entra deslizando da direita. On-screen: `OVERCOOKED → Friendly chaos`.
- **Card 2 (7–14s):** montagem de **3 salas diferentes** geradas com `tileset.png` (layouts distintos, trocar a cada ~2s) para vender o procedural. On-screen: `THE BINDING OF ISAAC → Procedural runs`.
- **Card 3 (14–21s):** os dois players cooperando num momento de sincronia (botões/porta da Cena 8). On-screen: `IT TAKES TWO → Built for two`.
- **Card 4 (21–28s):** foco na `<ChainSaw />` / corda. On-screen: `CHAINED TOGETHER → The bond`.
- **Fusão (28–30s):** os 4 cards se contraem para o centro e "viram" uma única serra girando. On-screen: `We forge all four into one blade.`
- **Câmera:** cada card com leve push-in; corte limpo entre eles.

---

## CENA 10 — Mercado / negócio (↔ Block 6) — 20s · 600f

- **0–8s:** fundo escuro limpo. Ícone SVG de **duas cópias / dois controles**. On-screen grande: `Co-op sells in pairs.`
- **8–14s:** grade de **molduras de webcam fake** (4–6 retângulos) surgindo com micro-clipes do gameplay dentro — ideia de "clipes de stream se multiplicando". On-screen: `Accessible premium. Streamer-driven growth.`
- **14–20s:** frase de posicionamento centralizada, tipografia forte. On-screen: `Low cost to reach. High reason to share.`
- **Câmera:** estável (bloco "investidor"). `ScreenShake` OFF aqui.
- **Áudio:** beat estável.

---

## CENA 11 — Roadmap / visão (↔ Block 7) — 20s · 600f

- **0–6s:** masmorra ao fundo, respiro. **Silhueta de boss gigante** (SVG/forma escura, olhos âmbar `#ffd166`) surgindo atrás de uma porta. Opcional: `assets/chest/chest_open_1..4.png` abrindo como "recompensa". On-screen: `PLAYABLE VERTICAL SLICE` → `Roadmap:`.
- **6–16s:** **bullets entrando um a um** (fade+slide, tick sonoro a cada): `Boss fights` · `Meta-progression` · `More saws & rooms` · `Content expansions & new maps`. Ícone pixel ao lado de cada.
- **16–20s:** bullet final destacado como ambição (cor diferente): `One day: online co-op`.
- **Câmera:** push-in lento; música crescendo.

---

## CENA 12 — Call to Action + Logo (↔ Block 8) — 12s · 360f

- **0–5s:** volta ao mítico — os dois irmãos de costas (`player_01`/`player_02`), `<ChainSaw />` girando, encarando uma **porta de luz** (retângulo com glow âmbar). On-screen: `Two brothers. One saw.`
- **5–10s:** **logo pleno `DUNGEON CHAINED`** no centro — o traço do título incorpora a serra (uma lâmina rosa `#ff5470` como ponto/detalhe). Entrada com `ScreenShake` + flash. On-screen: `DUNGEON CHAINED`.
- **10–12s:** CTA limpo sob o logo. On-screen: `Wishlist now. Grab a friend.`
- **Áudio:** batida grave final + stinger do logo; última nota sustentada.

---

## Resumo da timeline

| Cena | Bloco narração | Duração | Frames (30fps) | Acumulado |
|-----:|:--------------:|--------:|---------------:|----------:|
| 1 | B1 | 6s | 180 | 0:06 |
| 2 | B1 | 5s | 150 | 0:11 |
| 3 | B1 | 4s | 120 | 0:15 |
| 4 | B2 | 8s | 240 | 0:23 |
| 5 | B2 | 6s | 180 | 0:29 |
| 6 | B3 | 10s | 300 | 0:39 |
| 7 | B4 | 7s | 210 | 0:46 |
| 8 | B4 | 8s | 240 | 0:54 |
| 9 | B5 | 30s | 900 | 1:24 |
| 10 | B6 | 20s | 600 | 1:44 |
| 11 | B7 | 20s | 600 | 2:04 |
| 12 | B8 | 12s | 360 | 2:16 |

> **Nota de sincronia:** as cenas somam **~2:16 de vídeo visual**; a narração soma **~3:00**. A diferença é intencional — os blocos 1–4 têm MAIS tempo de narração do que de corte visual único, então estenda/segure as cenas 1–8 (ou duplique micro-planos) até casar com a locução. Alinhe sempre o **fim de cada bloco de narração** com o **fim da cena correspondente**. Ao montar no Remotion, use a narração como trilha-mestre e estique as cenas para encostar nela.

## Checklist de produção
- [ ] Nenhuma cena cita/mostra laser — só a `<ChainSaw />`.
- [ ] Todos os caminhos de asset existem (ver seção 0).
- [ ] `image-rendering: pixelated` em todo sprite/tile.
- [ ] Serra: corda `#8d99ae` + 5 lâminas `#ff5470`, raios 14/11 alternados, rotação alternada.
- [ ] Sangue exagerado só nas mortes (Cena 6) e dano (Cena 7).
- [ ] Cards de inspiração sem artwork de terceiros (só nome + valor).
- [ ] On-screen text em inglês; estas instruções em pt-BR.
