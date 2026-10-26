/**
 * test_hole_tiles.js — autotile dos buracos (47 tiles, com cantos internos).
 */

import { readFileSync } from 'node:fs';
import { HOLE_TILE, HOLE_TILES, holeMask, holeTileFor } from '../js/config/GameConfig.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`✅ PASSOU: ${message}`);
        passed++;
    } else {
        console.error(`❌ FALHOU: ${message}`);
        failed++;
    }
}

console.log("=== TESTE DO AUTOTILE DE BURACOS ===");

const NW = 16, NE = 32, SE = 64, SW = 128;

const valid = new Set();
for (let edges = 0; edges < 16; edges++) {
    for (let corners = 0; corners < 16; corners++) {
        const c = corners << 4;
        if ((c & NW) && (edges & 9)) continue;
        if ((c & NE) && (edges & 3)) continue;
        if ((c & SE) && (edges & 6)) continue;
        if ((c & SW) && (edges & 12)) continue;
        valid.add(edges | c);
    }
}
const keys = Object.keys(HOLE_TILES).map(Number);
assert(valid.size === 47 && keys.length === 47, `Tabela tem as 47 combinações (${keys.length})`);
assert(keys.every(k => valid.has(k)), "Toda chave da tabela é uma combinação possível");
const indices = Object.values(HOLE_TILES);
assert(new Set(indices).size === indices.length, "Cada combinação usa um tile diferente");

const legacy = { 0: 116, 1: 103, 2: 105, 3: 102, 4: 104, 5: 115, 6: 109, 7: 112,
    8: 106, 9: 101, 10: 114, 11: 110, 12: 107, 13: 113, 14: 111, 15: 100 };
assert(Object.entries(legacy).every(([k, v]) => HOLE_TILES[k] === v), "Os 16 tiles de borda mantêm os índices antigos");

for (const sheet of ["assets/tileset/tileset.png", "assets/tileset/tileset_1.png"]) {
    const png = readFileSync(new URL(`../${sheet}`, import.meta.url));
    const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
    const cells = (w / 16) * (h / 16);
    assert(Math.max(...indices) < cells, `${sheet} (${w}x${h}) contém todos os índices (máx ${Math.max(...indices)})`);
}

const H = HOLE_TILE, F = 16;
// T invertido: coluna (2,1) sobre a faixa (1..3, 2).
const t = [
    [F, F, F, F, F],
    [F, F, H, F, F],
    [F, H, H, H, F],
    [F, F, F, F, F],
];
const isHole = (c, r) => t[r]?.[c] === H;
const center = holeMask(isHole, 2, 2);
assert((center & NW) && (center & NE), "Tile abaixo da coluna ganha os cantos internos NW e NE");
assert(!(center & 1), "Tile abaixo da coluna não tem face norte (vizinho de cima é buraco)");
assert(holeTileFor(t, 2, 2) === HOLE_TILES[4 | NW | NE], "holeTileFor escolhe o tile S+NW+NE");
const left = holeMask(isHole, 1, 2);
assert(!(left & (NW | NE | SE | SW)), "Diagonal é ignorada quando um vizinho ortogonal já é piso");
assert(holeTileFor(t, 2, 1) === HOLE_TILES[1 | 2 | 8], "Topo da coluna continua N+E+W");

// T normal: faixa (1..3, 1) sobre a coluna (2, 2) — cantos internos no lado sul.
const tt = [
    [F, F, F, F, F],
    [F, H, H, H, F],
    [F, F, H, F, F],
    [F, F, F, F, F],
];
const top = holeMask((c, r) => tt[r]?.[c] === H, 2, 1);
assert((top & SW) && (top & SE) && (top & 1), "Tile sobre a coluna tem face norte + cantos SW e SE");

const solid = [[H, H, H], [H, H, H], [H, H, H]];
assert(holeTileFor(solid, 1, 1) === 116, "Miolo de buraco grande continua tile 116");

console.log(`\nRESULTADO: ${passed}/${passed + failed} testes passaram.`);
if (failed > 0) process.exit(1);
