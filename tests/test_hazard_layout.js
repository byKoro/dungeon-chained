import assert from 'node:assert/strict';
import {
    ARROW_WALL_INSET, SPIKE_ROW_WAVE, arrowFireDir, arrowMountOffset, wallSideForTile, spikeRowPhase, fitSpikeRow
} from '../js/rooms/HazardLayout.js';
import { ChallengeCorridor } from '../js/systems/ChallengeCorridor.js';
import { createRoom } from '../js/rooms/MapDocument.js';
import { placeDoor } from '../js/editor2/MapContent.js';

// document simulado: só o que os métodos de colocação do editor 2 leem.
const fields = { 'content-timing': 'normal', 'content-delay': '0', 'content-direction': 'right', 'content-count': '4', 'content-hint': {} };
globalThis.document = { getElementById: id => (id === 'content-hint' ? fields[id] : { value: fields[id] }) };
const { ContentTools } = await import('../js/editor2/ContentTools.js');

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);

// --- direção e encaixe da flecha ---
assert.deepEqual(arrowFireDir('left'), { x: 1, y: 0 });
assert.deepEqual(arrowFireDir('right'), { x: -1, y: 0 });
assert.deepEqual(arrowFireDir('top'), { x: 0, y: 1 });
assert.deepEqual(arrowFireDir('bottom'), { x: 0, y: -1 });
assert.deepEqual(arrowFireDir('right', true), { x: 1, y: 0 }, 'parede lateral interna inverte x');
assert.deepEqual(arrowFireDir('top', true), { x: 0, y: 1 }, 'parede vertical interna não inverte');
assert.equal(arrowFireDir('nada'), null);
assert.deepEqual(arrowMountOffset({ x: 1, y: 0 }), { x: ARROW_WALL_INSET, y: 0 });
assert.deepEqual(arrowMountOffset({ x: -1, y: 0 }), { x: -ARROW_WALL_INSET, y: 0 });
assert.deepEqual(arrowMountOffset({ x: 0, y: 1 }), { x: 0, y: 0 });
assert.equal(wallSideForTile(20), 'right');
assert.equal(wallSideForTile(25), 'left');
assert.equal(wallSideForTile(2), 'top');
assert.equal(wallSideForTile(42), 'bottom');

// --- fases da onda ---
const phases = (h, n) => Array.from({ length: n }, (_, i) => spikeRowPhase(h, i));
[0, 0.88, 0.76, 0.64].forEach((v, i) => near(phases({ dir: 'right' }, 4)[i], v));
[0, 0.12, 0.24, 0.36].forEach((v, i) => near(phases({ dir: 'left' }, 4)[i], v));
near(SPIKE_ROW_WAVE, 0.12);
assert.ok(phases({ dir: 'down', wave: 0 }, 4).every(p => p === 0), 'wave 0 explícito = tudo junto');

// --- fileira cabe na sala ---
assert.deepEqual(fitSpikeRow(14, 9, 12, 2, 'right', 4), { col: 9, row: 2, count: 4 });
assert.deepEqual(fitSpikeRow(14, 9, 3, 2, 'right', 40), { col: 1, row: 2, count: 12 });
assert.deepEqual(fitSpikeRow(14, 9, 10, 6, 'down', 20), { col: 10, row: 1, count: 7 });

