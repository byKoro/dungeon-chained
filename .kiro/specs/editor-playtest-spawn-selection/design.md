# Design Document

## Overview
Permitir que o autor selecione um dos spawns possiveis no editor e use essa escolha **apenas no playtest**. A selecao e um estado de edicao (nao entra no mapa salvo), repassado ao jogo pelo payload de playtest em `sessionStorage`, e consumido pelo `Game.js` no caminho de playtest. A dungeon real e o mapa salvo nao mudam.

## Goals and Non-Goals

**Goals**
- Tornar os spawns exibidos selecionaveis (clique) com destaque visual no card e no canvas.
- Usar a direcao selecionada como `entryDir` no spawn do playtest, mantendo o fallback `ensureSafeSpawn`.
- Persistir a escolha como conveniencia de edicao (localStorage), sem afetar o JSON da peca salva.

**Non-Goals**
- Posicionamento livre de spawn em tile arbitrario.
- Alterar `transitionThroughDoor` (dungeon real) ou qualquer logica de spawn fora do playtest.
- Incluir a selecao no `_exportJSON` nem no payload gravado por `serve.py`.

## Architecture
O recurso isola as mudancas em tres pontos de toque, conectados por um canal temporario (`sessionStorage`), sem tocar na logica da dungeon real.

Fluxo de dados:
- `[Editor] --testSpawn--> sessionStorage["editor_custom_room"] --parse--> RoomManager.testSpawn --entryDir--> Game.newDungeon (ramo playtest)`

Pontos:
- O editor ja calcula os spawns possiveis; adiciona a selecao e serializa `testSpawn` apenas no payload de playtest.
- O `RoomManager`, que ja faz o parse do playtest, expoe `this.testSpawn`.
- O `Game`, no ramo `this.playtest`, usa `this.rooms.testSpawn ?? "CENTER"` como `entryDir`.
- A dungeon real (`transitionThroughDoor`) e o `_exportJSON` ficam fora do fluxo.

Principio: o override e estado de teste; nada e persistido no mapa salvo.

## Components and Interfaces

- **Editor (`js/editor/EditorApp.js`)**: mantem `this.selectedSpawnDir` e normaliza `sp.dir` em `_getPlayerSpawns()`. Expoe a selecao no payload de playtest via `playtestData.testSpawn`.
- **RoomManager (`js/rooms/RoomManager.js`)**: le o override em `reset()` e expoe `this.testSpawn` (dir ou `null`).
- **Game (`js/Game.js`)**: em `newDungeon()`, no ramo `this.playtest`, usa `entryDir = this.rooms.testSpawn ?? "CENTER"`.

Contrato de interface:
- Editor -> `sessionStorage["editor_custom_room"]`: adiciona `testSpawn: "N" | "S" | "E" | "W" | "CENTER"` (ou omite se vazio).
- `RoomManager.testSpawn` -> Game: string dir ou `null`.
- Dominio de dir: `"CENTER" | "N" | "S" | "E" | "W"` (mesmo dominio de `getPlayerSpawnPositions`).

