# Dungeon Chained — Pitch

> Documento-base do pitch (pt-BR). A narração em inglês fica em `01-spoken-script.md`.

## Em uma frase

Um roguelite de ação co-op para dois jogadores acorrentados um ao outro. A corrente que os prende é também a única arma.

## A história

Brokkr e Eitri, os irmãos anões que forjaram as maiores armas dos deuses, morreram defendendo Thor e acordaram no inferno nórdico. Hela roubou o Mjölnir. Para recuperá-lo, os irmãos forjam uma última arma: uma serra que os acorrenta um ao outro. Agora precisam escalar a Yggdrasil, a árvore do mundo, reino por reino, até alcançar o martelo.

## O gancho

A serra fica na corrente entre os dois jogadores. Para atacar, a dupla precisa se posicionar junta: alinhar os inimigos entre os dois e esticar a corrente na hora certa.

Se esticarem demais, a corrente arrebenta e a serra cai no chão. Os dois ficam desarmados até voltarem **juntos** até a serra para encaixá-la de novo. Um erro de um afeta a dupla, e é daí que vem a tensão do jogo.

## Pilares

1. **Acorrentados:** a arma é compartilhada. Quem ataca é a dupla, não o jogador.
2. **Combate rápido**, inspirado em Hades: salas curtas, ação intensa, uma run diferente da outra.
3. **Cooperação obrigatória**, inspirada em It Takes Two e Portal: os puzzles só se resolvem com os dois juntos.
4. **Mitologia nórdica:** cada reino é um mundo da Yggdrasil, e cada boss guarda um tesouro lendário.

## O que já funciona (protótipo jogável)

- Dois jogadores no mesmo teclado (WASD + setas), unidos pela corrente com a serra.
- Corrente que arrebenta ao esticar demais, e a dupla precisa voltar junta até a serra para reacoplá-la.
- Mapa montado em grid com salas autorais sorteadas a cada run.
- Puzzles co-op: botões que precisam ser pisados ao mesmo tempo, ondas de espinhos, atiradores de flecha, abismos.
- Inimigos (demônio, monstro de sangue, cultista), sistema de vidas e corações de cura.
- Editor de salas próprio e trailer de abertura.

## Estrutura: a escalada da Yggdrasil

A torre do jogo é a Yggdrasil. Cada andar é um dos Nove Reinos, com tema, inimigos e boss próprios. Derrotar o boss do reino libera a subida para o próximo, mais difícil.

| Andar | Reino | Tema sugerido |
|---:|---|---|
| 1 | Helheim | Mortos, névoa, ossos (início da escalada) |
| 2 | Niflheim | Gelo e escuridão |
| 3 | Svartalfheim | Forjas e cavernas dos anões |
| 4 | Jötunheim | Gigantes e montanhas |
| 5 | Midgard | O mundo dos humanos |
| 6 | Vanaheim | Natureza e magia dos Vanir |
| 7 | Alfheim | Luz e elfos |
| 8 | Muspelheim | Fogo |
| 9 | Asgard | Os deuses (confronto final) |

*A ordem dos reinos é uma sugestão. O escopo inicial pode ter só 2 ou 3 reinos.*

## Loop principal

1. **Run:** o grid do reino é gerado a partir de salas e caminhos pré-feitos, então cada run é única.
2. **Boss:** cada reino termina num boss, e o tema do reino vem dele.
3. **Recompensa:** derrotar o boss devolve uma relíquia lendária.
4. **Lobby:** a dupla gasta as moedas da run em poções, armaduras e upgrades.
5. **Subida:** a próxima run começa um galho acima na Yggdrasil.

## Progressão

### Arma (árvore da serra)
- **Atributos:** dano da serra e comprimento da corrente.
- **Ação, arremessar a serra:** a dupla estilinga a serra, que voa à frente atingindo os inimigos no caminho e ricocheteia nas paredes até perder velocidade e parar.

### Personagens (árvore individual, uma por irmão)
- Dash.
- Pulo.

### Relíquias dos bosses

No mito, Brokkr e Eitri forjaram exatamente Gullinbursti, Draupnir e Mjölnir. No jogo, os bosses guardam as obras dos próprios irmãos, e cada vitória recupera uma delas.

**Ativas**
- **Gullinbursti:** invoca o javali dourado. Os dois montam cada um o seu javali por alguns segundos, com velocidade 2,5x e dano por atropelamento somado ao da serra.
- **Mjölnir:** o martelo de Thor cai do céu e causa dano massivo em área.

