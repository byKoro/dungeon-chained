# Implementation Plan — Refatoração UI/UX do Editor de Salas (Dungeon Chained)

Projeto front-end vanilla (HTML/CSS/JS ES modules, sem build step, sem testes automatizados).
Verificação é **visual/manual no browser** (servir a pasta e abrir `editor.html`; o projeto já usa `python serve.py` para habilitar save/delete — porém save/delete NÃO estão no escopo e não precisam de servidor para validar a UI). Para a validação visual basta um servidor estático qualquer (`python -m http.server`) e abrir `/editor.html`.

Arquivos a alterar (SOMENTE estes três):
- `editor.html` — estrutura
- `css/editor.css` — estilos
- `js/editor/EditorApp.js` — lógica (classe `RoomEditor`, 2200 linhas)

Regra de ouro: **toda remoção de elemento HTML exige guard clause ou remoção da referência JS correspondente**. Nenhum `getElementById` pode retornar `null` e quebrar. A persistência (`_saveState`/localStorage) e o playtest (`_playtestInGame`) devem continuar intactos.

---

## Inventário de `getElementById` / seletores em EditorApp.js (base para os guards)

Mapeamento completo das referências DOM e o que acontece com cada uma. "REMOVIDO" = elemento sai do HTML, referência JS deve sair ou virar guard. "MANTIDO" = elemento continua.

