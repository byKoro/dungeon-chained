# Trailer cena 11: trocar Ghostfire pelo Arauto das Brasas

Status: implemented (aguardando smoke no navegador via ?scene=11)
Branch: feat/cage-visual-editor

## Goal
Trocar o boss da cena final do trailer (cena 11) do Ghostfire para o boss atual
do jogo, usando o sprite do Arauto das Brasas (`assets/enemies/flame_golem.png`).
O combate vira energético: a dupla, presa pelo cabo, usa dash o tempo todo e corta
o Arauto com a serra do cabo até matá-lo. O final (explosão → jogadores sobem →
revelação do título) permanece com o mesmo timing; muda só a estética das explosões
(para brasa/lava). Cria uma cena nova `ArautoBossShot` e aposenta o `BossWallShot`.

## Decisões (do grilling)
- Boss só por sprite, coreografado à mão (estado tipo `this.B`), igual o trailer já faz.
- Visual fase 2 (rachaduras de lava acesas + brasas + luz quente) a cena toda.
- Ataques em destaque: slam (salto + onda) e investida/dash. Melee só pontual.
- Kill com a serra do cabo: dash duplo, cabo tenso, disco varre o boss. Golpe final
  = dash duplo com disco esticado (`_charge`) → `_impale` → `_death`.
- Luta cronometrada por timeline (sem vida real). Duelo puro, sem minions.
- Pico (~6s): instanciar a `FlameGolemEnemy` real (fase 2) para uma investida
  autêntica com telegraph; jogadores desviam de dash; depois volta ao encenado.
- Entrada: manter `SawIris` + slam de impacto (sem a remontagem).
- Suportar retrato e paisagem; afinar paisagem primeiro.
- Áudio: slam=impact/crack/boom, investida=whoosh/rope, entrada=roar; remover beam*;
  manter sting/heartbeat/slowmo do final. Explosões re-tematizadas pra brasa.
- Arquivo novo `ArautoBossShot.js`; apontar TrailerPlayer; remover BossWallShot.js.
  NÃO tocar em GhostfireConfig/assets/GhostfireSystem (usados pelo jogo real).

## Docs lidos
- AGENTS.md; .agents/tasks/2026-10-31-trailer-scene-map/notes.md (mapa das cenas).
- js/trailer/scenes/rush/BossWallShot.js (referência completa: fight + final).
- js/trailer/kit/ActionArena.js, ArenaShot.js, rushKit.js (API de cena).
- js/trailer/TrailerPlayer.js (SCENES, SCENE_MOOD), js/main.js (boot).
- js/config/FlameGolemConfig.js (FLAME_GOLEM + FLAME_GOLEM_SPRITE).
- js/entities/FlameGolemEnemy.js, js/systems/ArautoEffects.js, ArautoEffectsConfig.js.
- js/entities/Player.js + GameConfig PLAYER_DASH; js/weapons/SawWeapon.js.
- js/trailer/fx/FxParticles.js, SawIris.js.

## Fatos confirmados
- GhostfireConfig/ghostfire.png/GhostfireSystem são do jogo (type 'ghostfire',
  test_ghostfire.js). Não remover.
- BossWallShot só é referenciado no TrailerPlayer (import+SCENES+SCENE_MOOD) e docs.
  Nenhum teste importa BossWallShot. Trocar a cena é seguro.
- Sprite Arauto: cellSize 100, crop 59x39 (cropX30/cropY20), escala = drawHeight/cropH
  = 195/39 = 5. Rows: 0 flash, 1 walk(12), 2 attack(9,hit6), 3 attack2/slam(9,hit6),
  4 attack3/dash(9), 5 death(6).

## Steps
1. [ ] Seletor de cena por URL: js/main.js lê `?scene=N` → `trailer.play(N)`; liga
   showTimer quando scene setado. Verificar: `/?scene=11` abre direto na cena 11.
2. [ ] Criar js/trailer/scenes/rush/ArautoBossShot.js reaproveitando o final do
   BossWallShot (leap/título/explosões), com combate dash+serra e boss Arauto.
3. [ ] TrailerPlayer: import ArautoBossShot, trocar em SCENES e chave em SCENE_MOOD.
4. [ ] Remover js/trailer/scenes/rush/BossWallShot.js.
5. [ ] Atualizar notes do trailer-scene-map + status.md.
6. [ ] `npm run check` (ciente das 2 falhas pré-existentes #4/#5); smoke manual
   pelo usuário em `/?scene=11` (não observo runtime).

## Não verificado
- Comportamento em runtime (não abro o jogo). Peço smoke ao usuário via ?scene=11.