// --- jogo: posição das flechas e onda da fileira ---
const bounds = { minX: 64, minY: 64, maxX: 832, maxY: 512 };
const arrows = [
    { type: 'arrow', col: 0, row: 4, side: 'left' }, { type: 'arrow', col: 13, row: 4, side: 'right' },
    { type: 'arrow', col: 6, row: 0, side: 'top' }, { type: 'arrow', col: 7, row: 8, side: 'bottom' },
    { type: 'arrow', col: 5, row: 4, side: 'right' }
];
const traps = new ChallengeCorridor({ elements: arrows }, bounds, {}, null).arrowTraps;
const at = i => [traps[i].x, traps[i].y, traps[i].dirX, traps[i].dirY];
assert.deepEqual(at(0), [32 + ARROW_WALL_INSET, 288, 1, 0], 'oeste: deslocada para cima do tijolo');
assert.deepEqual(at(1), [864 - ARROW_WALL_INSET, 288, -1, 0], 'leste: deslocada para cima do tijolo');
assert.deepEqual(at(2), [416, 32, 0, 1], 'norte: sem deslocamento');
assert.deepEqual(at(3), [480, 544, 0, -1], 'sul: sem deslocamento');
assert.deepEqual(at(4), [352 + ARROW_WALL_INSET, 288, 1, 0], 'parede interna lateral: dispara para dentro');

// Primeiro instante em que cada espinho sai do chão (borda de subida). Sem `wave` no dado, vale o padrão.
function risingEdges(dir) {
    const spikes = new ChallengeCorridor({ elements: [{ type: 'spikeRow', col: 3, row: 2, dir, count: 4, timing: 'normal' }] }, bounds, {}, null).spikes;
    const edges = spikes.map(() => null), prev = spikes.map(() => undefined);
    for (let tick = 0; tick < 60 * 5; tick++) {
        spikes.forEach((s, i) => {
            s.update([], 1 / 60);
            const danger = s.isDangerous;
            if (prev[i] === false && danger && edges[i] === null) edges[i] = tick / 60;
            prev[i] = danger;
        });
    }
    return edges;
}
const right = risingEdges('right'), left = risingEdges('left');
for (let i = 1; i < 4; i++) {
    assert.ok(right[i] > right[i - 1], `direita: espinho ${i} sobe depois do ${i - 1} (${right})`);
    assert.ok(left[i] < left[i - 1], `esquerda: espinho ${i} sobe antes do ${i - 1} (${left})`);
}
near(right[1] - right[0], 0.12 * 3.3, 0.05);

// --- editor 2: montagem da flecha e colocação das armadilhas ---
const tools = Object.create(ContentTools.prototype);
const room = createRoom(14, 9);
assert.deepEqual(tools._arrowMount(room, 0, 4), { col: 0, row: 4, side: 'left' });
assert.deepEqual(tools._arrowMount(room, 13, 4), { col: 13, row: 4, side: 'right' });
assert.deepEqual(tools._arrowMount(room, 6, 0), { col: 6, row: 0, side: 'top' });
assert.deepEqual(tools._arrowMount(room, 2, 4), { col: 0, row: 4, side: 'left' }, 'clique no chão encaixa na parede mais próxima');
assert.deepEqual(tools._arrowMount(room, 6, 1), { col: 6, row: 0, side: 'top' });
placeDoor(room, 0, 4, 'normal', 2);
assert.equal(tools._arrowMount(room, 0, 4), null, 'não monta em porta');

const rowRoom = createRoom(14, 9);
tools.choice = 'spikeRow';
tools._applyHazard(rowRoom, { col: 12, row: 2 }, true);
assert.equal(rowRoom.hazards.length, 1);
assert.deepEqual(
    { ...rowRoom.hazards[0] },
    { type: 'spikeRow', col: 9, row: 2, timing: 'normal', delay: 0, dir: 'right', count: 4, phase: 0, wave: 0.12 }
);
tools._applyHazard(rowRoom, { col: 10, row: 2 }, true);
assert.equal(rowRoom.hazards.length, 0, 'clicar em qualquer tile da fileira remove a fileira');
tools.choice = 'spike';
tools._applyHazard(rowRoom, { col: 10, row: 2 }, true);
tools.choice = 'spikeRow';
tools._applyHazard(rowRoom, { col: 8, row: 2 }, true);
assert.equal(rowRoom.hazards.length, 1, 'fileira sobre outra armadilha é recusada');

console.log('Armadilhas: flechas nas paredes laterais, onda da fileira e colocação no editor 2 passaram.');
