# Design — Sala Início (core loop)

Status: approved (grill 2026-10-28/29). Umbrella design; each slice in section 9 has its own task folder.
Base map: `map/demo/inicial.json` (one 30×30 room).

## 1. Fluxo do jogador

1. Spawn embaixo à esquerda, em (2,26) e (4,26). Os jogadores começam **sem cabo e sem serra**, no mesmo estado de "cabo arrebentado": andam livres e sem dash.
2. Andam para a direita. **Baú 1**, em (21,26), abre sozinho quando qualquer jogador chega a até ~2 tiles e solta **10 de sucata**.
3. **Bigorna**, em (24,26): um dos dois aperta interagir e o menu abre. Eles craftam a **Serra** por 10.
4. **Cinemática da serra**. Depois dela, os **dois** precisam chegar perto da serra para pegá-la. O cabo se forma com a animação de reconexão ampliada.
5. Sobem pelo corredor vertical até o **Salão**. Quando os dois estão na zona, a **corda 1 arrebenta sozinha**, as grades descem e cai a leva 1.
6. As cordas 2, 3 e 4 a dupla corta com a serra. Cada corte solta a próxima leva. No 4º corte, a gaiola cai e quebra. Com todos os inimigos mortos, o **baú 2** (dentro dos destroços) abre e solta 15. As grades sobem.
7. Com cerca de 50 de sucata, voltam à primeira bigorna e compram melhorias.
8. Sobem até o **Topo**: o portão do boss está trancado e em destaque. O caminho previsto é a porta da direita (penhasco, exige dash). A porta da esquerda leva à sala das Botas (dash).

## 2. Sistemas

### Sucata (moeda)
- Fica num pote **compartilhado** pela dupla.
- Quando cai, fica 0,4 s parada e depois é atraída pelo jogador mais próximo dentro de ~2,5 tiles.
- Ao limpar uma leva, a sucata que sobrou no chão é puxada para a dupla.
- HUD: contador único no topo, entre os retratos, com número rolando e um pulinho a cada ganho. O game feel detalhado fica para depois.

### Morte e progressão
- Quando um jogador perde todas as vidas, a dupla **renasce no spawn do `inicial`** com as **3 vidas cheias**. A serra volta conectada se já foi craftada.
- **A sucata zera.** Itens e melhorias ficam.
- Eventos concluídos continuam concluídos: baús abertos, encontro do salão vencido.
- Um encontro interrompido no meio volta ao começo: cordas e gaiola são restauradas.
- Não há save entre sessões do jogo.

### Bigorna e forja
- O catálogo global de receitas e melhorias fica em `js/config/ForgeConfig.js`. Cada bigorna, no Editor 2.0, escolhe quais receitas oferece.
- Menu:
  - qualquer jogador perto da bigorna abre com interagir;
  - o jogo **pausa** e os dois controlam o mesmo cursor (teclado ou controle);
  - mostra o saldo, os itens e as melhorias com custo;
  - fecha com B ou com interagir;
  - não abre com inimigos vivos na zona.
- Itens apagados:
  - uma melhoria fica apagada enquanto o item dela não foi liberado;
  - um item ou melhoria também fica apagado quando falta sucata.
- Primeira bigorna: Serra e as melhorias dela. Bigorna da sala das Botas: só as botas e as melhorias delas (por ora).

### Melhorias da serra
| Melhoria | Níveis | Custo | Efeito por nível |
|---|---|---|---|
| Serra (craft) | 1 | 10 | libera a arma |
| Tamanho | 3 | 8 / 14 / 22 | +20% no raio do disco e no raio de acerto |
| Elasticidade | 3 | 8 / 14 / 22 | +15% na distância de tensão (165) e de ruptura (240) |
| Peso | 2 | 10 / 18 | arrasto de 2 → 3 → 4 tiles; velocidade arrastando de 40% → 55% → 70% |
| Serra dupla | 1 | 30 | acima de ~85% da distância de ruptura, a serra se divide em duas (1/3 e 2/3 do cabo) e volta a uma quando eles se aproximam |

O total de todas as melhorias é ~146, e o salão rende ~50. A escolha importa.

### Arrastar a serra (base da melhoria Peso)
1. Funciona só com o cabo arrebentado e a serra largada.
2. Um jogador sozinho segura interagir perto da serra e se prende a ela por um cabo curto.
3. Ele anda devagar. A serra vai arrastada, sem girar e sem cortar.
4. Passada a distância limite, o cabo curto arrebenta e a serra cai de novo.
5. Se o parceiro chegar perto da serra durante o arrasto, os dois reconectam normalmente.

