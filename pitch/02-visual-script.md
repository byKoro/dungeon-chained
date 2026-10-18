# Dungeon Chained — Visual Script (Roteiro Visual)

> **Instruções de produção:** pt-BR. **Textos de tela (on-screen text):** inglês.
> Documento sincronizado com `01-spoken-script.md`. Cada bloco visual casa com o bloco de narração de mesmo número.
> **Formato alvo:** 16:9, 1920x1080, 30fps. **Paleta:** escuro nórdico + âmbar de tocha (`#ffd166`), destaque rosa da serra (`#ff5470`).
> **Arma:** só a serra. Nunca mostrar/escrever "laser".

---

## Convenções de ritmo

- **Cold open (B1)** e **roadmap (B7)**: respiro, planos longos, fades.
- **Caos (B4)**: cortes rápidos (0,6–1s por plano), shake, zoom.
- **Negócio (B6)**: planos limpos, texto grande, ritmo estável.
- **Logo** aparece 2x: breve no fim do B2 (selo) e pleno no B8 (fechamento).

---

## BLOCK 1 — Cold Open / Lore (0:00–0:22)

| Tempo | Visual | On-screen text (EN) | Áudio |
|------|--------|---------------------|-------|
| 0:00–0:06 | Tela quase preta. Faísca de forja no centro, brilho âmbar pulsando. Dois sprites de anão (`player_01` + `player_02`) surgem de costas, martelando. | — | Batida de martelo grave + brasa |
| 0:06–0:14 | Fade para masmorra sombria (tileset como fundo), tochas acendendo uma a uma. Silhueta de **Mjölnir** sendo arrancada por uma mão feminina (Hela) saindo do escuro. | `They forged Thor's hammer.` → `They died for him.` (uma frase, depois a outra) | Sussurro grave |
| 0:14–0:22 | A **serra** se forma em SVG entre os dois irmãos: linha cinza + lâminas rosa começam a girar. A corrente "estala" tensa entre eles. | `Now the chain binds them.` | Clang metálico + a serra ganha vida |

Transição: corte seco no "estala" da serra para o B2.

---

## BLOCK 2 — Problema + Público (0:22–0:42)

| Tempo | Visual | On-screen text (EN) | Áudio |
|------|--------|---------------------|-------|
| 0:22–0:30 | Gameplay limpo: dois players andando numa sala, corrente/serra visível entre eles. Zoom suave que enquadra os dois. | `2-PLAYER COUCH CO-OP ROGUELIKE` | Música entra (beat) |
| 0:30–0:36 | Split visual: à esquerda, duas pessoas no sofá (ícone/silhueta); à direita, o gameplay. HUD visível (3 corações cada, P1 amarelo / P2 azul). | `One keyboard. Two friends.` | — |
| 0:36–0:42 | Mini-moldura estilo "stream" (webcam fake no canto) sobre o gameplay caótico. Selo do logo **Dungeon Chained** aparece pequeno no canto. | `Built for friends. Built to go viral.` | Risada/stinger curto |

---

## BLOCK 3 — O Jogo & A Serra (0:42–1:14)

| Tempo | Visual | On-screen text (EN) | Áudio |
|------|--------|---------------------|-------|
| 0:42–0:50 | Close na serra: a linha cinza `#8d99ae` entre os dois e as 5 lâminas rosa girando. Destaque gráfico (glow) na serra. | `The saw IS the chain.` | Zunido da serra |
| 0:50–1:00 | Os dois se afastam → a corrente estica, os sprites trocam para `player_walk_scared`. Depois se aproximam → relaxa. Mostrar a física da tensão. | `Walk apart — it pulls taut.` | Corda tensionando |
| 1:00–1:14 | Players alinham um inimigo (`demon`) no meio da linha; as lâminas **dilaceram** o inimigo com sangue exagerado. Slow-mo breve no corte. | `Line them up. Shred them.` → `Your sword, your rope, your leash.` | Impacto + squish |

---

## BLOCK 4 — Co-op Conflituoso (1:14–1:38) — CORTES RÁPIDOS

