/**
 * mapLayout — gera (de forma DETERMINÍSTICA) a dungeon da cena de geração de
 * mapas: grade de salas com formatos variados, corredores, autotile das
 * paredes, piso com beiradas, buracos e o conteúdo de cada sala (props,
 * tochas, espinhos, botões, flechas, inimigos, portas trancadas).
 *
 * Puro (sem DOM): dá para validar no node.
 *
 * Coordenadas: tudo em TILES de uma grade GLOBAL (MAP_W x MAP_H). Cada
 * célula da grade de salas tem CELL_W x CELL_H tiles; a sala (bbox com a
 * moldura de parede) fica centrada nela. Os corredores passam sempre pelas
 * mesmas faixas (linhas 5-6 / colunas 8-9 da célula), que coincidem com o
 * "meio" de qualquer sala (mesma convenção de portas de 2 tiles do jogo).
 *
 * PAREDES (estilo do tileset do jogo): parede = faixa fina em volta do vazio,
 * com a FACE de tijolos visível só na parede de cima. Cada célula de parede
 * olha os 8 vizinhos (piso = piso ou buraco) e escolhe o tile:
 *   piso S -> face (2/3)            piso N -> tampa da base (42/43)
 *   piso L -> faixa esq. (10/20/30) piso O -> faixa dir. (15/25/35)
 *   só diagonal -> quinas externas 0/5/40/45
 *   N+O -> quina interna 50/54      N+L -> quina interna 55/53
 *   S+O -> face + faixa do tile 5   S+L -> face + faixa do tile 0 (compostos)
 * Qualquer outra combinação (parede de 1 tile entre dois pisos, beliscão na
 * diagonal) é INVÁLIDA: os formatos são gerados para nunca cair nela e
 * `validateDungeon` confere.
 */
import { HOLE_TILES } from '../../../config/GameConfig.js';

export const CELL_W = 18;
export const CELL_H = 13;
export const GRID_W = 15;
export const GRID_H = 9;
export const CENTER = { i: 7, j: 4 };
export const MAP_W = GRID_W * CELL_W;
export const MAP_H = GRID_H * CELL_H;

// Meia-extensão (em células) de cada nível de zoom: 1 sala, 3x3, 7x5, 15x9.
export const LEVEL_SPAN = [[0, 0], [1, 1], [3, 2], [7, 4]];

export function levelOf(i, j) {
    const dx = Math.abs(i - CENTER.i), dy = Math.abs(j - CENTER.j);
    for (let k = 0; k < LEVEL_SPAN.length; k++) {
        if (dx <= LEVEL_SPAN[k][0] && dy <= LEVEL_SPAN[k][1]) return k;
    }
    return LEVEL_SPAN.length - 1;
}

/** Retângulo (tiles) que enquadra o nível k. */
export function levelRectTiles(k) {
    const [sx, sy] = LEVEL_SPAN[k];
    return {
        x: (CENTER.i - sx) * CELL_W, y: (CENTER.j - sy) * CELL_H,
        w: (sx * 2 + 1) * CELL_W, h: (sy * 2 + 1) * CELL_H
    };
}

