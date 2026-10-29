import assert from 'node:assert/strict';
import { ENEMY_TYPE_BY_KEY } from '../js/config/EntityConfig.js';
import { EDITOR2_ENEMY_KEYS, editorEnemyTypes, thumbRegion } from '../js/editor2/ContentCatalog.js';

const sheet = { complete: true, naturalWidth: 900 };
const assets = { get: () => sheet, demon: sheet, bloodMonster: sheet };

for (const key of EDITOR2_ENEMY_KEYS) assert.ok(ENEMY_TYPE_BY_KEY[key], `${key} existe em ENEMY_TYPE_BY_KEY`);

assert.deepEqual(editorEnemyTypes().map(t => t.key), ['demon', 'bloodMonster', 'blackKnightB', 'cultist', 'flameGolem']);
assert.deepEqual(editorEnemyTypes().map(t => t.label), [
    'Demônio (Rápido)', 'Monstro de Sangue (Tanque)', 'Cavaleiro Negro B (Tanque)', 'Cultista (Pilar de Fogo)', 'Arauto das Brasas'
]);

// blackKnightB tem "body": o recorte usa o corpo.
assert.deepEqual(thumbRegion(ENEMY_TYPE_BY_KEY.blackKnightB.config(assets)), { sx: 41, sy: 136, w: 19, h: 22 });
// demon não tem "body": usa o crop.
assert.deepEqual(thumbRegion(ENEMY_TYPE_BY_KEY.demon.config(assets)), { sx: 28, sy: 134, w: 52, h: 26 });

console.log('Editor 2.0: catálogo de inimigos liberados passou.');