| Tempo | Visual | On-screen text (EN) | Áudio |
|------|--------|---------------------|-------|
| 1:14–1:20 | Corte rápido: P1 vai pra esquerda, P2 corre pra direita e arrasta P1 pros **spikes** (`peaks_3`). P1 pisca em `player_hurt`. Shake. | `You go left.` | Grito + spike |
| 1:20–1:28 | Corte rápido: buraco/abismo entre os dois; a corrente puxa um player pra beira do buraco (`player_walk_scared`), quase cai. | `Your partner drags you in.` | Vento do abismo |
| 1:28–1:38 | Dois botões de pressão co-op: os players pisam **juntos**, a porta destranca com glow. Depois ambos atravessam a mesma porta. | `Doors open only together.` | Click duplo + porta abrindo |

---

## BLOCK 5 — Inspirações & Valor (1:38–2:08)

> Cada jogo entra como **card** (nome + 1 palavra de valor) ao lado de um clipe curto de gameplay nosso que ilustra aquele valor. Não usar artwork dos jogos originais — apenas o NOME em texto e nosso gameplay.

| Tempo | Visual | On-screen text (EN) | Áudio |
|------|--------|---------------------|-------|
| 1:38–1:45 | Card 1 entra pela lateral. Gameplay caótico ao fundo. | `OVERCOOKED → Friendly chaos` | — |
| 1:45–1:52 | Card 2. Montagem de 3 salas diferentes geradas (procedural). | `THE BINDING OF ISAAC → Procedural runs` | — |
| 1:52–1:59 | Card 3. Dois players cooperando com peso. | `IT TAKES TWO → Built for two` | — |
| 1:59–2:08 | Card 4, depois os 4 cards se fundem numa serra única. | `CHAINED TOGETHER → The bond` → `We forge all four into one blade.` | Clang de fusão |

---

## BLOCK 6 — Mercado / Negócio (2:08–2:28)

| Tempo | Visual | On-screen text (EN) | Áudio |
|------|--------|---------------------|-------|
| 2:08–2:16 | Planos limpos, texto grande. Ícone de "2 cópias" / dois controles. | `Co-op sells in pairs.` | Beat estável |
| 2:16–2:22 | Montagem rápida de "clipes de stream" (molduras de webcam fake) saindo do gameplay. | `Accessible premium. Streamer-driven growth.` | — |
| 2:22–2:28 | Frase de posicionamento centralizada. | `Low cost to reach. High reason to share.` | — |

---

## BLOCK 7 — Roadmap / Visão (2:28–2:48)

| Tempo | Visual | On-screen text (EN) | Áudio |
|------|--------|---------------------|-------|
| 2:28–2:34 | Fundo da masmorra, respiro. Silhueta de um boss gigante surgindo (concept/silhueta, não precisa de asset final). | `PLAYABLE VERTICAL SLICE` → `Roadmap:` | Música cresce |
| 2:34–2:44 | Lista de bullets aparecendo um a um, com ícones. | `Boss fights` · `Meta-progression` · `More saws & rooms` · `Content expansions & new maps` | Tick a cada bullet |
| 2:44–2:48 | Bullet final, com destaque "ambição". | `One day: online co-op` | — |

---

## BLOCK 8 — Call to Action (2:48–3:00)

| Tempo | Visual | On-screen text (EN) | Áudio |
|------|--------|---------------------|-------|
| 2:48–2:53 | Volta ao mítico: os dois irmãos de costas, serra girando, encarando uma porta de luz. | `Two brothers. One saw.` | Batida grave final |
| 2:53–2:58 | **Logo pleno DUNGEON CHAINED** no centro, serra desenhada formando o traço do título. | `DUNGEON CHAINED` | Stinger do logo |
| 2:58–3:00 | CTA limpo embaixo do logo. | `Wishlist now. Grab a friend.` | Última nota |

---

## Checklist visual
- [ ] Logo aparece como selo (B2) e pleno (B8).
- [ ] Cards de inspiração usam só NOME + valor (sem artwork de terceiros).
- [ ] Serra sempre rosa `#ff5470` sobre corda cinza `#8d99ae`.
- [ ] HUD (3 corações, P1 amarelo / P2 azul) visível nos planos de gameplay.
- [ ] Nenhuma menção a laser.