// ---------------------------------------------------------------------------
// RNG / hash
export function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function hash2(x, y, s = 0) {
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
function pickWeighted(rng, list) {
    const total = list.reduce((s, [, w]) => s + w, 0);
    let r = rng() * total;
    for (const [v, w] of list) { if ((r -= w) <= 0) return v; }
    return list[list.length - 1][0];
}

// ---------------------------------------------------------------------------
// Autotile
const N = 1, E = 2, S = 4, W = 8, NE = 16, SE = 32, SW = 64, NW = 128;
const DIRS8 = [[0, -1, N], [1, 0, E], [0, 1, S], [-1, 0, W], [1, -1, NE], [1, 1, SE], [-1, 1, SW], [-1, -1, NW]];
export const NB = { N, E, S, W, NE, SE, SW, NW };

export function neighborMask(isF, x, y) {
    let m = 0;
    for (const [dx, dy, b] of DIRS8) if (isF(x + dx, y + dy)) m |= b;
    return m;
}

// Diagonais permitidas para cada combinação de vizinhos cardeais com piso.
const ALLOWED_DIAG = {
    [S]: SW | SE, [N]: NW | NE, [E]: NE | SE, [W]: NW | SW,
    [N | W]: NW | NE | SW, [N | E]: NE | NW | SE,
    [S | W]: SW | NW | SE, [S | E]: SE | NE | SW
};

/**
 * Tile de PAREDE para uma célula sem piso cujo vizinhança é `m`.
 * @returns {null | {t:number, ov?:{t,sx,sw}, front?:boolean} | {bad:true}}
 *   null = vazio (sem piso em volta); `ov` = faixa de outro tile por cima
 *   (tiles compostos); `front` = parede da BASE (desenhada por cima dos atores).
 */
export function wallTile(m, x, y) {
    if (!m) return null;
    const card = m & 15, diag = m & 240;
    if (card === 0) {
        if (diag === SE) return { t: 0 };
        if (diag === SW) return { t: 5 };
        if (diag === NE) return { t: 40, front: true };
        if (diag === NW) return { t: 45, front: true };
        return { bad: true };
    }
    const allow = ALLOWED_DIAG[card];
    if (allow === undefined || (diag & ~allow)) return { bad: true };
    const v = hash2(x, y, 7);
    switch (card) {
        case S: return { t: v < 0.82 ? 2 : 3 };
        case N: return { t: v < 0.7 ? 42 : 43, front: true };
        case E: return { t: v < 0.6 ? 20 : v < 0.8 ? 10 : 30 };
        case W: return { t: v < 0.6 ? 25 : v < 0.8 ? 15 : 35 };
        case N | W: return { t: v < 0.6 ? 50 : 54, front: true };
        case N | E: return { t: v < 0.6 ? 55 : 53, front: true };
        // Quina interna de cima: face de tijolos + a faixa vertical que desce.
        case S | W: return { t: 2, ov: { t: 5, sx: 0, sw: 8 } };
        case S | E: return { t: 2, ov: { t: 0, sx: 8, sw: 8 } };
    }
    return { bad: true };
}

const FLOOR_VARIANTS = [6, 7, 8, 17, 18, 26, 27];

/** Tile de PISO (ou de buraco) em (x,y). */
export function floorTile(isF, isHole, x, y) {
    if (isHole(x, y)) {
        let mask = 0;
        if (!isHole(x, y - 1)) mask |= 1;
        if (!isHole(x + 1, y)) mask |= 2;
        if (!isHole(x, y + 1)) mask |= 4;
        if (!isHole(x - 1, y)) mask |= 8;
        return HOLE_TILES[mask];
    }
    const wN = !isF(x, y - 1), wE = !isF(x + 1, y), wS = !isF(x, y + 1), wW = !isF(x - 1, y);
    if ((wN && wS) || (wE && wW)) return 16;
    if (wN && wW) return 11;
    if (wN && wE) return 14;
    if (wS && wW) return 31;
    if (wS && wE) return 34;
    const v = hash2(x, y, 3);
    if (wN) return v < 0.6 ? 12 : 13;
    if (wS) return v < 0.6 ? 32 : 33;
    if (wW) return 21;
    if (wE) return 24;
    return v < 0.09 ? FLOOR_VARIANTS[Math.floor(v * 1000) % FLOOR_VARIANTS.length] : 16;
}

// ---------------------------------------------------------------------------
// Acesso à grade global
const idx = (x, y) => y * MAP_W + x;
const inMap = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

/** Predicados de piso: globais ou só de uma sala (versão "selada"). */
export function floorPredicates(D, roomId = null) {
    if (roomId === null) {
        return {
            isF: (x, y) => inMap(x, y) && D.floor[idx(x, y)] > 0,
            isHole: (x, y) => inMap(x, y) && D.floor[idx(x, y)] === 2
        };
    }
    return {
        isF: (x, y) => inMap(x, y) && D.floor[idx(x, y)] > 0 && D.room[idx(x, y)] === roomId,
        isHole: (x, y) => inMap(x, y) && D.floor[idx(x, y)] === 2 && D.room[idx(x, y)] === roomId
    };
}

/**
 * Tile em (x,y): `{ floor: idx }` | spec de parede | null (vazio).
 * `pred` vem de floorPredicates (global ou selada).
 */
export function tileAt(pred, x, y) {
    if (pred.isF(x, y)) return { t: floorTile(pred.isF, pred.isHole, x, y), floor: true };
    return wallTile(neighborMask(pred.isF, x, y), x, y);
}

// ---------------------------------------------------------------------------
// Formatos de sala (máscara local h x w; 1 = piso). Interior = 1..w-2 x 1..h-2.
// Os "corredores do meio" (2 linhas e 2 colunas centrais) ficam SEMPRE
// inteiros: é por eles que as portas se ligam aos corredores.
const ROOM_SIZES = [[14, 9], [14, 9], [12, 9], [16, 11], [10, 7], [14, 11], [16, 9], [12, 11], [16, 11]];

function geom(w, h) {
    const midC = w / 2, midR = h >> 1;
    return {
        midC, midR,
        lw: midC - 2,            // colunas de cada lado das faixas centrais
        th: midR - 2,            // linhas acima das faixas centrais
        bh: h - 2 - midR         // linhas abaixo
    };
}

function rectMask(w, h) {
    const m = [];
    for (let y = 0; y < h; y++) {
        const row = new Uint8Array(w);
        if (y > 0 && y < h - 1) for (let x = 1; x < w - 1; x++) row[x] = 1;
        m.push(row);
    }
    return m;
}
function carve(m, x0, y0, x1, y1, v = 0) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) m[y][x] = v;
}
// Remove um canto (q = 'NW' | 'NE' | 'SW' | 'SE') de a colunas x b linhas.
function cutCorner(m, w, h, q, a, b) {
    const left = q[1] === 'W', top = q[0] === 'N';
    const x0 = left ? 1 : w - 1 - a, x1 = left ? a : w - 2;
    const y0 = top ? 1 : h - 1 - b, y1 = top ? b : h - 2;
    carve(m, x0, y0, x1, y1);
}
// Chanfro em escada nos 4 cantos (dx + dy < k).
function chamfer(m, w, h, k) {
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const dx = Math.min(x - 1, w - 2 - x), dy = Math.min(y - 1, h - 2 - y);
        if (dx + dy < k) m[y][x] = 0;
    }
}
// Pilares 2x2 (blocos de parede) nos quatro quadrantes.
function pillars(m, w, h, c) {
    const { midR } = geom(w, h);
    const rows = [2, midR + 2];
    for (const r of rows) {
        carve(m, c, r, c + 1, r + 1);
        carve(m, w - 2 - c, r, w - 1 - c, r + 1);
    }
}