| ID / seletor | Onde é usado (método, ~linha) | Elemento no novo HTML? | Ação |
|---|---|---|---|
| `roomCanvas` | constructor | MANTIDO | nenhuma |
| `canvas-container` | constructor | MANTIDO | nenhuma |
| `shape-name` | `_updateShapeNavUI` (~232) | MANTIDO (movido p/ centro navbar) | nenhuma (já tem guard `if (nameEl)`) |
| `shape-status` | `_updateShapeNavUI` (~233) | MANTIDO (centro navbar, opcional) | nenhuma (já tem guard) |
| `variant-label` | `_updateShapeNavUI` (~234) | MANTIDO (base do grid) | nenhuma (já tem guard) |
| `shape-prev` / `shape-next` | `_initEvents` bind (~1455) | MANTIDO (laterais do grid) | nenhuma (bind usa helper com guard) |
| `variant-prev`/`variant-next`/`variant-new` | `_initEvents` bind (~1457) | MANTIDO (base do grid) | nenhuma |
| `btn-save-room` / `btn-delete-room` | `_initEvents` bind (~1459) | MANTIDO | nenhuma |
| `.tab-btn` (querySelectorAll) | `_initEvents` (~1463) | **SUBSTITUÍDO** por cabeçalhos de card `h2.group-title` | reescrever o handler (ver item 8) |
| `.tab-panel` (querySelectorAll) | `_initEvents` (~1465) | MANTIDO (vira corpo colapsável do card) | handler ajustado (item 8) |
| `btn-clear-holes` | `_initEvents` (~1473) | MANTIDO (sem emoji) | nenhuma |
| `[name='hazard-choice']` | `_initEvents` (~1481) | MANTIDO | nenhuma |
| `btn-clear-hazards` | `_initEvents` (~1484) | MANTIDO | **remover chamada a `_updateValidationChecklist()`** |
| `lock-rule` | `_initEvents` (~1493), `_updateUIFromState` (~447) | MANTIDO | nenhuma (já tem guard) |
| `[name='enemy-choice']` | `_initEvents` (~1499) | MANTIDO | nenhuma |
| `btn-clear-enemies` | `_initEvents` (~1502) | MANTIDO | **remover `_updateValidationChecklist()`** |
| `btn-distribute-circle` | `_initEvents` (~1509) | MANTIDO (sem emoji) | nenhuma |
| `btn-clear-torches` | `_initEvents` (~1514) | MANTIDO | **remover `_updateValidationChecklist()`** |
| `[name='prop-choice']` | `_initEvents` (~1524) | MANTIDO | nenhuma |
| `btn-clear-props` | `_initEvents` (~1528) | MANTIDO | **remover `_updateValidationChecklist()`** |
| `toggle-scatter-props` | `_initEvents` (~1537), `_syncScatterUI` (~1830) | MANTIDO | nenhuma |
| `scatter-density` / `scatter-density-row` / `scatter-density-val` | `_initEvents`/`_syncScatterUI` | MANTIDO | nenhuma |
| `props-manual-section` | `_syncScatterUI` (~1835) | MANTIDO | nenhuma |
| `toggle-show-spawns` | `_initEvents` (~1556) | MANTIDO | nenhuma (já tem guard) |
| `toggle-spawns` | `_initEvents` (~1557) | MANTIDO | nenhuma (já tem guard) |
| `toggle-grid` | `_initEvents` (~1575) | MANTIDO | nenhuma |
| `toggle-coords` | `_initEvents` (~1576) | **REMOVIDO** | **remover a linha do binding** (item 12) |
| `toggle-doors` | `_initEvents` (~1577) | MANTIDO | nenhuma |
| `btn-zoom-in`/`btn-zoom-out`/`btn-zoom-reset`/`btn-fit-screen` | `_initEvents` (~1580) | MANTIDO (sem emoji) | nenhuma |
| `prop-id` | `_initEvents` (~1587), `_updateUIFromState` (~441) | **REMOVIDO** | **remover linha de bind + remover linha em `_updateUIFromState`** |
| `prop-name` | `_initEvents` (~1588), `_updateUIFromState` (~442) | **REMOVIDO** | idem |
| `prop-cols` | `_updateUIFromState` (~443) | **REMOVIDO** | **remover linha em `_updateUIFromState`** |
| `prop-rows` | `_updateUIFromState` (~444) | **REMOVIDO** | idem |
| `prop-kind` | `_initEvents` (~1589), `_updateUIFromState` (~445) | **REMOVIDO** | remover bind + linha |
| `prop-type` | `_initEvents` (~1590), `_updateUIFromState` (~446) | **REMOVIDO** | remover bind + linha |
| `holes-count` | `_updateUIFromState` (~450) | MANTIDO | nenhuma (adicionar guard por segurança) |
| `btn-quick-copy` | `_initEvents` (~1596) | **REMOVIDO** | **remover bind** (já tem guard `if (quickCopy)`, mas remover linha) |
| `btn-export-json` | `_initEvents` (~1598) | **REMOVIDO** | **remover bind** |
| `btn-import-json` | `_initEvents` (~1599) | **REMOVIDO** | **remover bind** |
| `code-output` | `_updateCodeOutput` (~762), `_copyCodeToClipboard` (~1850) | **REMOVIDO** | **refatorar `_updateCodeOutput`→`_persistScene`** (item 2) |
| `modal-close-btn`/`modal-cancel-btn` | `_initEvents` (~1602) | MANTIDO (modal fica) | nenhuma |
| `btn-playtest` | `_initEvents` (~1606) | MANTIDO (sem emoji) | nenhuma |
| `btn-coverage` | `_initEvents` (~1521) | MANTIDO (sem emoji) | nenhuma (já tem guard) |
| `coverage-*` | `_initEvents` (~1522+) | MANTIDO | nenhuma |
| `status-coords` | `_onMouseMove` (~1620+) | MANTIDO | nenhuma |
| `status-dims` | `_updateUIFromState` (~467) | MANTIDO | nenhuma |
| `spawns-info-list` | `_updateSpawnsListUI` (~473) | MANTIDO | nenhuma (já tem guard) |
| `spawn-warning-box` | `_checkSpawnSafety` (~410) | **REMOVIDO** | **ver item 1: refatorar `_checkSpawnSafety`** |
| `stat-doors`/`stat-holes`/`stat-hazards`/`stat-enemies` | `_updateValidationChecklist` (~737+) | **REMOVIDO** | **remover método inteiro** (item 1) |
| `stat-spawns-safety` | `_checkSpawnSafety` (~411) | **REMOVIDO** | **ver item 1** |
| `hazard-count`/`hazards-list` | `_updateHazardsListUI` (~491) | MANTIDO | nenhuma (adicionar guards por segurança) |
| `enemy-count`/`enemies-list` | `_updateEnemiesListUI` (~552) | MANTIDO | nenhuma |
| `torch-count`/`torches-list` | `_updateTorchesListUI` (~596) | MANTIDO | nenhuma (já tem guard) |
| `prop-count`/`props-list` | `_updatePropsListUI` (~634) | MANTIDO | nenhuma (já tem guard) |
| `modal-box`/`modal-title`/`modal-textarea`/`modal-action-btn` | `_openImportModal`/`_closeModal` | MANTIDO (modal preservado, só o botão que o abre sai) | nenhuma |

> Observação importante: números de linha são **aproximados** (baseados no arquivo atual de 2200 linhas). O implementador deve localizar por nome de método/string, não confiar cegamente nos números.

---

## Plano ordenado