**Passivas**
- **Draupnir:** o anel mágico dobra as moedas recebidas.

### Lobby

Um salão aconchegante entre as runs, com um NPC que vende poções de cura, aprimora itens e vende armaduras com defesa e resistência elemental.

### O que é permanente

Habilidades e armas adquiridas não se perdem entre runs.

## Mercado

O co-op para duas pessoas, local ou online, deixou de ser nicho:

- **Hazelight:** os três jogos do estúdio passaram de 50 milhões de cópias somadas. *It Takes Two* passou de 30 milhões, *A Way Out* chegou a 13 milhões e *Split Fiction* vendeu 7 milhões em cerca de um ano (abril de 2026). [Game Developer](https://www.gamedeveloper.com/business/split-fiction-dev-hazelight-studios-accrues-50m-total-sales)
- **Chained Together**, o concorrente mais próximo em tema (jogadores acorrentados fugindo do inferno), foi lançado em junho de 2024 por um estúdio pequeno e passou de 10 milhões de cópias no Steam. [Secret Mode](https://www.wearesecretmode.com/news/chained-together-joins-secret-mode)
- **PEAK**, co-op indie que nasceu numa game jam, passou de 10 milhões de cópias e US$ 55 milhões de receita. [GamesIndustry.biz](https://www.gamesindustry.biz/peak-co-creator-anyone-can-make-the-next-big-hit-but-there-are-few-opportunities-for-developers)
- Existe um público fiel de co-op indie: cerca de 30% dos jogadores de PEAK no Steam também jogaram Chained Together ou Lethal Company. [Alinea Analytics](https://alineaanalytics.com/blog/steam_june_2025/)
- **Roguelite de ação:** *Hades II* vendeu mais de 2 milhões de cópias no Steam ainda em acesso antecipado [GamesIndustry.biz](https://www.gamesindustry.biz/hades-2-tops-metacritics-pc-game-chart-for-2025) e acumula cerca de US$ 82 milhões de receita no Steam [Game World Observer](https://gameworldobserver.com/2026/03/23/slay-the-spire-2-has-already-surpassed-hollow-knight-silksong-and-hades-ii-in-revenue-on-steam-analytics).

**Onde Dungeon Chained entra:** o público de co-op já provou que compra jogos sobre estar preso a alguém (Chained Together), e o de roguelite já provou que volta para runs infinitas (Hades). Ninguém juntou os dois num jogo de ação em que a corrente é a arma.

**Diferencial frente a Chained Together:** lá a corrente é um obstáculo de plataforma. Aqui ela é a arma, e o desafio é lutar em dupla, não só escalar.

## Inspirações

- **Hades:** mecânica, ritmo de combate e loop de runs com progressão no lobby.
- **It Takes Two:** co-op feito para duas pessoas, em que cada um depende do outro.
- **Portal (co-op):** puzzles que só se resolvem com coordenação.
- **Chained Together:** o vínculo físico entre os jogadores como base de tudo.

## Próximos passos

- Upgrades da arma e o arremesso da serra.
- Primeiros bosses e as relíquias.
- Lobby com NPC e loja.
- Árvores de habilidade dos irmãos.
- Mais puzzles, mecânicas de mapa e inimigos.
- Co-op online (roadmap).

## Decisões em aberto

1. **O que se perde ao morrer?** Habilidades e armas são permanentes. O que fica em jogo numa run: as moedas, o andar alcançado, upgrades temporários da run?
2. **Arremesso e corrente:** a proposta é que arremessar a serra tenha o mesmo custo de quando a corrente arrebenta: a dupla fica desarmada até ir buscá-la junta. Isso transforma o arremesso numa aposta.
3. **Escudo quando separados:** proposta de ser a defesa do momento em que a dupla está sem a serra.
4. **Onde está Hela e o Mjölnir:** se a escalada começa em Helheim, Hela fugiu com o martelo para o topo? Nesse caso o Mjölnir seria a relíquia final (Asgard), e não de um boss intermediário.
5. **NPC do lobby:** como Brokkr e Eitri são os protagonistas, o NPC precisa ser outro. Sugestão: **Ratatoskr**, o esquilo que corre de cima a baixo da Yggdrasil levando recados, como mercador viajante.
6. **Escopo inicial:** quantos reinos e bosses para a primeira versão?
7. **Plataforma:** PC (Steam) primeiro, consoles depois?

---

*Os dados de mercado foram reescritos a partir das fontes citadas, para cumprir as restrições de licença de conteúdo.*