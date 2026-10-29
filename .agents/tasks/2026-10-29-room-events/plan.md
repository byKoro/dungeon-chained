# room events

Status: done   <!-- planned | in-progress | done | abandoned -->
Branch: feat/room-events (from feat/saw-drag)  Base: fb3117f  Date: 2026-10-29

## Goal
Fatia 4 do design `../2026-10-29-inicio-core-loop/design.md` (seção 2 "Eventos por sala", "Gaiola com cordas", "Morte e progressão"). O Editor 2.0 ganha Zona, Encontro, Grade e os interativos Gaiola e Corda. Um subsistema de eventos roda um script por sala; o do `inicial` faz o encontro do salão (corda 1 arrebenta sozinha, grades descem, levas despencam da gaiola a cada corte, a gaiola cai no 4º, baú 2 abre quando a última leva morre, grades sobem). Nos mapas com bigorna, perder todas as vidas não é game over: a dupla renasce no spawn do `inicial` com 3 vidas, sucata zera, itens/melhorias/eventos concluídos ficam, o encontro interrompido recomeça.

## Context read
- Design (seções 2, 3, 5, 6), handoff, `architecture.md`, `combat-and-entities.md`, `room-editor.md`.
- Code: `js/systems/DemoEncounter.js`, `js/rooms/Room.js`, `js/rooms/RoomManager.js`, `js/core/Dungeon.js`, `js/rooms/MapDocument.js` (`normalizeRoom`, resize, `formatMapJson`), `js/editor2/ContentTools.js`, `js/editor2/MapEditorApp.js` (`_applyTool`), `js/entities/MeleeEnemy.js` (frozen spawn), `js/Game.js`.

## Decisions taken here
- Inimigos colocados direto na sala continuam nascendo ao entrar (compatível com `demo_campaign.json`). Encontros são adicionais; o `inicial` não tem inimigos soltos.
- Regra de morte nova só em mapas do Editor 2.0 com bigorna (mesma condição de "começar sem serra", sem o override do teste). Os outros mantêm game over.
- O "script por sala" é escolhido pelo nome da sala (`inicial`). A gaiola, as cordas e o baú 2 vêm do mapa (interativos `cage`/`rope`, baú sob a gaiola); a corda que arrebenta sozinha tem `auto: true`.
- Zonas e grades do design foram ajustadas ao mapa atual: corredor norte nas colunas 23–25 (não 21–24).
- Falas do encontro (corda 1, leva 1 limpa, baú 2) entram aqui; o resto do roteiro é da fatia 5.

## Steps
- [x] 1. Dados: `zones`, `encounters`, `bars` em `normalizeRoom`/resize; interativos `cage` e `rope`.
- [x] 2. Editor 2.0: ferramentas Zona (dois cliques + id), Grade (tile), painel de Encontros (id + levas em texto), Gaiola/Corda (+ "arrebenta sozinha"); desenho no editor.
- [x] 3. `EventsConfig`, `RoomEvents` (registro de scripts, grades com colisão e desenho, persistência de concluídos), `CageEncounter`, `InicialRoomScript`; baú escondido/aberto pelo script; aspirar sucata ao limpar uma leva.
- [x] 4. Regra de morte (ADR 0012) e ADR 0011.
- [x] 5. Montar no `inicial.json`: zonas, encontro do salão, gaiola, cordas, baú 2 (15), grades.
- [x] 6. Testes, verificação no Electron, docs, review, verification.