- [ ] 1. Remover a lógica de Checklist de Integridade e de alerta de spawn.
      No `EditorApp.js`: (a) **excluir o método `_updateValidationChecklist()`** inteiro (~linha 736–758, escreve em `stat-doors`/`stat-holes`/`stat-hazards`/`stat-enemies`). (b) **Remover todas as ~6 chamadas a `this._updateValidationChecklist()`** (em `_updateUIFromState`, `_updateHazardsListUI` handler de delete, `_updateEnemiesListUI` handler, `_updateTorchesListUI` handler, `_updatePropsListUI` handler, `btn-clear-*` handlers, `_addHazardAt`, `_addEnemyAt`, `_toggleTorchAt`, `_togglePropAt`, `_distributeEnemiesCircle`). Procurar literal `_updateValidationChecklist` e eliminar cada ocorrência. (c) **Refatorar `_checkSpawnSafety()`** (~linha 376–423): manter o cálculo de `warnings` se quiser, mas as referências a `document.getElementById("spawn-warning-box")` e `("stat-spawns-safety")` escrevem em elementos removidos — como ambos saem do HTML, a forma mais limpa é **transformar `_checkSpawnSafety` em no-op** (corpo vazio ou `return;`) OU adicionar guard clauses (`const warnBox = document.getElementById("spawn-warning-box"); if (!warnBox) return;`). Preferir guard clause no topo para não quebrar as ~4 chamadas existentes a `_checkSpawnSafety()`. Deixar as chamadas a `_checkSpawnSafety()` no lugar (viram no-op seguro).
      Files: `js/editor/EditorApp.js`
      Verify: `node --check js/editor/EditorApp.js` (sintaxe OK). No browser, abrir `editor.html`, colocar/remover inimigos e traps — console sem erros de `null` e UI responde.

- [ ] 2. Refatorar `_updateCodeOutput()` para preservar APENAS a persistência.
      O método (~linha 759–792) hoje escreve em `#code-output` E chama `this._saveState()` no fim. Como `#code-output` será removido: **substituir o corpo por um guard + persistência**. Opção escolhida: renomear o método para `_persistScene()` cujo corpo é só `this._saveState();`, e fazer um alias `_updateCodeOutput() { this._persistScene(); }` para não ter que editar as ~15 chamadas — OU manter o nome `_updateCodeOutput` e reduzir seu corpo a `this._saveState();`. **Decisão: manter o nome `_updateCodeOutput` e reduzir o corpo a apenas `this._saveState();`** (menor risco; todas as ~15 chamadas continuam válidas e a persistência continua a cada mutação). Remover todo o bloco que monta JSON/código e escreve em `out.textContent`. Rationale: minimiza alterações nas call sites e garante que localStorage siga sendo gravado a cada mutação.
      Files: `js/editor/EditorApp.js`
      Verify: `node --check`. No browser: editar a sala, recarregar a página (F5) e confirmar que a cena foi restaurada do localStorage (persistência intacta). Playtest ainda funciona.

- [ ] 3. Remover método `_copyCodeToClipboard()` e tratar `_exportJSON()`.
      `_copyCodeToClipboard` (~linha 1849) lê `#code-output` (removido) — **remover o método inteiro** (sua única chamada, o bind de `btn-quick-copy`, sai no item 4). `_exportJSON` (~linha 1857) pode ficar órfão sem problema (não lê DOM removido), mas como `btn-export-json` sai, ele fica sem chamador — **pode permanecer no código (órfão) ou ser removido**. Decisão: **manter `_exportJSON` como está** (órfão, inofensivo) para reduzir superfície de mudança. Remover apenas `_copyCodeToClipboard`.
      Files: `js/editor/EditorApp.js`
      Verify: `node --check`. Grep garante que não resta nenhuma chamada a `_copyCodeToClipboard`.

- [ ] 4. Limpar bindings órfãos em `_initEvents()` referentes ao que foi/será removido.
      Em `_initEvents` (~linha 1595–1600): **remover** as 3 linhas: o bloco `const quickCopy = ...; if (quickCopy) quickCopy.onclick = ...;` (btn-quick-copy), `document.getElementById("btn-export-json").onclick = ...;` e `document.getElementById("btn-import-json").onclick = ...;`. Também **remover** os binds de metadados `prop-id`/`prop-name`/`prop-kind`/`prop-type` (~linha 1587–1591) já que esses inputs saem (item 7/HTML). `_openImportModal` e `_importFromData` **permanecem** no JS (`_importFromData` é usado por `_loadCurrentShapeVariant`/`_loadSavedState`). Atenção: `btn-export-json`/`btn-import-json` eram acessados sem guard (`document.getElementById(...).onclick`) — ao remover o elemento, essas linhas lançariam `null`; por isso devem ser DELETADAS, não apenas o HTML.
      Files: `js/editor/EditorApp.js`
      Verify: `node --check`. No browser, console sem `Cannot set properties of null`.