### Baús
- Abrem por proximidade de qualquer jogador. A tampa abre com squash, e a sucata salta em arco e quica.
- O baú 2 está dentro da gaiola. Fica visível nos destroços quando ela cai e abre quando a última leva morre.

### Props sólidos: colisão e ordem de render
Vale para a bigorna e os baús (e para qualquer prop marcado `solid` no futuro).
- **Colisão só na base:** a caixa de colisão é a pegada do prop no chão, não a arte inteira. Os pés do jogador (`p.y + ~14`, como `HOLE_FALL.footOffset`) não entram nela, então ninguém sobe em cima do prop.
- **Ordem de render por y:** esses props saem da camada de chão (hoje `PropSprites` desenha antes das entidades) e entram na lista de `drawables` ordenada por `y` em `Game._renderView`, com a chave de ordenação na base do prop.
  - Jogador com os pés acima da base aparece **atrás** do prop (a arte cobre o jogador).
  - Jogador com os pés abaixo da base aparece **na frente**.
- O mesmo padrão já existe para a placa de pressão (`PressureButton.sortY` / `buttonOccluders`).
- A gaiola pendurada é desenhada acima de tudo (está no alto), com a sombra na camada de chão. Os destroços ficam na camada de chão e não têm colisão.

### Eventos por sala (zonas e encontros)
- Nos mapas do Editor 2.0, **entrar na sala não gera mais inimigos**. O inimigo pertence a um **encontro**, que tem um gatilho e uma lista de levas.
- O modo clássico, procedural, não muda.
- A sala só tranca, com grades nos acessos da zona, enquanto um encontro está ativo.
- O Editor 2.0 ganha duas ferramentas: **Zona** (retângulo com id) e **Encontro** (gatilho e levas: tipos e quantidade).
- Os eventos são escritos em **código**, num script por sala, dentro de um subsistema novo construído no `Game` (ADR 0002). O script referencia os ids de zona e de encontro.
- "Entrar na zona" significa os **dois** jogadores dentro dela.

### Gaiola com cordas (encontro do salão)
- Uma gaiola pendurada no centro, presa por 4 cordas amarradas ao chão.
- A corda 1 arrebenta sozinha, com animação. As outras são cortadas quando o cabo ou o disco passa até ~1,5 tile da estaca, sem precisar estar girando. Perto da dupla, a corda vibra e brilha.
- Cada corte: a gaiola inclina, a porta abre e a próxima leva despenca, com sombra, impacto e poeira.
- A ordem das levas segue o **número do corte**, não a corda cortada.
- Cortar com a leva anterior viva acumula as duas. Não há inimigos de bônus nem texto de "Onda".
- 4º corte: a gaiola cai e quebra. Os destroços não têm colisão e somem aos poucos.
- Grades descem quando a corda 1 arrebenta e sobem quando a gaiola já caiu e não sobra inimigo vivo.

| Corte | Leva |
|---|---|
| 1 (sozinho) | 3 Demônios |
| 2 | 1 Monstro de Sangue + 3 Demônios |
| 3 | 1 Cavaleiro Negro B + 2 Demônios |
| 4 | 3 Demônios + 1 Monstro de Sangue + 1 Cavaleiro Negro B |

### Falas e balões
- O balão sai acima do personagem que fala, com texto letra a letra e um blip de voz para cada um.
- O jogo **não pausa** fora das cinemáticas. O texto avança por tempo, e interagir acelera.
- O retrato do HUD troca de expressão enquanto o personagem fala.
- O ícone do botão aparece dentro do balão nas dicas, de acordo com o dispositivo de cada jogador.
- Os personagens **não têm nomes**: são Amarelo e Azul.
- Dicas por "primeira vez" que algo acontece ficam fora desta versão.

### Idiomas
- Tabelas `js/i18n/pt-BR.js` e `en.js`, com `t('chave')`. A demo roda em **pt-BR**.
- O seletor de idioma no menu de pausa vem depois. O editor continua só em pt-BR.

## 3. Level design — posições (ajustáveis no editor)
| Objeto | Tile (col,row) |
|---|---|
| Spawn P1 / P2 | (2,26) / (4,26) |
| Baú 1 | (21,26) |
| Bigorna 1 | (24,26) |
| Gaiola e baú 2 | (14,12) |
| Corda 1 (arrebenta sozinha) | (16,15) |
| Corda 2 | (3,10) |
| Corda 3 | (4,16) |
| Corda 4 | (27,10) |

Zonas: **Bigorna** (faixa de baixo), **Salão** (meio), **Topo** (faixa de cima). Grades nos acessos do salão: corredor vertical (cols 15-17) e corredor norte (cols 21-24).

