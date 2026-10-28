import assert from 'node:assert/strict';
import { torchPlacement, isMirroredTorch } from '../js/rooms/TorchLayout.js';

const room = {
    cols: 12, rows: 9,
    kinds: Array.from({ length: 9 }, (_, r) => Array.from({ length: 12 }, (_, c) => (r === 0 || r === 8 || c === 0 || c === 11) ? 'w' : 'f')),
    doors: [{ col: 11, row: 3, width: 2 }, { col: 5, row: 0, width: 2 }]
};
room.kinds[5][1] = 'h';

assert.deepEqual(torchPlacement(room, { col: 3, row: 0 }), { col: 3, row: 0, side: 'N' });
assert.deepEqual(torchPlacement(room, { col: 3, row: 8 }), { col: 3, row: 8, side: 'S' });
assert.deepEqual(torchPlacement(room, { col: 0, row: 2 }), { col: 1, row: 2, side: 'W' }, 'borda oeste vira piso col 1');
assert.deepEqual(torchPlacement(room, { col: 1, row: 2 }), { col: 1, row: 2, side: 'W' });
assert.deepEqual(torchPlacement(room, { col: 11, row: 2 }), { col: 10, row: 2, side: 'E' }, 'borda leste vira col cols-2');
assert.deepEqual(torchPlacement(room, { col: 10, row: 6 }), { col: 10, row: 6, side: 'E' });
assert.equal(torchPlacement(room, { col: 5, row: 4 }), null, 'meio da sala não é parede');
assert.equal(torchPlacement(room, { col: 0, row: 0 }), null, 'canto');
assert.equal(torchPlacement(room, { col: 11, row: 3 }), null, 'porta leste');
assert.equal(torchPlacement(room, { col: 10, row: 4 }), null, 'piso à frente da porta leste');
assert.equal(torchPlacement(room, { col: 6, row: 0 }), null, 'porta norte');
assert.equal(torchPlacement(room, { col: 1, row: 5 }), null, 'buraco');

assert.equal(isMirroredTorch({ type: 'torch', side: 'E' }), true);
assert.equal(isMirroredTorch({ side: 'E' }), true, 'sem type vale torch');
assert.equal(isMirroredTorch({ type: 'torch', side: 'W' }), false);
assert.equal(isMirroredTorch({ type: 'candlestick_1', side: 'E' }), false);
console.log('test_torch_layout ok');