- [ ] 5. Remover referências a inputs de metadados em `_updateUIFromState()`.
      Em `_updateUIFromState` (~linha 439–467): **remover as 6 linhas** `document.getElementById("prop-id").value = ...` até `document.getElementById("prop-type").value = ...` (prop-id, prop-name, prop-cols, prop-rows, prop-kind, prop-type). **Manter** a linha de `lock-rule` (tem guard), `holes-count` (adicionar guard `const hc = document.getElementById("holes-count"); if (hc) hc.textContent = ...`), as chamadas às listas, `_syncScatterUI`, `_updateSpawnsListUI`, `_checkSpawnSafety`, `_updateCodeOutput`, e `status-dims`. O estado interno (`this.room.id/name/kind/type`, `this.cols/rows`) continua sendo preenchido por `_importFromData`/`_loadBlankShape`/`_loadTemplate` com valores padrão/importados — nada depende dos inputs para funcionar.
      Files: `js/editor/EditorApp.js`
      Verify: `node --check`. No browser, trocar de forma/variação (setas) sem erro de console; `status-dims` ainda atualiza.

- [ ] 6. Remover indicadores textuais/numéricos desenhados no canvas (manter quadrados e sprites).
      Em `EditorApp.js`:
      - `_renderGrid` (~linha 991–1015): **remover o bloco `if (this.showCoords) { ... }`** inteiro (os `ctx.fillText` dos números de col/linha). Manter as linhas da grade (`showGrid`).
      - `_renderSocketsHighlight` (~linha 1017–1090): **remover os 4 blocos** `ctx.fillStyle=...; ctx.font=...; ctx.textAlign=...; ctx.fillText("🚪 N [...]")` (N/S/E/W). Manter os `fillRect`/`strokeRect` coloridos de cada porta.
      - `_renderPlayerSpawns` (~linha 1247–1310): **remover** os `ctx.fillText("🟡 P1 [...]")` e `ctx.fillText("🔵 P2 [...]")`. Manter `fillRect`/`strokeRect` dos tiles P1/P2, a linha de corrente, e as chamadas a `_drawPlayerSprite`.
      - `_drawPlayerSprite` (~linha 1312–1352): **remover** o bloco final `ctx.fillStyle=glowColor; ctx.font=...; ctx.fillText(label, px, py-18);`. Manter sombra, aura e sprite.
      - `_renderEnemies` (~linha 1180–1245): **remover** os dois `ctx.fillText("👹 DEMON", ...)` e `ctx.fillText("🩸 MONSTER", ...)` e as linhas `ctx.fillStyle`/`ctx.font`/`ctx.textAlign` que os precedem especificamente para o badge. Manter sprite, anel de destaque (ellipse) e fallback de círculo.
      - `_renderHazards` (~linha 1097–1156): não há `fillText`; manter sprites/formas e a seta de direção da flecha (linha). Nenhuma mudança além de confirmar que não há texto.
      Files: `js/editor/EditorApp.js`
      Verify: `node --check`. No browser: o grid mostra só quadrados coloridos de porta/spawn e sprites — sem números de coordenada, sem rótulos "🚪 N", sem "P1"/"P2", sem "DEMON"/"MONSTER".

- [ ] 7. Remover do HTML: sidebar direita inteira, botões JSON/Importar da navbar, e emojis.
      Em `editor.html`:
      - **Remover** o `<aside id="sidebar-right">...</aside>` COMPLETO (contém os 3 cards: Metadados, Checklist de Integridade, Código/JSON Gerado — todos os IDs `prop-*`, `stat-*`, `code-output`, `btn-quick-copy`, `spawn-warning-box` NÃO — atenção: `spawn-warning-box` e `spawns-info-list` estão no `tab-spawns` da sidebar ESQUERDA, não aqui; `spawn-warning-box` deve ser removido do `tab-spawns` também, ver abaixo).
      - No `tab-spawns` (sidebar esquerda), **remover** o `<div id="spawn-warning-box" ...></div>` (o alerta), já que `_checkSpawnSafety` vira no-op (item 1). Manter `spawns-info-list`.
      - **Remover** os botões `<button class="btn" id="btn-export-json">💾 JSON</button>` e `<button class="btn" id="btn-import-json">📂 Importar</button>` da `.header-actions`.
      - **Remover emojis** de todos os botões/labels (manter o texto): `💾 Salvar`→`Salvar`, `🗑️ Deletar`→`Deletar`, `⚡ Testar`→`Testar`, `📊 Cobertura`→`Cobertura`, `🎮 Jogo`→`Jogo`, `➕ Nova`→`Nova`, `🧹 Limpar Todos os Buracos (Restaurar Piso)`→`Limpar Todos os Buracos (Restaurar Piso)`, `⚡ Auto-Distribuir em Círculo`→`Auto-Distribuir em Círculo`, `🔍 +`→`+`, `🔍 -`→`-`. Labels de rádio: `🪨 Rocha`→`Rocha`, `💀 Caveira`→`Caveira`, `🦴 Ossos`→`Ossos`, `🕸️ Teia`→`Teia`, `🔘 Botão de Pressão Co-op`→`Botão de Pressão Co-op`, `🔺 Fileira de Espinhos (Onda)`→`Fileira de Espinhos (Onda)`, `🎯 Espinho Individual`→`Espinho Individual`, `🏹 Atirador de Flecha na Parede`→`Atirador de Flecha na Parede`, `👹 Demônio (Rápido)`→`Demônio (Rápido)`, `🩸 Monstro de Sangue (Tanque)`→`Monstro de Sangue (Tanque)`. Os títulos dos modais (`📊 Cobertura de Peças`, `🔄 Atualizar`) também: remover emoji. Os `✕` dos itens de lista PODEM ficar.
      Files: `editor.html`
      Verify: Abrir no browser — sem sidebar direita, sem botões JSON/Importar, botões/labels sem emoji. Grep em `editor.html` por caracteres emoji restantes nos escopos citados retorna só os `✕` (aceitáveis).

