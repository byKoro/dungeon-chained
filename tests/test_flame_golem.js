import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { ENEMY_TYPE_BY_KEY } from '../js/config/EntityConfig.js';
import { FLAME_GOLEM } from '../js/config/FlameGolemConfig.js';
import { editorEnemyTypes, thumbRegion } from '../js/editor2/ContentCatalog.js';

const sheet = { complete: true, naturalWidth: 1200 };
const assets = { get(key) { assert.equal(key, 'flameGolem'); return sheet; } };
const spawn = new SpawnSystem({ assets, bloodCanvas: { palette: [] } });
const create = () => spawn.createEnemy(0, 0, 1, 'flameGolem');
const players = [30, 500].map(x => ({ x, y: 0, lives: 3, hitRadius: 16, takeDamage() { return true; } }));
assert.ok(editorEnemyTypes().some(t => t.key === 'flameGolem'));
assert.deepEqual(thumbRegion(ENEMY_TYPE_BY_KEY.flameGolem.config(assets)), { sx: 36, sy: 129, w: 32, h: 28 });

const attacker = create();
const attacks = [], hits = [];
for (let tick = 0; tick < 700 && attacks.length < 3; tick++) {
    attacker.update(players, () => hits.push({ attack: attacker.currentAttack, time: attacker.animTime }));
    if (attacker.justAttacked) attacks.push(attacker.currentAttack);
}
assert.deepEqual(attacks, ['attack', 'attack2', 'attack3']);
assert.deepEqual(hits.slice(0, 2), [
    { attack: 'attack', time: 30 },
    { attack: 'attack2', time: 36 }
]);

const dodged = create();
dodged.update(players, () => assert.fail('no damage during preparation'));
const far = players.map(p => ({ ...p, x: 1000 }));
for (let i = 0; i < 120; i++) dodged.update(far, () => assert.fail('leaving melee range avoids damage'));

const walking = create();
for (let i = 0; i < 120; i++) walking.update(far, () => {});
assert.ok(walking.x > 0 && walking.x <= 120 * 0.8);
assert.ok(walking.speedMag <= 0.8 + 1e-9);

const frozen = create();
frozen.beginFrozenSpawn(2);
assert.equal(frozen.takeHit(), false);
for (let i = 0; i < 70; i++) frozen.update(players, () => assert.fail('frozen spawn cannot attack'));
assert.equal(frozen.x, 0);
frozen.unfreeze();
frozen.update(players, () => {});
assert.equal(frozen.state, 'windup');

const dying = create();
assert.equal(dying.hp, FLAME_GOLEM.hp);
for (let i = 0; i < FLAME_GOLEM.hp; i++) {
    assert.ok(dying.takeHit());
    assert.equal(dying.hp, FLAME_GOLEM.hp - 1 - i);
    if (i < FLAME_GOLEM.hp - 1) {
        assert.equal(dying.isDying, false);
        for (let t = 0; t < dying.hitCooldownSteps; t++) dying.update(far, () => {});
    }
}
dying.flashTimer = 0; // o flash do último acerto usaria um canvas de tinta, que não existe no Node
const crops = [];
const ctx = { save() {}, restore() {}, translate() {}, scale() {}, drawImage(...args) { crops.push(args.slice(1, 5)); } };
const deathTicks = 6 * FLAME_GOLEM.deathTicksPerFrame;
for (let t = 0; t < deathTicks; t++) {
    assert.equal(dying.readyToGib, false);
    dying.draw(ctx);
    dying.update(players, () => assert.fail('dying golem cannot attack'));
}
assert.ok(dying.readyToGib);
assert.deepEqual([...new Set(crops.map(([x]) => x))], [30, 130, 230, 330, 430, 530]);
assert.ok(crops.every(([, y, w, h]) => y === 520 && w === 59 && h === 39));
console.log('Flame Golem: spawn, editor, melee cycle, dodge, speed and full death passed.');
