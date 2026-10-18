# Requirements Document

## Introduction

O editor de salas (`editor.html` + `js/editor/EditorApp.js`) ja calcula e exibe os possiveis pontos de spawn dos jogadores (um por porta ativa, e o centro na sala inicial) na aba "Spawns". Hoje essa exibicao e apenas informativa. Ao testar a sala no jogo (playtest), os jogadores sempre surgem no centro da sala via `getPlayerSpawnPositions("CENTER", ...)` em `Game.js#newDungeon`, com fallback para um tile seguro (`ensureSafeSpawn`).

Na dungeon real, o spawn respeita a direcao de origem dos jogadores: ao sair por uma porta, entram na proxima sala pela porta oposta (`Game.js#transitionThroughDoor`). Esse comportamento deve permanecer intacto para os mapas salvos.

### Objetivo

Permitir que, no editor, o autor **selecione** um dos possiveis spawns e use essa escolha **apenas durante o teste (playtest)**, simulando os jogadores chegando por aquela direcao. A selecao nao e gravada no mapa salvo e nao afeta o comportamento da dungeon real.

## Requirements

### US1 - Selecionar um spawn na aba "Spawns" do editor
Como autor de salas, quero poder clicar em um dos spawns exibidos para seleciona-lo, de modo que o teste (playtest) comece com os jogadores naquele ponto.

Criterios de aceite:
1. Cada spawn exibido na aba "Spawns" (um por porta ativa; e o centro na sala inicial) e clicavel e selecionavel.
2. Apenas um spawn pode estar selecionado por vez (selecao exclusiva).
3. Ha feedback visual claro de qual spawn esta selecionado, tanto no card da lista quanto sobre o canvas do editor.
4. Existe uma selecao padrao valida sempre que a sala muda (ex.: centro para sala inicial; primeira porta ativa caso contrario) - nao ha estado "nenhum spawn selecionado" que impeca o teste.
5. Trocar de forma/variacao da sala atualiza a lista e redefine a selecao padrao de forma consistente.

### US2 - Usar o spawn selecionado ao testar (playtest)
Como autor de salas, quero que, ao clicar em "Testar no Jogo", os jogadores comecem no spawn que selecionei, simulando a entrada por aquela direcao.

Criterios de aceite:
1. Ao iniciar o playtest, a escolha de spawn e repassada ao jogo (via `sessionStorage`, junto aos dados da sala).
2. O `Game.js`, no caminho de playtest (`newDungeon`), usa o spawn selecionado em vez de fixar `CENTER`.
3. O mapeamento de direcao e consistente com a engine: as direcoes de porta (N/S/E/W) usam `getPlayerSpawnPositions(dir, ...)`; o centro mapeia para `CENTER`.
4. O `ensureSafeSpawn` (reposicao em tile seguro) permanece como fallback quando o tile escolhido for um buraco/invalido.

### US3 - A selecao e apenas para teste e nao vaza para o mapa salvo
Como autor de salas, quero que a selecao de spawn sirva so para teste, sem alterar o mapa salvo nem o comportamento da dungeon real.

Criterios de aceite:
1. A selecao de spawn NAO e incluida no JSON exportado/salvo da peca (`_exportJSON` e no payload gravado pelo servidor `serve.py`).
2. O comportamento de spawn na dungeon real (`transitionThroughDoor`, direcao oposta a porta de origem) permanece inalterado.
3. O dado de spawn escolhido e transmitido apenas no payload de playtest (estado temporario em `sessionStorage`), nao no catalogo de pecas (`/map`).

### US4 - Persistencia leve da escolha entre sessoes de edicao (desejavel)
Como autor de salas, quero que a ultima escolha de spawn seja lembrada ao recarregar o editor, para nao precisar reselecionar a cada teste.

Criterios de aceite:
1. A escolha de spawn pode ser persistida junto ao estado da cena (`localStorage`), como uma preferencia de edicao.
2. Ao restaurar a cena, se a direcao escolhida ainda existir como porta ativa, ela e reaplicada; caso contrario, cai na selecao padrao.
3. Essa persistencia e conveniencia de edicao e nao afeta o mapa salvo.

### Fora de escopo
- Permitir posicionar o spawn em um tile arbitrario (livre) - a selecao e restrita aos spawns possiveis ja calculados.
- Alterar a logica de spawn da dungeon real (`transitionThroughDoor`).
- Spawn de inimigos ou outros elementos - apenas o spawn dos jogadores.

## Glossary
- **Playtest**: modo de teste do editor em que a sala atual e carregada isoladamente no jogo (`index.html?playtest=true`); as transicoes de porta ficam desativadas.
- **Spawn possivel**: posicao de spawn dos jogadores associada a uma porta ativa (direcao N/S/E/W) ou ao centro (sala inicial), calculada por `getPlayerSpawnPositions`.
- **entryDir**: direcao de entrada usada pela engine para escolher o spawn; na dungeon real e a porta oposta a de saida; no playtest sera a direcao selecionada no editor.
- **ensureSafeSpawn**: reposiciona um player no tile de piso seguro mais proximo quando o spawn escolhido cai sobre um buraco/sem piso.
- **transitionThroughDoor**: logica da dungeon real que move os jogadores para a sala vizinha e os faz entrar pela porta oposta a de origem.