- [ ] 8. Remover emojis gerados por JS (innerHTML / fillText de labels) em EditorApp.js.
      Varrer `EditorApp.js` e remover emojis dos textos gerados dinamicamente, mantendo os rótulos:
      - `_hazardLabel` (~linha 540): `"🔘 Botão Co-op"`→`"Botão Co-op"`, `"🔺 Fileira Espinhos"`→`"Fileira Espinhos"`, `"🎯 Espinho Único"`→`"Espinho Único"`, `"🏹 Atirador Flecha"`→`"Atirador Flecha"`.
      - `_updateEnemiesListUI` (~linha 566): `"👹 Demônio"`→`"Demônio"`, `"🩸 Monstro Sangue"`→`"Monstro Sangue"`.
      - `_updateTorchesListUI` (~linha 685): `"🔥 Tocha ${t.side}"`→`"Tocha ${t.side}"`.
      - `_updatePropsListUI` (~linha 718): `"🏺 Prop #${p.index}"`→`"Prop #${p.index}"`.
      - `_updateSpawnsListUI` (~linha 480): remover `🚪` do `<strong>`, e `🟡`/`🔵` dos spans.
      - `_allShapes` (~linha 140–160): remover prefixo emoji de TODOS os `name` (`"➕ Cruzamento (4 vias)"`→`"Cruzamento (4 vias)"`, `"🔀 Junção T ..."`→`"Junção T ..."`, `"↔️ Corredor..."`→`"Corredor..."`, `"↕️..."`, `"↱ Curva..."`, `"↰"`, `"↳"`, `"↲"`, `"🚪 Dead-End..."`, `"🏁 Câmara Inicial (Start)"`, `"💀 Câmara do Chefe (Boss)"`). Nota: `_loadBlankShape` faz `shape.name.replace(/^[^\w]+/, "")` — continua funcionando (sem emoji, o replace é no-op inofensivo).
      - `_expectedShapes` (~linha 1900–1940): remover emojis dos `name` dos itens e dos labels especiais `"🏁 Sala Inicial (start)"`→`"Sala Inicial (start)"`, `"💀 Sala do Chefe (boss)"`→`"Sala do Chefe (boss)"`.
      - `_updateShapeNavUI` (~linha 236–240): `statusEl.textContent` usa `✓` e `⚠`; `varLabel` usa `✨`. Esses são símbolos de status, não "emojis de botão/título" — **manter** (fora do escopo explícito; o pedido fala de botões, títulos e indicadores do canvas). Deixar como estão para não alterar semântica de status.
      - Mensagens de `alert()` com ✅/❌/🗑️ (em save/delete/playtest) estão fora do escopo visual pedido — **manter** (não são botões nem canvas).
      Files: `js/editor/EditorApp.js`
      Verify: `node --check`. No browser: listas dinâmicas (inimigos, tochas, props, traps) e o título da forma aparecem sem emoji; navegador de formas percorre nomes limpos.

