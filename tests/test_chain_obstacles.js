import assert from 'node:assert/strict';
import { Chain } from '../js/core/Chain.js';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { ChainObstacleSystem } from '../js/systems/ChainObstacleSystem.js';
import { CombatSystem } from '../js/combat/CombatSystem.js';
import { ThrownSaw } from '../js/systems/ThrownSaw.js';
import { Physics } from '../js/core/Physics.js';
import { CHAIN_COLLISION } from '../js/config/ChainCollisionConfig.js';
import { SAW_CONTACT } from '../js/config/SawWeaponConfig.js';

const system = new ChainObstacleSystem();
const weapon = new SawWeapon();
const chain = new Chain([weapon]);
const enemy = { x: 0, y: 0, immovable: true, state: 'chase', collisionBodies: [{ x: 0, y: 0, radiusX: 45, radiusY: 40 }] };
const p1 = { x: -100, y: -50, vx: 0, vy: 4 }, p2 = { x: 100, y: -50, vx: 0, vy: 4 };
weapon.spin = 1;
system.beginStep(chain);
system.resolve(chain, p1, p2, [enemy]);
assert.ok(weapon.getSawPositions(p1, p2)[0].y <= -40 - weapon.discRadius + CHAIN_COLLISION.compression,
    'disc cannot penetrate beyond allowed compression');
assert.ok(p1.vy > 0 && p1.vy < 4, 'resistance reduces inward speed without instantly stopping it');
assert.equal(enemy.x, 0); assert.equal(enemy.y, 0);
assert.equal(weapon.spin, 1, 'physical resistance does not reduce motor spin');
assert.ok(weapon.obstacleContacts.has(enemy), 'surface contact remains available for damage');
Object.assign(p1, { x: -100, y: -44 }); Object.assign(p2, { x: 300, y: -44 });
system.beginStep(chain); system.resolve(chain, p1, p2, [enemy]);
assert.ok(p1.y < -44, 'cable is blocked even with disc away from boss');
assert.equal(weapon.obstacleContacts.get(enemy).kind, 'chain');
let damage = 0;
enemy.takeHit = () => { damage++; return true; };
const combat = new CombatSystem({ renderer: { triggerShake() {} }, particleSystem: { triggerBlood() {} } });
combat.resolveWeaponHits(weapon, [enemy], p1, p2);
assert.equal(damage, 1, 'blocked cable still damages boss at surface');
system.beginStep(chain);
combat.resolveWeaponHits(weapon, [enemy], p1, p2);
assert.equal(damage, 1, 'cleared contact cannot deal ghost damage');
chain.connected = false;
const before = p1.y;
system.beginStep(chain); system.resolve(chain, p1, p2, [enemy]);
assert.equal(p1.y, before); assert.equal(weapon.obstacleContacts.size, 0);
chain.connected = true; enemy.ignoresEntityCollisions = true;
system.beginStep(chain); system.resolve(chain, p1, p2, [enemy]);
assert.equal(p1.y, before, 'airborne boss does not block ground tether');
enemy.ignoresEntityCollisions = false;
weapon.drop(-90, 0);
const thrown = new ThrownSaw({ getWeapon: () => weapon, getRoom: () => ({
    bounds: { minX: -1000, maxX: 1000, minY: -1000, maxY: 1000 }, wallBoxes: [], enemies: [enemy]
}), safeDrop: (x, y) => ({ x, y }) });
thrown.launch();
thrown.update();
assert.ok(weapon.dropX < -45 - weapon.discRadius, 'thrown disc bounces before entering golem');
assert.ok(weapon.throwVX < 0, 'thrown saw rebounds from solid body');
assert.equal(damage, 2, 'throw deals one surface hit');
weapon.pickup();
Object.assign(p1, { x: -100, y: -50, hitRadius: 16 });
Object.assign(p2, { x: 100, y: -50, hitRadius: 16 });
const wall = [{ x: -200, y: -200, w: 400, h: 125 }];
system.beginStep(chain);
system.resolve(chain, p1, p2, [enemy]);
for (const player of [p1, p2]) Physics.resolveBoxCollisions(player, wall);
const clear = system.resolve(chain, p1, p2, [enemy], () => {
    for (const player of [p1, p2]) Physics.resolveBoxCollisions(player, wall);
});
assert.equal(clear, false, 'infeasible wall/golem pinch is reported instead of silently clipping');
if (!clear) chain.forceDrop(p1, p2, () => ({ x: -100, y: 100 }));
assert.equal(chain.isConnected, false, 'pinched tether releases safely');
assert.equal(weapon.dropX, -100); assert.equal(weapon.dropY, 100);

weapon.pickup(); chain.connected = true;
Object.assign(p1, { x: -100, y: -40 - weapon.discRadius + 4, vx: 2, vy: 4 });
Object.assign(p2, { x: 100, y: p1.y, vx: 2, vy: 4 });
const startY = p1.y;
system.beginStep(chain);
for (let i = 0; i < 4; i++) assert.equal(system.resolve(chain, p1, p2, [enemy], () => {}), true,
    'permitted compression is not treated as pinching');
assert.ok(startY - p1.y <= CHAIN_COLLISION.correctionPerStep + 1e-6,
    'soft correction budget is shared across solver calls');
assert.ok(p1.vx > 1.9, 'contact preserves lateral sliding');
for (const overlap of [0.3, 0.5, 1, 2]) {
    p1.y = p2.y = -40 - weapon.discRadius + overlap;
    system.beginStep(chain);
    for (let i = 0; i < 3; i++) system.resolve(chain, p1, p2, [enemy]);
    assert.equal(system.resolve(chain, p1, p2, [enemy], () => {}), true,
        `shallow compression ${overlap}px cannot cause a false pinch`);
}

const resting = { vx: 0, vy: 0, speedMag: 0, speed: 4.2 };
weapon.spin = 1;
for (let i = 0; i < 300; i++) {
    weapon.obstacleContacts = new Map([[enemy, {}]]);
    weapon.update(resting, resting);
    assert.ok(weapon.spin >= SAW_CONTACT.minimumSpin, 'saw keeps cutting when players are blocked');
}
weapon.obstacleContacts.clear();
for (let i = 0; i < 300; i++) {
    if (i % 5 === 0) weapon.onHit();
    weapon.update(resting, resting);
}
assert.ok(weapon.spin >= SAW_CONTACT.minimumSpin, 'ordinary enemy hits also sustain motor');
for (let i = 0; i < 300; i++) weapon.update(resting, resting);
assert.ok(weapon.spin < 0.1, 'motor slows naturally after leaving contact');
weapon.spin = 0;
weapon.onHit();
weapon.obstacleContacts.set(enemy, {});
for (let i = 0; i < 20; i++) weapon.update(resting, resting);
assert.equal(weapon.spin, 0, 'contact does not start an idle saw');
weapon.spin = 1; weapon.onHit(); weapon.drop(0, 0);
weapon.update(resting, resting);
assert.ok(weapon.spin < 1, 'dropping saw releases contact motor floor');
console.log('Chain obstacle tests passed');
