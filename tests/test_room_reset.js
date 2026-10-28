import assert from 'node:assert/strict';
import { createMap, addRoom, resetRoom, validateMap, setCell, placeProp } from '../js/editor2/MapModel.js';
import { placeDoor } from '../js/editor2/MapContent.js';
import { connectDoors } from '../js/rooms/MapConnections.js';

const map = createMap({ gridCols: 3, gridRows: 1 });
const a = addRoom(map, 0, 0, { cols: 16, rows: 11, name: 'Alfa' });
const b = addRoom(map, 1, 0, { cols: 14, rows: 9, name: 'Beta' });
a.notes = 'notas da alfa';
placeDoor(a, 15, 5, 'normal', 2, 'door_a');
placeDoor(b, 0, 4, 'normal', 2, 'door_b');
connectDoors(map, { room: '0,0', door: 'door_a' }, { room: '1,0', door: 'door_b' }, {});
placeProp(a, 'chest', 4, 4);
a.enemies.push({ type: 'demon', col: 5, row: 5 });
a.torches.push({ col: 3, row: 0, side: 'N', type: 'torch' });
a.hazards.push({ type: 'spike', col: 6, row: 6 });
a.interactives.push({ type: 'altarDash', id: 'x', col: 7, row: 7 });
a.spawns = { p1: { col: 3, row: 3 }, p2: { col: 3, row: 4 } };
a.lock = 'enemies'; a.type = 'boss'; a.propDensity = 0.2;
setCell(a, 8, 8, 5, 'w');
const ref = a;

assert.equal(resetRoom(map, '9,9'), false, 'sala inexistente');
assert.equal(resetRoom(map, '0,0'), true);
assert.equal(map.rooms['0,0'], ref, 'mantém a referência do objeto');
assert.equal(a.cols, 16); assert.equal(a.rows, 11);
assert.equal(a.id, 'sala_0_0'); assert.equal(a.name, 'Alfa'); assert.equal(a.notes, 'notas da alfa');
for (const f of ['doors', 'props', 'enemies', 'hazards', 'torches', 'interactives']) assert.deepEqual(a[f], [], f);
assert.equal(a.spawns, null); assert.equal(a.lock, 'none'); assert.equal(a.type, 'normal');
assert.equal(a.propDensity, undefined);
assert.equal(a.kinds[8][8], 'f', 'miolo volta a piso');
assert.equal(a.kinds[0], 'w'.repeat(16), 'moldura refeita');
assert.equal(a.tiles.length, 11); assert.equal(a.tiles[0].length, 16);
assert.deepEqual(map.connections, [], 'conexão da sala removida');
assert.equal(validateMap(map).errors.length, 0);

// só as conexões da sala resetada saem
const c = addRoom(map, 2, 0);
placeDoor(b, 13, 4, 'normal', 2, 'door_b2');
placeDoor(c, 0, 4, 'normal', 2, 'door_c');
connectDoors(map, { room: '1,0', door: 'door_b2' }, { room: '2,0', door: 'door_c' }, {});
resetRoom(map, '0,0');
assert.equal(map.connections.length, 1, 'conexão de outras salas permanece');
resetRoom(map, '2,0');
assert.equal(map.connections.length, 0);

console.log('test_room_reset ok');