- [ ] 9. Reescrever a navegação da sidebar esquerda: de abas deslizantes para cards colapsáveis.
      Em `editor.html`, dentro de `<aside id="sidebar-left">`:
      - **Remover** o `<nav class="mode-tabs">...</nav>` (os 6 `tab-btn`).
      - Reestruturar os 6 `.tab-panel` existentes em 6 **cards colapsáveis**. Decisão de marcação: envolver cada painel num container `<section class="tool-group" data-group="tab-holes">` com um cabeçalho clicável `<h2 class="group-title">Buracos</h2>` (negrito via CSS) seguido do corpo `<div class="group-body">` que contém o `.tab-panel` existente (mantendo `id="tab-holes"` etc. e TODO o conteúdo interno intacto). Títulos (sem emoji): Buracos, Tochas, Props, Traps, Inimigos, Spawns Players. Manter o `<div class="tab-panel-container">` como wrapper rolável.
      - Decisão: começar com o primeiro grupo (`tab-holes`) expandido e ativo; os demais colapsados. A classe `active` no `.tool-group` indica o grupo "ativo" (um por vez) e `expanded`/`collapsed` controla a visibilidade do corpo (independente por card).
      Em `EditorApp.js`, reescrever o handler de navegação em `_initEvents` (bloco `document.querySelectorAll(".tab-btn")`, ~linha 1463–1471):
      - Substituir por: `document.querySelectorAll(".group-title").forEach(h => { h.onclick = () => { const group = h.closest(".tool-group"); const id = group.dataset.group; const wasExpanded = group.classList.contains("expanded"); group.classList.toggle("expanded"); group.classList.toggle("collapsed"); if (!wasExpanded) { /* ao expandir, torna este o ativo */ document.querySelectorAll(".tool-group").forEach(g => g.classList.remove("active")); group.classList.add("active"); this.activeTab = id; this.render(); } }; });` — garante: clicar no `h2` alterna expandir/colapsar aquele card; ao expandir, define `this.activeTab` para o `data-group` e re-renderiza (hover/clique no grid passam a rotear para aquele modo). Manter o `.tab-panel` sempre com display controlado pelo card (não mais pela classe `active` do painel). **Decisão de interação**: `activeTab` segue o último card expandido/focado; destaque visual (borda/cor) no `.tool-group.active`.
      - Garantir que `this.activeTab` inicial (`"tab-holes"`) corresponda ao card inicialmente expandido/ativo.
      Rationale: cards empilhados independentes atendem ao pedido (dropdowns agrupados, minimizáveis, título h2 bold), e amarrar `activeTab` ao card expandido preserva o roteamento de `_handleCanvasAction` sem tocar na lógica do canvas.
      Files: `editor.html`, `js/editor/EditorApp.js`
      Verify: `node --check`. No browser: 6 cards empilhados na esquerda, cada `h2` colapsa/expande seu conteúdo; expandir um card muda o modo ativo (hover do grid muda de cor conforme o modo) e destaca o card ativo; todos os controles internos (contadores, limpar, rádios, sliders, listas) funcionam.

- [ ] 10. Navbar: título "Editor" à esquerda e título da forma centralizado.
      Em `editor.html`, dentro de `<header id="editor-header">`:
      - Substituir o conteúdo da `.brand` (hoje `<h1>🗡️ DUNGEON CHAINED</h1>` + `<span class="badge">`) por um único título: `<div class="brand"><span class="editor-title">Editor</span></div>`.
      - **Mover** a `shape-info` (com `#shape-name` e `#shape-status`) para o centro da navbar. Opção escolhida: deixar `#shape-name`/`#shape-status` dentro de `.header-center` como bloco central grande e em negrito, e **mover** `#shape-prev`/`#shape-next` para FORA da navbar (item 11), e `#variant-*` também para fora (item 11). Portanto `.header-center` passa a conter APENAS a `.shape-info` (nome da forma centralizado). Manter os IDs `shape-name` e `shape-status`.
      Files: `editor.html`
      Verify: No browser: canto esquerdo mostra "Editor"; centro da navbar mostra o nome da forma atual em negrito e grande; sem emoji de espada, sem "DUNGEON CHAINED", sem badge "Editor de Salas".

- [ ] 11. Reposicionar as setas de FORMA (laterais do grid) e as de VARIAÇÃO (base do grid).
      Em `editor.html`: **mover** os botões `#shape-prev` e `#shape-next` para dentro de `<section id="editor-viewport">` (ou dentro de `.canvas-container`), como filhos posicionáveis absolutamente — `#shape-prev` à esquerda, `#shape-next` à direita. **Mover** o bloco de variação (`#variant-prev`, `#variant-label`, `#variant-next`, `#variant-new`) para dentro da `.canvas-container` como uma barra inferior centralizada. Manter TODOS os IDs e classes de binding (`nav-arrow`, `btn`). Sugestão de marcação:
      ```html
      <div class="canvas-container" id="canvas-container">
          <canvas id="roomCanvas" ...></canvas>
          <button class="btn nav-arrow shape-arrow-left" id="shape-prev" title="Forma anterior">◀</button>
          <button class="btn nav-arrow shape-arrow-right" id="shape-next" title="Próxima forma">▶</button>
          <div class="variant-bar">
              <button class="btn btn-sm nav-arrow" id="variant-prev" title="Variação anterior">◀</button>
              <span class="variant-label" id="variant-label">—</span>
              <button class="btn btn-sm nav-arrow" id="variant-next" title="Próxima variação">▶</button>
              <button class="btn btn-sm" id="variant-new" title="Criar nova variação">Nova</button>
          </div>
      </div>
      ```
      Nenhuma mudança JS necessária (os binds em `_initEvents` usam os IDs e o helper `bind` com guard; `_updateShapeNavUI` escreve em `#variant-label`/`#shape-name` com guard). **Cuidado crítico**: esses botões ficam SOBRE o canvas — devem ser pequenos e com `pointer-events` que NÃO bloqueiem o grid fora deles (ver item 13 CSS: o container de setas não captura cliques; só os botões capturam).
      Files: `editor.html`
      Verify: No browser: seta esquerda/direita de forma nas laterais do grid, verticalmente centradas; barra de variação na base central do grid com label e botão "Nova"; clicar nas setas troca forma/variação; clicar/arrastar no grid (fora dos botões) ainda abre buracos/coloca conteúdo.