export const SHAPES = ['rect', 'L', 'cross', 'T', 'octagon', 'pillars', 'hall'];

export function makeShape(kind, w, h, rng) {
    const g = geom(w, h);
    const m = rectMask(w, h);
    const corners = ['NW', 'NE', 'SW', 'SE'];
    const bFor = (q) => q[0] === 'N' ? randInt(rng, 1, g.th) : randInt(rng, 1, g.bh - 1);
    switch (kind) {
        case 'L': {
            const q = pick(rng, corners);
            cutCorner(m, w, h, q, randInt(rng, 2, g.lw - 1), bFor(q));
            break;
        }
        case 'cross': {
            const a = randInt(rng, 2, g.lw - 1), bt = randInt(rng, 1, g.th), bb = randInt(rng, 1, g.bh - 1);
            for (const q of corners) cutCorner(m, w, h, q, a, q[0] === 'N' ? bt : bb);
            break;
        }
        case 'T': {
            const side = rng() < 0.5 ? 'N' : 'S';
            const a = randInt(rng, 2, g.lw - 1), b = bFor(side + 'W');
            cutCorner(m, w, h, side + 'W', a, b);
            cutCorner(m, w, h, side + 'E', a, b);
            break;
        }
        case 'octagon':
            chamfer(m, w, h, randInt(rng, 2, Math.max(2, Math.min(g.th, g.lw - 1))));
            break;
        case 'pillars':
            pillars(m, w, h, 2 + (rng() < 0.5 && g.lw >= 5 ? 1 : 0));
            break;
        case 'hall':
            chamfer(m, w, h, 2);
            pillars(m, w, h, 3);
            break;
    }
    return m;
}

