# wall render order

Status: done   <!-- planned | in-progress | done | abandoned -->
Branch: feat/bars-sprite  Base: bbd8d9f  Date: 2026-10-30

## Goal
Corrigir a ordem de render e colisão nas salas do Editor 2.0: (1) o player passava por cima
das paredes frontais fora da borda — agora essas paredes (tile 41..44) ocluem o player;
(2) permitir o player subir ~20% de um tile a mais encostado nas paredes superiores;
(3) props sólidos sem `base` eram desenhados na camada de chão ("tapete") — agora têm `base`
e entram na ordenação por y, ocluindo o player quando ele está atrás.

## Context read
- context-gatherer: Game._renderView (draw order, feetSortKey, saw split), Renderer.drawRoom/drawFrontWall,
  RoomProps._layout, PropBodies.propSortY/propBaseBox, RoomManager.clampPlayer, Physics.resolveBoxCollisions.
- AuthoredDungeon.js: paredes do Editor 2.0 nascem todas com side:'top' (por isso a chave de "parede frontal"
  é o tile index 41..44, não o side — Q6/A).
- Room.js: wallBoxes derivadas de tiles.walls (1 caixa por tile).
- ADR 0003 (config só importa config): TOP_WALL_CLIMB em GameConfig.js.

## Steps
- [x] 1. Config: TOP_WALL_CLIMB = TILE*0.2 em GameConfig.js.
      Files: js/config/GameConfig.js
      Verify: import resolve, npm test
- [ ] 2. Props: base para box_1/2, mini_box_1/2, flamethrower_v/h.
      Files: js/config/PropConfig.js
      Verify: npm test, preview no editor
- [ ] 3. Room.js: marcar cada wallBox com {front, top} e aplicar folga TOP_WALL_CLIMB no topo.
      Files: js/rooms/Room.js
      Verify: colisão permite subir 20% no topo
- [ ] 4. Renderer.drawFrontWall: redesenhar walls[] com tile 41..44 no passe da frente.
      Files: js/core/Renderer.js
      Verify: player fica atrás das paredes frontais
- [ ] 5. RoomManager.clampPlayer: relaxar minY em TOP_WALL_CLIMB (sem porta N).
      Files: js/rooms/RoomManager.js
      Verify: player sobe 20% além da borda superior

## Docs to update when done
- [ ] .agents/context/systems/rendering.md
- [ ] .agents/context/status.md