- [ ] 12. Remover o toggle "Coords" da viewport-toolbar e seu binding.
      Em `editor.html`: **remover** o `<label class="toggle-switch"><input type="checkbox" id="toggle-coords" checked> Coords</label>` da `.viewport-tools-right`. Em `EditorApp.js` (`_initEvents`, ~linha 1576): **remover** a linha `document.getElementById("toggle-coords").onchange = ...`. `this.showCoords` pode permanecer como campo (não é mais lido após o item 6 remover o bloco em `_renderGrid`), mas sem o binding não há risco de null. Manter os toggles Grade, Portas e Spawns Players funcionando.
      Files: `editor.html`, `js/editor/EditorApp.js`
      Verify: `node --check`. No browser: toolbar sem "Coords"; toggles Grade/Portas/Spawns Players funcionam; console sem erro.

- [ ] 13. CSS: remover estilos da sidebar direita e checklist/código; adicionar estilos dos cards colapsáveis e reposicionamento das setas; ajustar navbar.
      Em `css/editor.css`:
      - **Remover** (ou podem permanecer inertes, mas melhor remover para limpeza): `#sidebar-right`, `.sidebar-content`, `.prop-group`, `.prop-row-2`, `.status-item` (se não usado em outro lugar — ATENÇÃO: `.status-item` é usado pelas listas dinâmicas de inimigos/tochas/props/traps e pela cobertura! **MANTER `.status-item` e `.status-badge`**), `.status-badge` (MANTER — usado na cobertura e nas listas), `.code-box` (remover), `.styled-input` (MANTER se usado por `#modal-textarea`? o textarea usa estilo inline; `.styled-input` só era usado pelos `prop-*` removidos — pode remover). Revisar com cuidado: remover só o que ficou sem uso. Seguro remover: `#sidebar-right`, `.sidebar-content`, `.prop-group`, `.prop-row-2`, `.code-box`. **Manter**: `.status-item`, `.status-badge*` (listas + cobertura).
      - **Remover/ajustar** `.mode-tabs` e `.tab-btn*` (não há mais abas). Pode remover esses blocos.
      - **Ajustar** `.tab-panel` / `.tab-panel.active`: hoje `display:none` + `.active{display:flex}`. Com cards colapsáveis, o controle de visibilidade passa para `.group-body`. Reescrever: `.tab-panel { display: flex; flex-direction: column; gap: 16px; }` (sempre visível quando o corpo do card está aberto). Remover a dependência de `.active` no painel.
      - **Adicionar** estilos de card colapsável:
        ```css
        .tool-group { border:1px solid var(--border-color); border-radius:8px; margin-bottom:10px; background: var(--bg-card); overflow:hidden; }
        .tool-group.active { border-color: var(--border-active); box-shadow:0 0 0 1px var(--primary) inset; }
        .group-title { font-size:14px; font-weight:800; padding:10px 12px; cursor:pointer; color:var(--text-main); display:flex; align-items:center; justify-content:space-between; user-select:none; }
        .group-title::after { content:"▸"; transition:transform .15s; opacity:.7; }
        .tool-group.expanded .group-title::after { transform:rotate(90deg); }
        .group-body { padding:0 12px 12px; }
        .tool-group.collapsed .group-body { display:none; }
        ```
        (Garantir que o estado inicial no HTML tenha o primeiro grupo com classe `expanded active` e os demais `collapsed`.)
      - **Ajustar** `.header-center` (centro da navbar): deve centralizar a `.shape-info` com `#shape-name` grande e negrito. Ex.: `.header-center{flex:1; display:flex; justify-content:center; align-items:center;}` e `.shape-name{font-size:18px; font-weight:800;}`. Adicionar `.brand .editor-title{font-size:16px; font-weight:800; letter-spacing:1px;}`.
      - **Adicionar** posicionamento das setas sobre o canvas (o `.canvas-container` já é `position:relative; overflow:hidden`):
        ```css
        .shape-arrow-left, .shape-arrow-right {
            position:absolute; top:50%; transform:translateY(-50%);
            z-index:15; font-size:18px; padding:8px 12px; opacity:.85;
        }
        .shape-arrow-left { left:10px; }
        .shape-arrow-right { right:10px; }
        .shape-arrow-left:hover, .shape-arrow-right:hover { opacity:1; }
        .variant-bar {
            position:absolute; bottom:12px; left:50%; transform:translateX(-50%);
            z-index:15; display:flex; align-items:center; gap:8px;
            background: var(--bg-panel); border:1px solid var(--border-color);
            border-radius:8px; padding:6px 10px; backdrop-filter: blur(8px);
        }
        ```
        **Pointer-events**: como os botões são elementos reais sobre o canvas, eles capturam cliques apenas na sua própria área; o restante do `.canvas-container` segue recebendo os eventos de mouse (que estão ligados em `this.container`, o próprio `#canvas-container`). Confirmar que NÃO há um wrapper absoluto cobrindo todo o container (as setas e a barra são elementos pequenos). Não aplicar `pointer-events:none` nos botões (eles precisam ser clicáveis); se desejar segurança extra, pode-se envolver nada — manter simples.
      - **Remover** os blocos antigos de `.shape-nav`/`.variant-nav` no final do arquivo que assumem layout no header, OU adaptá-los. O `.variant-label` ainda existe — manter sua regra. `.shape-info`/`.shape-name`/`.shape-status` mantidos (reusados no centro da navbar). Remover `.shape-nav .nav-arrow` se não fizer mais sentido (as setas agora são `.shape-arrow-*`), mas `.nav-arrow` genérico ainda é usado pelas setas de variação — manter `.nav-arrow`.
      Files: `css/editor.css`
      Verify: No browser (reload): layout dark coerente; sidebar esquerda com cards colapsáveis estilizados; navbar com "Editor" à esquerda e nome da forma grande/negrito no centro; setas nas laterais e barra de variação na base do grid; nenhuma coluna direita.