### Mudancas no Editor (js/editor/EditorApp.js)
1. **Estado e normalizacao**: no `constructor()` adicionar `this.selectedSpawnDir = null;`. Em `_getPlayerSpawns()`, adicionar `dir` em cada spawn: center -> `dir: "CENTER"`; portas -> `dir` = a letra da porta.
2. **Selecao valida + padrao**: nova funcao `_ensureSpawnSelection(spawns)` que mantem `this.selectedSpawnDir` se ainda existir em `spawns` (por `sp.dir`); senao define o padrao (`"CENTER"` se existir; senao o `sp.dir` do primeiro spawn na ordem `N, S, W, E`). Chamada no inicio de `_updateSpawnsListUI()`.
3. **Cards clicaveis**: em `_updateSpawnsListUI()`, apos `_ensureSpawnSelection`, cada `.spawn-card` recebe `data-spawn-dir`, classe `selected` quando ativo, `cursor: pointer` e `onclick = () => { this.selectedSpawnDir = sp.dir; this._updateSpawnsListUI(); this.render(); }`. No selecionado, rotulo "Selecionado p/ teste". CSS `.spawn-card.selected` em `css/style.css`.
4. **Destaque no canvas**: em `_renderPlayerSpawns(ctx, tileW)`, para o spawn onde `sp.dir === this.selectedSpawnDir`, desenhar um anel extra branco/dourado nos dois tiles; baixar levemente a opacidade dos demais.
5. **Passagem ao jogo**: em `_playtestInGame()`, apos montar `playtestData`, adicionar `if (this.selectedSpawnDir) playtestData.testSpawn = this.selectedSpawnDir;`. Nao adicionar em `_exportJSON()`.
6. **Persistencia de edicao (US4)**: em `_sceneToData()` incluir `selectedSpawnDir`; em `_importFromData()` ler `data.selectedSpawnDir`. A validacao de porta ativa e feita por `_ensureSpawnSelection` apos o import.

### Mudancas no Jogo
**js/rooms/RoomManager.js**
- Em `reset()`, definir `this.testSpawn = null;` no inicio (nao vazar entre dungeons normais). No bloco `if (isPlaytest && raw)`, apos o parse de `data`, guardar `this.testSpawn = data.testSpawn || null;`.

**js/Game.js**
- Em `newDungeon()`, trocar `const spawns = getPlayerSpawnPositions("CENTER", rect.x, rect.y, TILE);` por:
  ```
  const entryDir = (this.playtest && this.rooms.testSpawn) ? this.rooms.testSpawn : "CENTER";
  const spawns = getPlayerSpawnPositions(entryDir, rect.x, rect.y, TILE);
  ```
- O bloco `if (this.playtest) { ensureSafeSpawn(p1); ensureSafeSpawn(p2); }` permanece identico (fallback para buraco). `transitionThroughDoor()` nao e tocado.

## Data Models

| Onde | Campo | Valores | Observacao |
|---|---|---|---|
| Editor | `this.selectedSpawnDir` | `"CENTER" \| "N" \| "S" \| "E" \| "W" \| null` | Selecao atual; `null` = usar o padrao |
| Spawn (normalizado) | `sp.dir` | `"CENTER"` ou letra da porta | Adicionado em `_getPlayerSpawns` |
| Playtest payload | `playtestData.testSpawn` | dir ou omitido | Em `_playtestInGame`, vai ao `sessionStorage` |
| RoomManager | `this.testSpawn` | dir ou `null` | Definido em `reset()`; `null` se nao for playtest |
| localStorage cena | `selectedSpawnDir` | dir | Em `_sceneToData`/`_importFromData`; conveniencia, NUNCA em `_exportJSON` |

Mapeamento de direcoes: centro -> `"CENTER"`; portas -> `"N"|"S"|"E"|"W"` (mesmo dominio de `getPlayerSpawnPositions`).

### Fluxo: selecao -> playtest -> spawn
1. Autor clica num card de spawn -> `this.selectedSpawnDir = sp.dir`.
2. `_playtestInGame()` adiciona `playtestData.testSpawn` ao `sessionStorage["editor_custom_room"]`.
3. `RoomManager.reset()` faz parse de `editor_custom_room` e guarda `this.testSpawn`.
4. `Game.newDungeon()`, no ramo `this.playtest`, usa `entryDir = this.rooms.testSpawn ?? "CENTER"` em `getPlayerSpawnPositions(entryDir, ...)`.
5. `ensureSafeSpawn(p1/p2, rect)` continua como fallback para tiles-buraco.

## Correctness Properties

### Property 1: A selecao nao vaza para o mapa salvo
A selecao (`selectedSpawnDir`/`testSpawn`) nunca e serializada em `_exportJSON`; so aparece no payload de playtest (`sessionStorage`) e, como conveniencia, no estado de cena do editor (`localStorage`).
**Validates: Requirements 3.1**

