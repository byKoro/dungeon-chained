import { TILE_KIND, VOID_INDEX, FLOOR_INDEX } from '../config/MapEditorConfig.js';
import { DEMO } from '../config/DemoConfig.js';
import { setCell, inBounds, isBorder, doorAt } from './MapDocument.js';
import { occupiedCells } from './MapOccupancy.js';

const { FLOOR, WALL, HOLE, VOID } = TILE_KIND;

const TOP = [1, 2, 3, 4];
const BOTTOM = [41, 42, 43, 44];
const LEFT = [10, 20, 30];
const RIGHT = [15, 25, 35];
const SHADOW_TOP = [12, 13];
const SHADOW_BOTTOM = [32, 33];
const CORNER_TL = [50];
const CORNER_TR = [55];
const WALL_TILES = new Set([0, 5, 40, 45, ...TOP, ...BOTTOM, ...LEFT, ...RIGHT, ...CORNER_TL, ...CORNER_TR]);
const SHADOW_TILES = new Set([11, 14, 31, 34, 21, 24, ...SHADOW_TOP, ...SHADOW_BOTTOM]);
// Inclui as diagonais: a quina de um contorno depende do piso na diagonal.
const NEIGHBORS = [[0, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];

const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const kindAt = (room, c, r) => (inBounds(room, c, r) ? room.kinds[r][c] : null);

function floorTile(room, rng) {
    const pool = room.floorPool?.length ? room.floorPool : DEMO.floorTiles;
    return pool.length ? pick(pool, rng) : FLOOR_INDEX;
}

// Mantém o tile atual se ele já serve, para a variação sorteada não mudar a cada traço.
function keepOrPick(current, set, list, rng) {
    return set.includes(current) ? current : pick(list, rng);
}

// Paredes da moldura (limite da sala): a peça vem do lado da borda, como em RoomTiles, sem olhar os vizinhos.
function borderWallTile(room, c, r, current, rng) {
    const lastC = room.cols - 1, lastR = room.rows - 1;
    if (r === 0 && c === 0) return 0;
    if (r === 0 && c === lastC) return 5;
    if (r === lastR && c === 0) return 40;
    if (r === lastR && c === lastC) return 45;
    if (r === 0) return keepOrPick(current, TOP, TOP, rng);
    if (r === lastR) return keepOrPick(current, BOTTOM, BOTTOM, rng);
    if (c === 0) return keepOrPick(current, LEFT, LEFT, rng);
    return keepOrPick(current, RIGHT, RIGHT, rng);
}

export function wallTileFor(room, c, r, rng = Math.random) {
    const current = room.tiles[r][c];
    if (isBorder(room.cols, room.rows, c, r)) return borderWallTile(room, c, r, current, rng);
    const fN = kindAt(room, c, r - 1) === FLOOR, fS = kindAt(room, c, r + 1) === FLOOR;
    const fW = kindAt(room, c - 1, r) === FLOOR, fE = kindAt(room, c + 1, r) === FLOOR;

    // Quinas de cima: a parede continua para leste/sul (esquerda) ou oeste/sul (direita).
    // Com vazio por dentro (SE/SO sem piso) vale o par 50/55; com piso por dentro e vazio por fora, as quinas 0/5.
    const wallAt = (dc, dr) => kindAt(room, c + dc, r + dr) === WALL;
    const floorAt = (dc, dr) => kindAt(room, c + dc, r + dr) === FLOOR;
    if (wallAt(0, 1) && !wallAt(0, -1)) {
        if (wallAt(1, 0) && !wallAt(-1, 0)) {
            if (!floorAt(1, 1)) return keepOrPick(current, CORNER_TL, CORNER_TL, rng);
            if (!fN && !fW) return 0;
        }
        if (wallAt(-1, 0) && !wallAt(1, 0)) {
            if (!floorAt(-1, 1)) return keepOrPick(current, CORNER_TR, CORNER_TR, rng);
            if (!fN && !fE) return 5;
        }
    }

    if (fS) return keepOrPick(current, TOP, TOP, rng);
    // Parede fina com piso nos dois lados: as laterais do tileset têm meio tile escuro, então usa bloco de topo.
    if (fE && fW) return keepOrPick(current, TOP, TOP, rng);
    if (fN) return keepOrPick(current, BOTTOM, BOTTOM, rng);
    if (fE) return keepOrPick(current, LEFT, LEFT, rng);
    if (fW) return keepOrPick(current, RIGHT, RIGHT, rng);

    // Sem piso nas 4 direções: quina de um contorno fechado, onde o piso só aparece na diagonal.
    const dNE = kindAt(room, c + 1, r - 1) === FLOOR, dNW = kindAt(room, c - 1, r - 1) === FLOOR;
    const dSE = kindAt(room, c + 1, r + 1) === FLOOR, dSW = kindAt(room, c - 1, r + 1) === FLOOR;
    const diagonals = [dNE, dNW, dSE, dSW].filter(Boolean).length;
    if (diagonals === 1) return dSE ? 0 : dSW ? 5 : dNE ? 40 : 45;
    if (dSE && dSW) return keepOrPick(current, TOP, TOP, rng);
    if (dNE && dNW) return keepOrPick(current, BOTTOM, BOTTOM, rng);
    if (dNE && dSE) return keepOrPick(current, LEFT, LEFT, rng);
    if (dNW && dSW) return keepOrPick(current, RIGHT, RIGHT, rng);
    return WALL_TILES.has(current) ? current : 2;
}

// Tile de piso: sombra se encosta em parede, senão piso comum (trocando sombra antiga por piso sorteado).
export function shadowTileFor(room, c, r, rng = Math.random) {
    const current = room.tiles[r][c];
    const wN = kindAt(room, c, r - 1) === WALL, wS = kindAt(room, c, r + 1) === WALL;
    const wW = kindAt(room, c - 1, r) === WALL, wE = kindAt(room, c + 1, r) === WALL;

    if (wN && wW) return 11;
    if (wN && wE) return 14;
    if (wS && wW) return 31;
    if (wS && wE) return 34;
    if (wN) return keepOrPick(current, SHADOW_TOP, SHADOW_TOP, rng);
    if (wS) return keepOrPick(current, SHADOW_BOTTOM, SHADOW_BOTTOM, rng);
    if (wW) return 21;
    if (wE) return 24;
    return SHADOW_TILES.has(current) ? floorTile(room, rng) : current;
}

function clearContentAt(room, c, r) {
    const here = (o) => o.col === c && o.row === r;
    room.props = room.props.filter(p => !occupiedCells(p).some(q => q.col === c && q.row === r));
    for (const field of ['enemies', 'torches', 'interactives']) room[field] = (room[field] || []).filter(o => !here(o));
    room.hazards = (room.hazards || []).filter(h => !occupiedCells(h).some(q => q.col === c && q.row === r));
}

function retile(room, c, r, rng) {
    if (!inBounds(room, c, r)) return;
    const kind = room.kinds[r][c];
    if (kind === WALL) room.tiles[r][c] = wallTileFor(room, c, r, rng);
    else if (kind === FLOOR && !doorAt(room, c, r)) room.tiles[r][c] = shadowTileFor(room, c, r, rng);
}

// Pincel de parede em um tile (inclusive na moldura). mode "add" pinta parede; "remove" volta a piso. Portas ficam.
export function paintWallCell(room, c, r, mode, rng = Math.random) {
    if (!inBounds(room, c, r) || doorAt(room, c, r)) return false;
    if (mode === 'remove') {
        if (room.kinds[r][c] !== WALL) return false;
        setCell(room, c, r, floorTile(room, rng), FLOOR);
    } else {
        if (room.kinds[r][c] === WALL) return false;
        setCell(room, c, r, 2, WALL);
        clearContentAt(room, c, r);
    }
    for (const [dx, dy] of NEIGHBORS) retile(room, c + dx, r + dy, rng);
    return true;
}

// Piso e buraco que não conectam ao centro, a portas ou a spawns viram vazio. Retorna quantas células mudaram.
export function voidOutside(room) {
    const open = (c, r) => [FLOOR, HOLE].includes(kindAt(room, c, r));
    const seeds = [];
    for (const d of room.doors) {
        const horizontal = d.row === 0 || d.row === room.rows - 1;
        for (let i = 0; i < (d.width || 1); i++) {
            const c = d.col + (horizontal ? i : 0), r = d.row + (horizontal ? 0 : i);
            // a célula da porta e as duas de dentro da sala
            for (let inset = 0; inset < 2; inset++) {
                const cc = c + (d.col === 0 ? inset : d.col === room.cols - 1 ? -inset : 0);
                const rr = r + (d.row === 0 ? inset : d.row === room.rows - 1 ? -inset : 0);
                if (open(cc, rr)) seeds.push([cc, rr]);
            }
        }
    }
    for (const p of Object.values(room.spawns || {})) if (p && open(p.col, p.row)) seeds.push([p.col, p.row]);

    const cx = (room.cols - 1) / 2, cy = (room.rows - 1) / 2;
    let best = null;
    for (let r = 0; r < room.rows; r++) {
        for (let c = 0; c < room.cols; c++) {
            if (room.kinds[r][c] !== FLOOR) continue;
            const d = Math.hypot(c - cx, r - cy);
            if (!best || d < best.d) best = { c, r, d };
        }
    }
    if (best) seeds.push([best.c, best.r]);
    if (!seeds.length) return 0;

    const reached = new Set();
    const stack = [...seeds];
    while (stack.length) {
        const [c, r] = stack.pop();
        const key = r * room.cols + c;
        if (reached.has(key) || !open(c, r)) continue;
        reached.add(key);
        stack.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }

    let changed = 0;
    for (let r = 0; r < room.rows; r++) {
        for (let c = 0; c < room.cols; c++) {
            if (!open(c, r) || reached.has(r * room.cols + c)) continue;
            setCell(room, c, r, VOID_INDEX, VOID);
            clearContentAt(room, c, r);
            changed++;
        }
    }
    // paredes que voltaram a ter vizinhança diferente
    if (changed) for (let r = 0; r < room.rows; r++) for (let c = 0; c < room.cols; c++) retile(room, c, r, Math.random);
    return changed;
}