- [ ] 14. Verificação integrada final (manual no browser).
      Rodar um servidor estático na raiz do projeto e abrir o editor:
      Files: (nenhum) — passo de verificação.
      Verify: `node --check js/editor/EditorApp.js` passa. Servir com `python -m http.server 8000` (ou o `serve.py` do projeto) e abrir `http://localhost:8000/editor.html`. Checklist visual: (1) navbar: "Editor" à esquerda, nome da forma centralizado/negrito/grande, botões sem emoji, sem botões JSON/Importar, sem espada/título antigo/badge. (2) Sem sidebar direita. (3) Sidebar esquerda: 6 cards colapsáveis com `h2` bold, expandir/colapsar independente, card ativo destacado, controles internos funcionando (adicionar/remover inimigos, traps, tochas, props, buracos; limpar; sliders; rádios). (4) Grid: setas de forma nas laterais, barra de variação na base; só quadrados coloridos + sprites, sem números/coordenadas/rótulos "🚪"/"P1"/"P2"/"DEMON"/"MONSTER". (5) Zoom/pan e clique no grid funcionam (botões sobre o canvas não bloqueiam o grid). (6) Toggles Grade/Portas/Spawns funcionam; "Coords" removido. (7) Recarregar a página restaura a cena (localStorage/persistência via `_updateCodeOutput→_saveState`). (8) Playtest ("Testar") ainda redireciona para o jogo. (9) Console do navegador sem erros de `null`/exceções.

---

## Notas e suposições
- Save/Delete dependem de `serve.py` com endpoints `/api/save-room` e `/api/delete-room`; isso está **fora do escopo** e não deve ser alterado. A validação da UI não exige esses endpoints — basta um servidor estático.
- `_exportJSON` e `_openImportModal`/`_importFromData` permanecem no JS: `_importFromData` é essencial (usado por carregamento de variações e restauração de estado). O modal (`#modal-box`) permanece no HTML, apenas o botão que o abre (`btn-import-json`) é removido.
- Símbolos de status no navegador de formas (`✓`, `⚠`, `✨`) e emojis em `alert()` ficam fora do escopo "botões/títulos/canvas" e são mantidos; se a revisão exigir removê-los, é um ajuste trivial, mas não altera comportamento.
- Números de linha são aproximados (arquivo de 2200 linhas); localizar por nome de método/string literal é mais confiável.
- Contrato do loop de revisão: o verdict-writer grava `c:\Users\Usuario\Desktop\dungeon-chained\.agents\tasks\editor-review.json` com `verdict = APPROVED` para encerrar.
