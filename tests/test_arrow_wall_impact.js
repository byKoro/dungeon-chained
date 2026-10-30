import assert from 'node:assert/strict';
import { Arrow } from '../js/entities/ArrowTrap.js';
import { ChallengeCorridor } from '../js/systems/ChallengeCorridor.js';
import { Room } from '../js/rooms/Room.js';
import { createRoom } from '../js/rooms/MapDocument.js';
import { Game } from '../js/Game.js';

const bounds = { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
const wall = { x: 100, y: 0, w: 64, h: 300 };
const arrow = new Arrow(50, 100, 1, 0);
let damage = 0;
arrow.update([{ x: 185, y: 100, hitRadius: 16, takeDamage: () => { damage++; return true; } }], bounds, 0.5, [wall]);
assert.equal(arrow.dead, true, 'arrow must stop at the wall');
assert.ok(arrow.x < wall.x, 'arrow must not tunnel through the wall');
assert.equal(damage, 0, 'wall shields the player');
assert.ok(arrow.wallImpact, 'wall hit provides a one-frame impact');
const stoppedX = arrow.x;
arrow.update([], bounds, 1, [wall]);
assert.equal(arrow.x, stoppedX, 'stopped arrow cannot keep moving');
assert.equal(arrow.wallImpact, null, 'impact cannot repeat');
console.log('Arrow stops at wall without tunneling or damage behind it.');
for (const [x, y, dx, dy] of [[200, 100, -1, 0], [120, -50, 0, 1], [120, 350, 0, -1]]) {
    const a = new Arrow(x, y, dx, dy);
    a.update([], bounds, 1, [wall]);
    assert.ok(a.wallImpact, 'all four directions collide');
}
const launched = new Arrow(120, 100, 1, 0);
launched.update([], bounds, 0.5, [wall]);
assert.equal(launched.dead, false, 'launch can exit its mounting wall');
const challenge = new ChallengeCorridor({ elements: [] }, bounds, {}, null, { walls: [wall] });
challenge.arrows.push(new Arrow(50, 100, 1, 0));
challenge.update([], 0.5);
assert.equal(challenge.arrows.length, 0);
assert.equal(challenge.arrowImpacts.length, 1);
const sparks = [];
Game.prototype._arrowTrapFeedback.call({ particleSystem: { triggerSparkBurst: (...args) => sparks.push(args) } }, challenge);
assert.equal(sparks.length, 1);
assert.equal(sparks[0][3], 3, 'impact is a small burst');
challenge.update([], 1 / 60);
assert.equal(challenge.arrowImpacts.length, 0, 'impact clears next step');
const authored = createRoom(10, 10);
const cell = { gx: 0, gy: 0, kind: 'room', doors: {}, authored, customFloor: authored.tiles,
    customWalls: [{ col: 5, row: 4 }], customHazards: [{ type: 'arrow', col: 0, row: 4 }] };
const room = new Room(cell, { minX: 64, minY: 64, maxX: 576, maxY: 576 });
room.populate(null, 1);
assert.ok(room.challenge.walls.some(w => w.x === 320 && w.y === 256));
assert.ok(room.challenge.walls.some(w => w.x === 0), 'room injects perimeter walls');
console.log('Impact queue, light sparks, mounting exit and room collision wiring pass.');
