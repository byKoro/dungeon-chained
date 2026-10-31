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
assert.deepEqual(torchPlacement(room, { col: 1, row: 5 }), { col: 1, row: 5, side: 'W' }, 'ao lado de buraco vale (pedido do usuário)');

// Paredes criadas pelo pincel, fora da moldura.
{
    const r = {
        cols: 12, rows: 9, doors: [],
        kinds: Array.from({ length: 9 }, (_, y) => Array.from({ length: 12 }, (_, x) => (y === 0 || y === 8 || x === 0 || x === 11) ? 'w' : 'f'))
    };
    for (let x = 4; x <= 7; x++) r.kinds[4][x] = 'w';     // parede horizontal no meio
    r.kinds[2][9] = 'w'; r.kinds[3][9] = 'w';             // parede vertical curta
    r.kinds[6][2] = 'w'; r.kinds[7][2] = 'h';             // parede com buraco embaixo
    assert.deepEqual(torchPlacement(r, { col: 5, row: 4 }), { col: 5, row: 4, side: 'N' }, 'parede criada: face de baixo');
    r.kinds[5][6] = 'w';
    assert.deepEqual(torchPlacement(r, { col: 6, row: 4 }), { col: 6, row: 4, side: 'S' }, 'sem piso embaixo: face de cima');
    assert.deepEqual(torchPlacement(r, { col: 6, row: 5 }), { col: 6, row: 5, side: 'N' });
    assert.deepEqual(torchPlacement(r, { col: 9, row: 2 }), { col: 9, row: 2, side: 'S' }, 'vertical: face de cima exposta');
    r.kinds[1][9] = 'w';
    assert.deepEqual(torchPlacement(r, { col: 9, row: 2 }), { col: 10, row: 2, side: 'W' }, 'vertical: lateral direita');
    assert.deepEqual(torchPlacement(r, { col: 10, row: 3 }), { col: 10, row: 3, side: 'W' }, 'clique no piso ao lado da parede criada');
    assert.deepEqual(torchPlacement(r, { col: 8, row: 3 }), { col: 8, row: 3, side: 'E' }, 'piso à esquerda da parede criada');
    assert.deepEqual(torchPlacement(r, { col: 2, row: 6 }), { col: 2, row: 6, side: 'N' }, 'parede criada sobre buraco');
    r.kinds[3][3] = 'w'; r.kinds[2][3] = 'w'; r.kinds[3][2] = 'w'; r.kinds[3][4] = 'w';
    r.kinds[4][3] = 'w';
    assert.equal(torchPlacement(r, { col: 3, row: 3 }), null, 'parede cercada de parede: sem face');
    r.kinds[5][1] = 'v';
    assert.equal(torchPlacement(r, { col: 6, row: 2 }), null, 'piso no meio, sem parede ao lado');
}

assert.equal(isMirroredTorch({ type: 'torch', side: 'E' }), true);
assert.equal(isMirroredTorch({ side: 'E' }), true, 'sem type vale torch');
assert.equal(isMirroredTorch({ type: 'torch', side: 'W' }), false);
assert.equal(isMirroredTorch({ type: 'candlestick_1', side: 'E' }), false);
console.log('test_torch_layout ok');
