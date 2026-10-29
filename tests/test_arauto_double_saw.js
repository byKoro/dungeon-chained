import assert from 'node:assert/strict';
import { SawWeapon } from '../js/weapons/SawWeapon.js';
import { Chain } from '../js/core/Chain.js';
import { ChainObstacleSystem } from '../js/systems/ChainObstacleSystem.js';
import { ArautoAudio } from '../js/systems/ArautoAudio.js';
import { CombatSystem } from '../js/combat/CombatSystem.js';
import { SpawnSystem } from '../js/systems/SpawnSystem.js';
import { Game } from '../js/Game.js';
import { Physics } from '../js/core/Physics.js';

const weapon = new SawWeapon();
weapon.doubleSaw = true; weapon.split = 1; weapon.spin = 1;
const chain = new Chain([weapon]);
const players = [{ x: -300, y: -24, vx: 0, vy: 0, hitRadius: 16 }, { x: 300, y: -24, vx: 0, vy: 0, hitRadius: 16 }];
const boss = { x: 0, y: 0, state: 'chase', immovable: true, effectMaterial: 'lavaStone',
    collisionBodies: [{ x: 0, y: 0, radiusX: 12, radiusY: 12 }] };
const obstacles = new ChainObstacleSystem();
obstacles.beginStep(chain);
assert.equal(obstacles.resolve(chain, ...players, [boss]), true);
assert.equal(players[0].y, -24, 'no imaginary midpoint disc blocks the split cable');
assert.equal(weapon.obstacleContacts.size, 0);
boss.x = 100;
obstacles.beginStep(chain);
obstacles.resolve(chain, ...players, [boss]);
assert.ok(players[0].y < -24, 'second disc collides with boss');
assert.equal(weapon.obstacleContacts.get(boss).kind, 'disc');
let level = 0;
const sound = new ArautoAudio({ audio: { createLoopVoice() { return { set(target) { level = target.level; } }; } } });
sound.update(weapon, [boss], { players });
assert.ok(level > 0, 'second disc also produces rock contact sound');

let hits = 0;
const target = { x: 100, y: 10, hitRadius: 12, state: 'chase', takeHit() { hits++; return true; } };
players[0].y = players[1].y = -24;
weapon.obstacleContacts.clear();
const combat = new CombatSystem({ renderer: { triggerShake() {} }, particleSystem: {}, hitFeedback: true });
combat.resolveWeaponHits(weapon, [target], ...players);
assert.equal(hits, 1, 'ordinary enemy is hit by second disc beyond cable reach');
const spawn = new SpawnSystem({ assets: { get: () => null }, bloodCanvas: { palette: [] } });
assert.equal(spawn.createEnemy(0, 0, 1, 'flameGolem').effectMaterial, 'lavaStone');
assert.equal(spawn.createEnemy(0, 0, 1, 'ghostfire').isGhostfire, true, 'both boss factories survive merge');
weapon.split = 0;
boss.x = 0;
boss.collisionBodies = [{ x: 0, y: 0, radiusX: 45, radiusY: 40 }];
const solid = [{ x: -200, y: -200, w: 400, h: 125 }];
for (const kind of ['props', 'bars']) {
    players[0].x = -100; players[1].x = 100;
    players[0].y = players[1].y = -50;
    let propCalls = 0;
    const game = { p1: players[0], p2: players[1], rooms: { clampPlayer() {} },
        roomProps: { resolveCollisions(ps) {
            propCalls++;
            if (kind === 'props') for (const p of ps) Physics.resolveBoxCollisions(p, solid);
        } }
    };
    const constrain = () => Game.prototype._constrainTetherPlayers.call(game,
        { wallBoxes: [] }, kind === 'bars' ? solid : [], [], false);
    obstacles.beginStep(chain);
    assert.equal(obstacles.resolve(chain, ...players, [boss], constrain), false,
        `final tether correction respects ${kind} and reports pinching`);
    assert.ok(propCalls > 0);
    assert.ok(players.every(p => p.y >= -59), 'players remain outside solid obstruction');
}
console.log('Merged Arauto/double saw/Ghostfire integration passed');
