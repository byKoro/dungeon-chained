# scrap chest

Status: in-progress   <!-- planned | in-progress | done | abandoned -->
Branch: feat/scrap-chest  Base: ae41338  Date: 2026-10-29

## Goal
Primeira fatia do design `../2026-10-29-inicio-core-loop/design.md`. A dupla ganha a moeda **sucata** (pote compartilhado, coleta com ímã, contador no HUD). Baús passam a abrir por proximidade e soltar sucata. Bigorna e baús ganham colisão de base e ordem de render por `y`. Entram as tabelas de idioma (`t('chave')`, pt-BR padrão) e os balões de fala dos jogadores.

## Context read
- Design: `../2026-10-29-inicio-core-loop/design.md` (sections 2, 5, 8).
- `.agents/context/overview.md`, `status.md`, `glossary.md`.
- Code read during the grill: `js/Game.js` (constructor, `newDungeon`, `_updateGameplay`, `_render`, `_renderView`), `js/core/Chain.js`, `js/systems/DemoProgress.js`, `js/rooms/Room.js`, `js/weapons/SawWeapon.js`. Context-gatherer report on interactives, props, UI and assets.
- To read before coding: `architecture.md`, `conventions.md`, `systems/ui.md`, `systems/rendering.md`, `systems/combat-and-entities.md`, `playbooks/add-ui-screen.md`, `playbooks/add-sound.md`, `js/config/PropConfig.js`, `js/core/PropSprites.js`, `js/entities/PressureButton.js` (sortY/occluder pattern), `js/ui/SpeechBubble.js`, `js/ui/PixelFont.js`, `js/ui/VtuberHud.js`.

## Steps
<!-- ordered; each step leaves the game loadable -->
- [ ] 1. i18n: `js/i18n/pt-BR.js`, `en.js`, `t(key)`. Move only the new strings of this slice (no mass migration).
      Files: js/i18n/*
      Verify: unit test for `t` (fallback to key when missing).
- [ ] 2. Sucata: drop values in config, pickup entity (0,4 s rest, magnet ~2,5 tiles to nearest player), shared wallet, "vacuum" call for later use, zeroed on `newDungeon`.
      Files: js/config/*, js/entities/ScrapPickup.js, a wallet/system class built in `Game`
      Verify: test for magnet and wallet; observe in game (enemy kill drops scrap).
- [ ] 3. HUD: shared counter between portraits, rolling number + bump.
      Files: js/ui/VtuberHud.js (or new HUD piece)
      Verify: observe in game.
- [ ] 4. Props sólidos: base collision box for `anvil`/`chest` and y-sorted draw with the base as sort key.
      Files: js/config/PropConfig.js, js/core/PropSprites.js, js/rooms/Room.js (wallBoxes), js/Game.js (`_renderView`)
      Verify: test for base box; observe walking behind/in front of the anvil without stepping on it.
- [ ] 5. Baú: proximity open (~2 tiles, any player), open animation, scrap burst in arc. Amount authored per chest in the Editor 2.0.
      Files: chest system class, js/editor2/*
      Verify: test for open-once; observe in game.
- [ ] 6. Balões de fala: bubble above the speaking player, typewriter, per-player blip, timed advance, interact speeds up, HUD expression while speaking. Minimal API for later scripts (`say(player, key)`).
      Files: js/ui/SpeechBubble.js (reuse), a dialogue system class built in `Game`
      Verify: observe in game with a debug line.

## Assets requested (placeholders in this slice)
- Sucata: sprite no chão e ícone do HUD.
- Balão de fala.
- Sons: coleta de sucata, abertura do baú, blip de voz para cada jogador.

## Docs to update when done
- [ ] .agents/context/systems/ui.md, combat-and-entities.md, rendering.md
- [ ] .agents/context/status.md, glossary.md (sucata, baú, prop sólido, balão)
- [ ] ADR 0013 (idiomas); ADR 0012 only if the wallet shape is decided here
