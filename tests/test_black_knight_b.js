import assert from 'node:assert/strict';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { CombatSystem } from '../js/combat/CombatSystem.js';
import { ENEMY_HIT } from '../js/config/CombatFeelConfig.js';

const sheet = { complete: true, naturalWidth: 900 };
const spawn = new SpawnSystem({ assets: { get: () => sheet }, bloodCanvas: { palette: [] } });
const create = () => spawn.createEnemy(0, 0, 1, 'blackKnightB');
const players = [-100, 100].map(x => ({ x, y: 0, lives: 3, takeDamage() { return true; } }));
const foe = create();
const other = spawn.createEnemy(0, 0, 1, 'blackKnightA');
assert.ok(foe.speed < other.speed);
for (let i = 0; i < 100; i++) foe.update(players, () => {});
assert.ok(Math.hypot(foe.vx, foe.vy) <= 0.8 + 1e-9);

const attacker = create();
const closePlayers = players.map(p => ({ ...p, x: 30 }));
const attacks = [];
let damage = 0;
for (let tick = 0; tick < 700 && attacks.length < 4; tick++) {
    attacker.update(closePlayers, () => damage++);
    if (attacker.justAttacked) attacks.push(attacker.currentAttack);
}
assert.deepEqual(attacks, ['attack', 'attack2', 'attack3', 'attack']);
assert.equal(damage, 3);

const tank = create();
const combat = new CombatSystem({ renderer: { triggerShake() {} }, particleSystem: { triggerBlood() {} } });
const weapon = { hitThreshold: 1, discRadius: 5, getSawPositions: () => [{ x: 0, y: 0 }] };
const hit = () => combat.resolveWeaponHits(weapon, [tank], ...players);
for (let i = 0; i < 3; i++) {
    hit();
    assert.equal(tank.hp, 3 - i);
    assert.equal(tank.isDying, false);
    if (ENEMY_HIT.cooldownSteps > 0) {
        hit();
        assert.equal(tank.hp, 3 - i, 'continuous contact respects hit cooldown');
    }
    for (let tick = 0; tick < 24; tick++) tank.update(players, () => {});
    tank.x = tank.y = 0;
}
hit();
assert.equal(tank.isDying, true);
assert.equal(tank.readyToGib, false);
const crops = [];
const ctx = { save() {}, restore() {}, translate() {}, scale() {}, drawImage(...args) { crops.push(args.slice(1, 3)); } };
for (let tick = 0; tick < 28; tick++) {
    assert.equal(tank.readyToGib, false);
    tank.draw(ctx);
    tank.update(players, () => assert.fail('dying enemy cannot attack'));
}
assert.equal(tank.readyToGib, true);
assert.deepEqual([...new Set(crops.map(([x]) => x))], [31, 131, 231, 331]);
assert.ok(crops.every(([, y]) => y === 526), 'draw death row without flash substitution');
assert.equal(other.dyingDuration, 9, 'other mobs retain existing death behavior');
console.log('Black Knight B: tank hits, attack cycle and full death animation passed.');
