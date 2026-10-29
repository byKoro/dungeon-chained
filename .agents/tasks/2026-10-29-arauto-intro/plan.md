# Apresentação do Arauto (refeita do zero)
Status: implementado; branch atual; sem commit.

## Objetivo
Substituir a cena de entrada do Codex (`2026-10-29-arauto-entrance-scene`, código já removido da árvore) por uma apresentação nova: golem desmontado → câmera e zoom nele → remonta (morte ao contrário, estalos de pedra) → `attack2` (ergue os braços e bate no chão com o slam já existente) → pausa → luta. Sem vozes dos jogadores; expressões no boneco e no retrato. Completa na primeira vez, curta depois; segurar E pula. Barras pretas no estilo da forja, também na cena da fase 2.

## Contexto lido
architecture, conventions, status; systems combat-and-entities, ui, rendering, audio; `SawForgeCinematic`, `ArautoPhaseScene`, `TrailerOverlay`/`PixelButton`, `TrailerStage._loadExpressions`, `Player.getFrame`, `Game` (`_step`, `_render`, `_activateRoomEnemies`, `_bossBarState`, `_updateSawMotor`), `InputHandler`.

## Passos
1. `FlameGolemEnemy.introPose` (só desenho) + `ArautoIntroConfig`. Teste: pose e luz/brasas.
2. `LetterboxConfig` + `ui/Letterbox.js`; `ArautoPhaseScene` usa e desenha depois do HUD. Teste: amount/draw.
3. `systems/ArautoIntroScene.js` (linha do tempo). Teste com fakes: quadros, impacto, estalos, curta/completa, skip.
4. `Game`: `_startArautoIntro`, `_updateArautoIntro`, desenho, barra de chefe, motor da serra, reset; cue `arautoAssemble`.
5. `ui/HoldToSkip.js` + bloqueio do E (`_maskLatchedInteract`).
6. `PlayerFactory` carrega as expressões no sprite.
7. Checkbox "Repetir apresentação completa do Arauto" no editor 2.0 → `mapData.test.repeatArautoIntro`.