function shapeAllowed(kind, w, h) {
    const g = geom(w, h);
    switch (kind) {
        case 'L': case 'cross': case 'T': return g.lw >= 3 && g.th >= 1 && g.bh >= 2;
        case 'octagon': return g.th >= 2 && g.lw >= 3;
        case 'pillars': return h >= 11 && g.lw >= 4;
        case 'hall': return h >= 11 && g.lw >= 5;
    }
    return true;
}

// Confere se a máscara local gera só paredes válidas.
function maskValid(m, w, h) {
    const isF = (x, y) => y >= 0 && y < h && x >= 0 && x < w && m[y][x] > 0;
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
        if (isF(x, y)) continue;
        const s = wallTile(neighborMask(isF, x, y), x, y);
        if (s && s.bad) return false;
    }
    return true;
}

// ---------------------------------------------------------------------------
/**
 * Gera a dungeon inteira.
 * @returns {object} D = { rooms, corridors, floor, room, corr, cover, solid }
 */
export function buildDungeon(seed = 20261018) {
    const rng = mulberry32(seed);
    const D = {
        rooms: [], corridors: [],
        floor: new Uint8Array(MAP_W * MAP_H),           // 0 vazio, 1 piso, 2 buraco
        room: new Int16Array(MAP_W * MAP_H).fill(-1),   // sala dona do piso
        corr: new Int16Array(MAP_W * MAP_H).fill(-1),   // corredor dono do piso
        cover: new Int16Array(MAP_W * MAP_H).fill(-1),  // células redesenhadas pelo corredor
        solid: new Uint8Array(MAP_W * MAP_H)            // props que bloqueiam (caixas, baús)
    };

    // 1) Quais células recebem sala (sempre conectadas ao centro).
    const cells = [];
    for (let j = 0; j < GRID_H; j++) for (let i = 0; i < GRID_W; i++) {
        cells.push({ i, j, level: levelOf(i, j), d: Math.hypot(i - CENTER.i, (j - CENTER.j) * 1.4) });
    }
    cells.sort((a, b) => a.level - b.level || a.d - b.d);
    const grid = new Map();
    const key = (i, j) => `${i},${j}`;
    const edges = [];
    const hasEdge = new Set();
    const addEdge = (A, B) => {
        const k = A.id < B.id ? `${A.id}-${B.id}` : `${B.id}-${A.id}`;
        if (hasEdge.has(k)) return;
        hasEdge.add(k);
        edges.push([A, B]);
    };
    for (const c of cells) {
        const nbs = [[1, 0], [-1, 0], [0, 1], [0, -1]]
            .map(([dx, dy]) => grid.get(key(c.i + dx, c.j + dy))).filter(Boolean);
        if (c.level > 0 && !nbs.length) continue;
        if (c.level >= 2 && rng() > 0.84) continue;
        const R = { id: D.rooms.length, i: c.i, j: c.j, level: c.level, d: c.d };
        D.rooms.push(R);
        grid.set(key(c.i, c.j), R);
        if (nbs.length) addEdge(nbs[Math.floor(rng() * nbs.length)], R);
    }
    // Ligações extras (laços), mais densas perto do centro.
    for (const R of D.rooms) {
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
            const B = grid.get(key(R.i + dx, R.j + dy));
            if (!B) continue;
            const p = Math.max(R.level, B.level) <= 1 ? 0.75 : 0.3;
            if (rng() < p) addEdge(R, B);
        }
    }

    // 2) Tamanho e formato de cada sala.
    for (const R of D.rooms) {
        let w, h, shape;
        if (R.level === 0) { w = 16; h = 11; shape = 'rect'; }
        else {
            [w, h] = pick(rng, ROOM_SIZES);
            shape = pickWeighted(rng, [['rect', 34], ['L', 15], ['cross', 12], ['T', 10], ['octagon', 14], ['pillars', 9], ['hall', 6]]);
            if (!shapeAllowed(shape, w, h)) shape = shapeAllowed('octagon', w, h) && rng() < 0.5 ? 'octagon' : 'L';
            if (!shapeAllowed(shape, w, h)) shape = 'rect';
        }
        let mask = makeShape(shape, w, h, rng);
        if (!maskValid(mask, w, h)) { shape = 'rect'; mask = rectMask(w, h); }
        Object.assign(R, {
            w, h, shape, mask,
            gx: R.i * CELL_W + (CELL_W - w) / 2,
            gy: R.j * CELL_H + (CELL_H - h) / 2,
            ...geom(w, h),
            doors: [], props: [], torches: [], spikes: [], buttons: [], traps: [], enemies: [],
            locked: false, theme: 'plain'
        });
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            if (!mask[y][x]) continue;
            const k = idx(R.gx + x, R.gy + y);
            D.floor[k] = 1; D.room[k] = R.id;
        }
    }

    // 3) Corredores (2 tiles de largura) entre salas vizinhas ligadas.
    for (let [A, B] of edges) {
        if (A.i > B.i || A.j > B.j) [A, B] = [B, A];
        const C = { id: D.corridors.length, a: A, b: B, cells: [], cover: [] };
        if (B.i === A.i + 1) {
            C.dir = 'H';
            const r0 = A.j * CELL_H + 5;
            const xa = A.gx + A.w - 2, xb = B.gx + 1;
            for (let x = xa + 1; x <= xb - 1; x++) C.cells.push([x, r0], [x, r0 + 1]);
            C.doorA = { room: A, side: 'E', cells: [[xa + 1, r0], [xa + 1, r0 + 1]] };
            C.doorB = { room: B, side: 'W', cells: [[xb - 1, r0], [xb - 1, r0 + 1]] };
        } else {
            C.dir = 'V';
            const c0 = A.i * CELL_W + 8;
            const ya = A.gy + A.h - 2, yb = B.gy + 1;
            for (let y = ya + 1; y <= yb - 1; y++) C.cells.push([c0, y], [c0 + 1, y]);
            C.doorA = { room: A, side: 'S', cells: [[c0, ya + 1], [c0 + 1, ya + 1]] };
            C.doorB = { room: B, side: 'N', cells: [[c0, yb - 1], [c0 + 1, yb - 1]] };
        }
        for (const [x, y] of C.cells) { D.floor[idx(x, y)] = 1; D.corr[idx(x, y)] = C.id; }
        A.doors.push(C.doorA); B.doors.push(C.doorB);
        D.corridors.push(C);
    }
    // Área redesenhada por cada corredor: o próprio piso + os 8 vizinhos
    // (as paredes da junção mudam quando o corredor existe).
    for (const C of D.corridors) {
        const seen = new Set();
        for (const [x, y] of C.cells) {
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const k = idx(x + dx, y + dy);
                if (seen.has(k)) continue;
                seen.add(k);
                C.cover.push([x + dx, y + dy]);
                D.cover[k] = C.id;
            }
        }
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of C.cover) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        C.bbox = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }

    // 4) Conteúdo de cada sala.
    for (const R of D.rooms) placeContent(D, R, rng);

    // Buracos vão para a grade global (contam como piso para as paredes).
    for (const R of D.rooms) {
        for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) {
            if (R.mask[y][x] === 2) D.floor[idx(R.gx + x, R.gy + y)] = 2;
        }
    }
    return D;
}

