# Playbook: add an enemy type

All enemies are `MeleeEnemy` instances; a new "type" is a sprite config (data). New behavior means subclassing (step 6). Context: `.agents/context/systems/combat-and-entities.md`.

## Steps
1. **Asset**: put the sheet at `assets/enemies/<snake_name>.png`. Grid of square cells (`cellSize`, usually 100 px); one animation per row; needs at least `walk`, `attack`, `death` rows.
2. **Config entry** — append to `TINY_RPG_ENEMIES` in `js/config/TinyRpgEnemies.js` (preferred; no code):
   ```js
   {
     "key": "myEnemy",                    // unique camelCase; becomes the AssetLoader key + editor/room `type`
     "label": "Meu Inimigo",              // pt-BR, shown in the editor list
     "src": "assets/enemies/my_enemy.png",
     "cellSize": 100, "cropX": 30, "cropY": 30, "cropW": 50, "cropH": 30,
     "body": { "x": 40, "y": 36, "w": 18, "h": 22 },   // optional feet/anchor box
     "drawHeight": 100,
     "rows": {
       "walk":   { "row": 1, "frames": 8, "fps": 6 },   // fps = ticks per frame (bigger = slower)
       "attack": { "row": 2, "frames": 8, "fps": 5, "hitFrame": 6 },
       "death":  { "row": 5, "frames": 4, "fps": 7 }
     },
     "deathFlash": { "row": 0, "frame": 0 },
     "gib": { "gridCols": 4, "gridRows": 3 }
   }
   ```
   That alone wires: image load (`AssetLoader` loops `TINY_RPG_ENEMIES`), `ENEMY_TYPES`/`ENEMY_TYPE_BY_KEY` (`js/config/EntityConfig.js`), the editor radio list (`EditorApp._buildEnemyChoices` + `_drawEnemyPreview`), and `SpawnSystem.createEnemy(x, y, floor, type)`.
3. **Hand-written config instead** (like `demonConfig`): add `export function myConfig(assets)` in `EntityConfig.js` returning `{ img, ...schema }`, load the image in `js/core/AssetLoader.js` (`this.load("myEnemy", "...")`, optional getter), add `{ key, label, config: myConfig }` to `ENEMY_TYPES`. Add it to `MELEE_ENEMY_CONFIGS` only if it should be in the random fallback pool (used when a room foe's `type` is unknown/missing).
4. **Audio** (optional): enemy SFX are shared cues in `js/config/AudioConfig.js` (`enemyStep`, `enemyAttack`, `enemyAttackVoice`, `enemySpawn`; `{ files, volume, rate, rateVariance, ... }`). Per-type sounds need a new cue + a branch in `CombatSystem.updateEnemies` (e.g. keyed by a new `enemy.sfxKey`). Put wavs in `assets/audio/`.
5. **Place it**: open `editor.html` (via `python serve.py`), Enemies tab → pick the new type → click tiles → save (POST `/api/save-room` writes `map/<name>.json` + `map/index.json`). Room JSON shape: `enemies: [{ "type": "myEnemy", "col": 5, "row": 3 }]` (full-room coords, border = 0).
6. **New behavior** (ranged, flying, stats): subclass `MeleeEnemy` in `js/entities/`, keep the contract `update(players, onPlayerHit)`, `draw(ctx)`, `state` (`"dying"` honored), `startDying()`, `readyToGib`, `explodeIntoGibs()`, `hitRadius`, `isHidden`, `beginFrozenSpawn/unfreeze`, `setNavigationFloor`, `ensureOnWalkableTile`, `drawHeight/footY`, `justStepped/justAttacked/justAppeared/spawnFx`. Add a `class` field to the type entry and branch in `SpawnSystem.createEnemy`. Damage players only through `player.takeDamage(x, y)`.

## Test
- `node tests/test_safe_spawn.js` (spawn placement still valid).
- `python serve.py` → `editor.html` → place enemy → Playtest (`index.html?playtest=true`), or http://localhost:8000 / `npm start`. Check: editor preview crop, walk/attack/death frames, hit lands on `hitFrame`, gibs come from the last death frame, no sprite jitter when flipped (`facingLeft`).
- Browser console: no 404 for the sheet.

## Done checklist
- [ ] Sheet in `assets/enemies/`, `key` unique and identical everywhere.
- [ ] Entry in `TINY_RPG_ENEMIES` (or config fn + `AssetLoader` + `ENEMY_TYPES`).
- [ ] Shows and previews correctly in the editor; spawns in playtest.
- [ ] Audio cues added to `AudioConfig.js` if any; files exist.
- [ ] `.agents/context/systems/combat-and-entities.md` updated if the schema or `MeleeEnemy` contract changed.
