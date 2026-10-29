# Plano: evolução do Arauto das Brasas

Fonte: `.agents/design/demo/kiro-arauto-das-brasas.md`. Branch: `feat/flame-golem`.

## Arquivos
- Config: `js/config/FlameGolemConfig.js` (100 HP, 246 de altura, `slam`, morte a 12 ticks/quadro, `superArmor`, `leavesCorpse`, `bossBar`), `js/config/BossBarConfig.js` (novo).
- Entidades: `js/entities/MeleeEnemy.js` (`superArmor`, `hitCooldownSteps`, `leavesCorpse`, `becomeCorpse`, `maxHp`), `js/entities/FlameGolemEnemy.js` (slam, `bossBarState`), `js/entities/Player.js` (`infiniteLives`, `loseLife`, `damageTaken`).
- Combate/sala: `js/combat/CombatSystem.js` (escombros no lugar de gibs, feedback do slam), `js/rooms/Room.js` (`corpses`).
- UI/jogo: `js/ui/BossHealthBar.js` (novo), `js/ui/VtuberHud.js` (`freeSpan`), `js/Game.js` (barra, escombros, `airborne`, vida infinita, F7).
- Editor: `js/editor2/ContentTools.js` (checkbox de vida infinita, sessão do teste).
- Testes: `tests/test_arauto_das_brasas.js` (novo), ajustes em `test_flame_golem*.js` e `test_editor2_content_catalog.js`.

## Verificação
`npm test`, `npm run check`, `node --check` nos arquivos alterados. Validação no jogo real fica com o usuário.