// ---------------------------------------------------------------------------
// Conteúdo
const THEMES = [['plain', 26], ['spikes', 16], ['pits', 15], ['buttons', 10], ['arrows', 11], ['treasure', 8], ['lair', 14]];
const CRATES = [80, 81, 83, 85];
const RUBBLE = [49, 59, 68, 77, 68];
const LOOT = [86, 86, 87, 89, 97, 98, 88, 99];

function placeContent(D, R, rng) {
    const { w, h, midC, midR, mask } = R;
    const isF = (x, y) => y >= 0 && y < h && x >= 0 && x < w && mask[y][x] > 0;
    const isFloor = (x, y) => y >= 0 && y < h && x >= 0 && x < w && mask[y][x] === 1;
    const lane = (x, y) => y === midR - 1 || y === midR || x === midC - 1 || x === midC;
    const cov = (x, y) => D.cover[idx(R.gx + x, R.gy + y)] >= 0;
    const used = new Set();
    const K = (x, y) => `${x},${y}`;
    const free = (x, y) => isFloor(x, y) && !used.has(K(x, y)) && !cov(x, y);
    const G = (x, y) => [R.gx + x, R.gy + y];

    // Distância (Chebyshev) até a parede mais próxima.
    const dist = [];
    for (let y = 0; y < h; y++) {
        dist.push(new Array(w).fill(0));
        for (let x = 0; x < w; x++) {
            if (!isF(x, y)) continue;
            let d = 1;
            while (d < 6) {
                let ok = true;
                for (let yy = y - d; yy <= y + d && ok; yy++) for (let xx = x - d; xx <= x + d; xx++) {
                    if (!isF(xx, yy)) { ok = false; break; }
                }
                if (!ok) break;
                d++;
            }
            dist[y][x] = d;
        }
    }
    const floorCells = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if (isF(x, y)) floorCells.push([x, y]);
    const cellsWhere = (fn) => floorCells.filter(([x, y]) => fn(x, y));
    const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

    const makeHole = (x, y) => { if (isFloor(x, y) && !lane(x, y) && dist[y][x] >= 2 && !cov(x, y)) mask[y][x] = 2; };
    const holeBlob = () => {
        const bw = randInt(rng, 2, 3), bh = randInt(rng, 1, 2);
        const opts = cellsWhere((x, y) => !lane(x, y) && dist[y][x] >= 2);
        if (!opts.length) return;
        const [x0, y0] = pick(rng, opts);
        for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) makeHole(x, y);
    };
    const spike = (x, y, phase, timing = 'normal') => {
        if (!free(x, y)) return;
        used.add(K(x, y));
        R.spikes.push({ gx: R.gx + x, gy: R.gy + y, phase, timing });
    };
    const button = (x, y) => {
        if (!free(x, y)) return false;
        used.add(K(x, y));
        R.buttons.push({ gx: R.gx + x, gy: R.gy + y });
        return true;
    };
    const prop = (x, y, index, solid = false) => {
        used.add(K(x, y));
        const [gx, gy] = G(x, y);
        R.props.push({ gx, gy, index });
        if (solid) D.solid[idx(gx, gy)] = 1;
    };
    const wallM = (x, y) => neighborMask(isF, x, y);
    const isTopFace = (x, y) => !isF(x, y) && (wallM(x, y) & 15) === S;
    const isWWall = (x, y) => !isF(x, y) && (wallM(x, y) & 15) === E;   // piso à direita
    const isEWall = (x, y) => !isF(x, y) && (wallM(x, y) & 15) === W;   // piso à esquerda

    // ---- Tema ----
    if (R.level === 0) R.theme = 'showcase';
    else {
        R.theme = pickWeighted(rng, THEMES);
        // Flechas só em salas retangulares (atravessam a sala de parede a parede).
        if (R.theme === 'arrows' && R.shape !== 'rect') R.theme = pick(rng, ['spikes', 'pits', 'plain', 'lair']);
    }
    R.locked = R.theme === 'buttons' || R.theme === 'treasure' || (R.level > 1 && rng() < 0.12);

    // ---- Perigos ----
    if (R.theme === 'showcase') {
        // Sala de abertura: um pouco de tudo, à vista na panorâmica.
        for (let y = 7; y <= 8; y++) for (let x = 2; x <= 5; x++) makeHole(x, y);
        makeHole(3, 6); makeHole(4, 6);
        for (let x = 10; x <= 13; x++) { spike(x, 2, x * 0.11); spike(x, 3, x * 0.11 + 0.18); }
        button(3, 2); button(12, 8);
        R.traps.push({ gx: R.gx, gy: R.gy + 2, dir: 1, phase: 0.1 });
        R.traps.push({ gx: R.gx + w - 1, gy: R.gy + 8, dir: -1, phase: 0.55 });
    } else if (R.theme === 'pits') {
        if (rng() < 0.55) for (const [x, y] of floorCells) makeHole(x, y);   // poço com pontes em cruz
        else { const n = randInt(rng, 2, 4); for (let i = 0; i < n; i++) holeBlob(); }
    } else if (R.theme === 'spikes') {
        const mode = randInt(rng, 0, 2);
        if (mode === 0) {
            // Corredor de espinhos nas faixas do meio (onda).
            for (const [x, y] of cellsWhere((x, y) => (y === midR - 1 || y === midR) && x > 2 && x < w - 3 && x !== midC - 1 && x !== midC)) spike(x, y, x * 0.09 + (y - midR) * 0.15, 'fast');
        } else if (mode === 1) {
            for (const [x, y] of cellsWhere((x, y) => !lane(x, y) && dist[y][x] >= 2 && (x + y) % 2 === 0)) spike(x, y, (x + y) * 0.06);
        } else {
            // Faixa vertical do meio (menos o cruzamento com a horizontal).
            for (const [x, y] of cellsWhere((x, y) => (x === midC - 1 || x === midC) && y > 1 && y < h - 2 && y !== midR - 1 && y !== midR)) spike(x, y, y * 0.12, 'fast');
        }
    } else if (R.theme === 'buttons') {
        const d = Math.min(3, R.lw);
        button(midC - 1 - d, midR); button(midC + d, midR - 1);
        if (rng() < 0.5) holeBlob();
    } else if (R.theme === 'arrows') {
        const rows = [2, h - 3].filter(r => r !== midR - 1 && r !== midR);
        rows.forEach((r, i) => { if (isWWall(0, r) && !cov(0, r)) R.traps.push({ gx: R.gx, gy: R.gy + r, dir: 1, phase: i * 0.45 }); });
        if (h >= 11 && isEWall(w - 1, midR + 2) && !cov(w - 1, midR + 2)) R.traps.push({ gx: R.gx + w - 1, gy: R.gy + midR + 2, dir: -1, phase: 0.25 });
    } else if (rng() < 0.3) holeBlob();
    if ((R.theme === 'plain' || R.theme === 'lair') && rng() < 0.3) {
        const opts = cellsWhere((x, y) => !lane(x, y) && dist[y][x] >= 2);
        if (opts.length) { const [x, y] = pick(rng, opts); for (let i = 0; i < 3; i++) spike(x + i, y, i * 0.12); }
    }

    // ---- Tochas (paredes de cima) ----
    const faces = [];
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w; x++) if (isTopFace(x, y) && !cov(x, y)) faces.push([x, y]);
    let lastT = null;
    const torchCells = new Set();
    for (const [x, y] of faces) {
        if (lastT && lastT[1] === y && x - lastT[0] < 4) continue;
        if (rng() < 0.55 && R.torches.length < 4) {
            const [gx, gy] = G(x, y);
            R.torches.push({ gx, gy, side: 'N', type: 'torch' });
            torchCells.add(K(x, y));
            lastT = [x, y];
        }
    }
    // Tochas laterais (desenhadas no piso encostado na parede).
    for (const side of ['W', 'E']) {
        if (rng() > 0.45) continue;
        const opts = cellsWhere((x, y) => free(x, y) && !lane(x, y) && y > 1 &&
            (side === 'W' ? isWWall(x - 1, y) : isEWall(x + 1, y)));
        if (opts.length) {
            const [x, y] = pick(rng, opts);
            used.add(K(x, y));
            const [gx, gy] = G(x, y);
            R.torches.push({ gx, gy, side, type: 'torch' });
        }
    }
    // Estandarte numa face sem tocha.
    const bannerOpts = faces.filter(([x, y]) => !torchCells.has(K(x, y)));
    if (bannerOpts.length && rng() < 0.55) {
        const [x, y] = pick(rng, bannerOpts);
        const [gx, gy] = G(x, y);
        R.props.push({ gx, gy, index: 74 });
    }

    // ---- Props ----
    // Teias nos cantos de cima.
    for (const [x, y] of floorCells) {
        if (!free(x, y)) continue;
        if (!isF(x, y - 1) && !isF(x - 1, y) && rng() < 0.65) prop(x, y, 64);
        else if (!isF(x, y - 1) && !isF(x + 1, y) && rng() < 0.65) prop(x, y, 65);
    }
    const edgeCells = shuffle(cellsWhere((x, y) => free(x, y) && !lane(x, y) && dist[y][x] === 1));
    const nCrates = R.theme === 'treasure' ? 1 : randInt(rng, 0, 2);
    let placed = 0;
    for (const [x, y] of edgeCells) {
        if (placed >= nCrates) break;
        if (!free(x, y) || isF(x, y - 1)) continue;          // encostado na parede de cima
        prop(x, y, pick(rng, CRATES), true); placed++;
    }
    const nRubble = R.theme === 'lair' ? randInt(rng, 3, 5) : randInt(rng, 1, 3);
    placed = 0;
    for (const [x, y] of edgeCells) {
        if (placed >= nRubble) break;
        if (!free(x, y)) continue;
        prop(x, y, pick(rng, RUBBLE)); placed++;
    }
    const corners = cellsWhere((x, y) => free(x, y) && !lane(x, y) &&
        ((!isF(x - 1, y) || !isF(x + 1, y)) && (!isF(x, y - 1) || !isF(x, y + 1))));
    if (R.theme === 'treasure' || R.theme === 'showcase') {
        for (const [x, d] of [[midC - 3, 82], [midC + 2, 84]]) if (free(x, 1)) prop(x, 1, d, true);
        const inner = shuffle(cellsWhere((x, y) => free(x, y) && !lane(x, y) && dist[y][x] >= 2));
        const nLoot = R.theme === 'treasure' ? randInt(rng, 4, 6) : 2;
        for (let i = 0; i < Math.min(nLoot, inner.length); i++) prop(inner[i][0], inner[i][1], pick(rng, LOOT));
    }
    const nCandles = R.theme === 'treasure' ? 4 : (rng() < 0.25 ? 2 : 0);
    for (const [x, y] of shuffle(corners).slice(0, nCandles)) {
        if (!free(x, y)) continue;
        used.add(K(x, y));
        const [gx, gy] = G(x, y);
        R.torches.push({ gx, gy, side: 'F', type: rng() < 0.5 ? 'candlestick_1' : 'candlestick_2' });
    }

    // ---- Inimigos ----
    const nEnemies = {
        showcase: 4, plain: randInt(rng, 1, 2), lair: randInt(rng, 3, 5), spikes: randInt(rng, 0, 1),
        pits: randInt(rng, 1, 2), buttons: randInt(rng, 1, 2), arrows: randInt(rng, 0, 1), treasure: randInt(rng, 0, 1)
    }[R.theme] ?? 1;
    const spots = shuffle(cellsWhere((x, y) => free(x, y)));
    for (let i = 0; i < Math.min(nEnemies, spots.length); i++) {
        const [x, y] = spots[i];
        used.add(K(x, y));
        R.enemies.push({ gx: R.gx + x, gy: R.gy + y, type: rng() < 0.6 ? 'demon' : 'bloodMonster' });
    }
}

