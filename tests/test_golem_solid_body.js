import assert from 'node:assert/strict';
import { Physics } from '../js/core/Physics.js';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { Player } from '../js/entities/Player.js';

const spawn = new SpawnSystem({ assets: { get: () => null }, bloodCanvas: { palette: [] } });
const golem = spawn.createEnemy(0, 0, 1, 'flameGolem');
const player = new Player(20, 0, '#fff', [], null, 'test');
const resolve = () => Physics.resolveEntityCollisions([player, golem].filter(e => !e.ignoresEntityCollisions));
resolve();
assert.ok(player.x > 20, 'golem blocks and displaces the player');
assert.equal(golem.x, 0, 'player cannot move golem');
assert.equal(golem.pushVx, 0, 'contact adds no golem impulse');
const behind = new Player(0, -55, '#fff', [], null, 'behind');
Physics.resolveEntityCollisions([behind, golem]);
assert.equal(behind.y, -55, 'players can walk behind upper sprite');
const front = new Player(0, 55, '#fff', [], null, 'front');
Physics.resolveEntityCollisions([front, golem]);
assert.ok(front.y > 55, 'lower body blocks players walking over feet');
assert.ok(golem.collisionBodies.slice(1).every(body => body.radiusX <= 16), 'arm blockers remain smaller');
const before = player.x;
golem.x += 8;
resolve();
assert.ok(player.x > before, 'walking golem pushes player');
golem.x = 0;
player.x = 0; player.y = 0;
resolve();
assert.ok(Math.hypot(player.x, player.y) > 0, 'coincident centers separate');
golem.airborne = true;
assert.ok(golem.ignoresEntityCollisions, 'airborne golem has no ground collision');
golem.airborne = false;
golem.charging = true;
assert.equal(golem.ignoresEntityCollisions, false, 'charge retains solid body');
golem.charging = false;
golem.state = 'windup'; golem.currentAttack = 'attack2'; golem.animTime = 0;
const arm = golem.collisionBodies[2];
player.x = arm.x; player.y = arm.y - arm.radiusY - player.hitRadius * 1.15;
const restingY = player.y;
golem.animTime = golem.windupFrames;
for (let i = 0; i < 3; i++) resolve();
assert.ok(player.y < restingY, 'raising arm displaces player above it');
Physics.resolveCircleCollision(golem, golem.x, golem.y, 100);
assert.equal(golem.x, 0, 'saw obstacle cannot move golem');
assert.equal(golem.y, 0);
player.x = 10; player.y = 0;
Physics.resolveEntityCollisions([golem, player]);
assert.equal(golem.x, 0, 'immovability does not depend on pair order');
for (const [x, y] of [[0, -140], [140, 0], [-140, 0], [0, 140]]) {
    const e = spawn.createEnemy(0, 0, 1, 'flameGolem');
    const p = new Player(x, y, '#fff', [], null, 'test');
    for (let tick = 0; tick < 240 && e.state !== 'windup'; tick++) {
        e.update([p], () => {});
        for (let i = 0; i < 3; i++) Physics.resolveEntityCollisions([p, e]);
    }
    assert.equal(e.state, 'windup', 'solid body still permits starting melee from every side');
}
console.log('Golem solid body tests passed');