### Property 2: Comportamento padrao preservado sem override
Sem `testSpawn` (ausente/nulo), o spawn do playtest usa `"CENTER"`, igual ao comportamento atual. Tambem garante selecao padrao valida ao mudar de sala.
**Validates: Requirements 1.4**

### Property 3: Fallback de spawn seguro mantido
`ensureSafeSpawn` permanece ativo no playtest para qualquer direcao escolhida, reposicionando players sobre buracos.
**Validates: Requirements 2.4**

### Property 4: Dungeon real inalterada
`transitionThroughDoor` ignora `testSpawn`; o spawn real continua pela porta oposta a de origem.
**Validates: Requirements  3.2**

### Property 5: Selecao sempre valida
`_ensureSpawnSelection` atribui o padrao quando a direcao selecionada deixa de existir como porta ativa.
**Validates: Requirements 4.2**

### Property 6: Override nao persiste entre dungeons normais
`RoomManager.testSpawn` e zerado a cada `reset()`, evitando vazar o override para a dungeon real.
**Validates: Requirements  3.3**

## Error Handling
- **Spawn selecionado cai em buraco:** o proprio `ensureSafeSpawn` reposiciona para o tile seguro mais proximo; sem logica nova.
- **Troca de forma/variacao:** `_updateSpawnsListUI` roda de novo e `_ensureSpawnSelection` redefine o padrao se a direcao antiga sumir; mantem se ainda existir.
- **`testSpawn` invalido/ausente:** fallback `"CENTER"` (comportamento atual).
- **Selecao persistida aponta porta inexistente apos reload:** `_ensureSpawnSelection` cai no padrao.
- **Dead-end (1 porta):** so um spawn; padrao = essa porta.
- **Sala inicial (start):** centro + portas; padrao = `"CENTER"` (comportamento atual).

## Feedback visual
- Card selecionado: borda/box-shadow de destaque + rotulo "Selecionado p/ teste"; cursor pointer em todos os cards.
- Canvas: anel branco extra nos tiles do spawn selecionado; opacidade levemente reduzida nos demais (sem perder legibilidade).
- Toggle "Exibir Icons de Spawn" (`toggle-show-spawns`) continua controlando o desenho no canvas; a selecao via cards funciona independentemente.

## Riscos e compensacoes
- **Leitura de sessionStorage no Game:** optou-se por expor `testSpawn` via `RoomManager` (que ja faz o parse) em vez de ler `sessionStorage` direto no `Game.js`. Centraliza o parse do playtest e mantem o Game desacoplado do formato de armazenamento.
- **Opacidade dos spawns nao selecionados:** reduzir pouco para destacar o selecionado sem esconder informacao util.
- **Nao validar `testSpawn` contra portas ativas no jogo:** o editor so envia direcoes validas; `getPlayerSpawnPositions` retorna posicao valida para qualquer dir, entao e defensivo e sem risco.

## Testing Strategy
- **Manual (editor):** ao mudar de forma, o spawn padrao e atribuido; clicar em cada card atualiza o destaque no card e no canvas; recarregar o editor mantem a escolha (localStorage) quando a porta ainda existe.
- **Playtest:** selecionar "Entrada Sul" e testar -> os jogadores surgem proximos a porta Sul (com `ensureSafeSpawn` se houver buraco); selecionar "Centro" numa sala start -> spawn central (igual ao atual).
- **Dungeon real:** continuar entrando pela porta oposta a de saida (sem regressao); o JSON exportado pela peca nao contem `testSpawn`/`selectedSpawnDir`.
- **Automatizado:** adicionar/estender `tests/` cobrindo que `_exportJSON` nao inclui o campo de selecao e que o mapeamento `dir` de `_getPlayerSpawns` bate com `getPlayerSpawnPositions`.