Outros pontos do mapa:
- **Nicho com buracos** à direita do salão: baú pequeno opcional, alcançável com dash quando a dupla voltar com as botas.
- **Portão do boss:** trancado e em destaque desde o começo.
- **Salas Botas e Penhasco:** salas separadas, ligadas por porta. O conteúdo delas fica para outra conversa.

## 4. Cinemática da serra (~4 s, sem pular na primeira vez)
1. O menu fecha, o letterbox entra, os jogadores congelam e a câmera dá zoom na bigorna.
2. Três marteladas com faíscas, "clang" e shake crescente.
3. A serra salta girando, cai sobre a bigorna com squash e brilha num pulso.
4. O letterbox sai e entra a fala "Juntos, perto da serra!".
5. Os dois chegam perto, o cabo se estende até a serra e aparece o título "SERRA".

## 5. Valores de sucata
| Fonte | Sucata |
|---|---|
| Demônio | 1 |
| Monstro de Sangue | 3 |
| Cavaleiro Negro B | 5 |
| Gaiola quebrada | 2 |
| Baú 1 | 10 |
| Baú 2 | 15 |

## 6. Roteiro de falas (em teste, pode ser removido)
| Momento | Quem | Fala |
|---|---|---|
| Início | Amarelo | "Que lugar é esse?" |
| | Azul | "Tem algo brilhando ali à direita." |
| Baú 1 abre | Azul | "Sucata! Deve servir pra algo." |
| Perto da bigorna | Amarelo | "Uma bigorna... [E] pra usar." |
| Serra pronta | Azul | "Juntos, perto da serra!" |
| Conectou | Amarelo | "Longe demais e o cabo arrebenta." |
| | Azul | "Se arrebentar, [segure E] pra arrastar." |
| Corda 1 arrebenta | Amarelo | "Ainda tem cordas segurando aquilo..." |
| Leva 1 limpa | Azul | "Corta a próxima com a serra!" |
| Baú 2 abre | Amarelo | "Já dá pra melhorar a serra lá embaixo." |
| Topo, portão do boss | Azul | "Trancado... e algo respira lá dentro." |
| Topo, porta da direita | Amarelo | "Vamos pela direita." |

## 7. Assets (placeholders agora; lista de pedidos em cada fatia)
- Arte: gaiola (pendurada, inclinada, quebrada), corda e estaca, sucata (no chão e ícone do HUD), balão de fala, ícones de botão de teclado e controle, grade do salão.
- Sons: corda arrebentando ou cortada, corrente, gaiola caindo, coleta de sucata, martelada, blip de voz para cada personagem, compra na bigorna.

## 8. Fatos do código que o design assume (verificados em 2026-10-28)
- `map/demo/active.json` aponta para `demo_campaign.json`, não para `inicial.json`.
- O `Chain` sempre começa conectado e não tem flag para "sem serra". A tuning do cabo está fixa no construtor do `Game` (bug #11).
- Interagir: P1 `e`, P2 `shiftright`, botão 2 do controle (`InputHandler.pollGamepads`). Proximidade `DEMO.interactionRadius` 88 px.
- Props não têm colisão em jogo (`solid` só é lido pelo editor). Eles são desenhados antes das entidades. As entidades já são ordenadas por `y` em `Game._renderView`.
- `Room.spawnEnemies` gera todos os inimigos uma vez. Não existe sistema de ondas.
- `js/ui/SpeechBubble.js` e `PixelFont.js` existem, usados só pelo trailer.

## 9. Entrega
Cada fatia sai da `main` com sua pasta em `.agents/tasks/` e termina jogável.

1. **`feat/scrap-chest`**: sucata, ímã, contador no HUD, baú por proximidade, props sólidos (colisão de base + ordem de render), `i18n` e balões de fala.
2. **`feat/anvil-forge`**:
   - começar sem serra;
   - menu da bigorna, `ForgeConfig` e a seleção por bigorna no editor;
   - cinemática da serra;
   - melhorias de Tamanho, Elasticidade e Serra dupla;
   - valores do cabo movidos para config (fecha o bug #11).
3. **`feat/saw-drag`**: arrasto e a melhoria Peso.
4. **`feat/room-events`**: zonas e encontros no editor, gaiola, cordas e grades, sistema de script por sala, regra de morte.
5. **`feat/inicio-map`**: montagem do `inicial`, roteiro, portas para placeholders e `active.json` apontando para ele.

ADRs:
- **0011**: eventos e encontros por sala, no lugar do spawn ao entrar.
- **0012**: progressão da run (sucata, itens persistentes, morte).
- **0013**: idiomas.

## 10. Fora do escopo
Conteúdo das salas Botas e Penhasco, as botas e o dash ligado a elas, a sala final com todas as melhorias, boss, o fosso como gatilho, dicas por "primeira vez", seletor de idioma, game feel detalhado da coleta.