// ---------------------------------------------------------------------------
/**
 * Confere as paredes: global (com corredores) e de cada sala selada.
 * @returns {string[]} lista de problemas (vazia = tudo certo)
 */
export function validateDungeon(D) {
    const errs = [];
    const check = (pred, label, x0, y0, x1, y1) => {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            if (pred.isF(x, y)) continue;
            const s = wallTile(neighborMask(pred.isF, x, y), x, y);
            if (s && s.bad) errs.push(`${label} parede inválida em (${x},${y}) mask=${neighborMask(pred.isF, x, y)}`);
        }
    };
    check(floorPredicates(D), 'global', 0, 0, MAP_W - 1, MAP_H - 1);
    for (const R of D.rooms) {
        check(floorPredicates(D, R.id), `sala ${R.id} (${R.shape} ${R.w}x${R.h})`, R.gx - 1, R.gy - 1, R.gx + R.w, R.gy + R.h);
    }
    // Faixas das portas precisam ser piso da sala dos dois lados do corredor.
    for (const C of D.corridors) {
        for (const door of [C.doorA, C.doorB]) {
            for (const [x, y] of door.cells) {
                const inward = { E: [-1, 0], W: [1, 0], S: [0, -1], N: [0, 1] }[door.side];
                const k = idx(x + inward[0], y + inward[1]);
                if (D.room[k] !== door.room.id) errs.push(`corredor ${C.id}: porta ${door.side} sem piso da sala ${door.room.id}`);
            }
        }
    }
    return errs;
}
