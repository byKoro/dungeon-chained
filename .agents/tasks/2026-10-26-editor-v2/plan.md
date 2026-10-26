# Editor 2.0 (mapa da demo)

Status: done (editor); integração no jogo pendente   <!-- planned | in-progress | done | abandoned -->
Branch: novo_editor  Date: 2026-10-26

## Goal
Novo editor (`editor2.html`) para montar o mapa fixo da demo: grid de salas com tamanho editável, cada sala com tamanho próprio e cada tile editável (piso, parede com colisão, buraco, vazio, porta), escolhendo tiles pela imagem do `tileset.png` e colocando props animados. O editor antigo (`editor.html`) continua intacto.

## Context read
- AGENTS.md, .agents/context/architecture.md, conventions.md, systems/room-editor.md
- js/editor/EditorApp.js (render, tools, save/import, playtest), js/core/RoomTiles.js, js/core/Tileset.js, js/config/GameConfig.js, js/rooms/RoomManager.js, js/rooms/Room.js, js/core/Dungeon.js, js/core/Renderer.js, serve.py, scripts/validate-map.mjs

## Decisões
- Formato novo `map/demo/<nome>.json` (fora do `map/index.json`, então não afeta o jogo nem o `validate:map`).
- Sala = `tiles[r][c]` (índice do tileset; `-1` buraco; `-2` vazio) + `kinds[r]` (string por linha: `f` piso, `w` parede/colisão, `h` buraco, `v` vazio) + `doors[]` (tile de borda + tipo) + `props[]` (prop animado por tipo).
- O jogo ainda não lê esse formato. Integração no runtime (salas de tamanho variável, portas por tile) é o item #12 do cronograma; o editor exporta uma peça no formato antigo para o playtest de salas 14×9.

## Steps
- [ ] 1. Config dos props animados e dos tipos de tile/porta
      Files: js/config/PropConfig.js, js/config/MapEditorConfig.js
- [ ] 2. Modelo puro do mapa (criar, redimensionar, pintar, portas, validação, export legado)
      Files: js/editor2/MapModel.js · Verify: tests/test_map_model.js
- [ ] 3. Paleta do tileset e sprites dos props
      Files: js/editor2/TilePalette.js, js/editor2/PropSprites.js
- [ ] 4. App do editor (visão do mapa, visão da sala, ferramentas, undo, autosave, import/export)
      Files: js/editor2/MapEditorApp.js, editor2.html, css/editor2.css
- [ ] 5. Salvar/carregar no servidor
      Files: serve.py (`POST /api/save-map`, `GET /api/list-maps`)
- [ ] 6. Docs
      Files: .agents/context/systems/room-editor.md, status.md

## Docs to update when done
- [ ] .agents/context/systems/room-editor.md
- [ ] .agents/context/status.md
