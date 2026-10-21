/**
 * mapGrow — layout e "assado" do clipe 5 (MAPA NOVO).
 *
 * Começa na sala padrão do jogo (14x9) e cresce em LOBOS: formatos de sala
 * (L, cruz, T, octógono, pilares, salão — os mesmos de mapLayout.js) colados
 * direto nas bordas da massa, SEM corredor. As paredes se refazem pelo
 * autotile de vizinhança (wallTile/floorTile de mapLayout.js) e cada lobo
 * nasce com uma PALETA própria (variação de tom do tileset do jogo). O miolo
 * de cada lobo (buracos, espinhos, botões) é copiado de uma PEÇA REAL do
 * editor (map/*.json).
 *
 * Coordenadas em tiles de uma grade GW x GH; a grade começa em (0,0) do mundo.
 */
import {
    makeShape, wallTile, floorTile, neighborMask, mulberry32
} from '../scenes/mapgen/mapLayout.js';
import { drawTile16 } from '../scenes/mapgen/mapBake.js';
import { BACKGROUND_TILE } from '../../config/GameConfig.js';

export const GW = 56, GH = 36;
const T = 16;
export const START = { x: 21, y: 13, w: 14, h: 9 };   // sala padrão (com moldura)

const SIZES = [[14, 9], [12, 9], [16, 11], [14, 11], [16, 9], [12, 11], [14, 9]];
const KINDS = ['L', 'cross', 'T', 'octagon', 'pillars', 'hall', 'rect'];

// Paletas (filtro CSS sobre o tileset do jogo). 0 = original (roxo).
export const PALETTES = [
    { name: 'pedra', filter: 'none', light: '150, 120, 200' },
    { name: 'musgo', filter: 'hue-rotate(185deg) saturate(0.85) brightness(1.05)', light: '120, 200, 110' },
    { name: 'gelo', filter: 'hue-rotate(-80deg) saturate(1.15) brightness(1.18)', light: '140, 200, 255' },
    { name: 'brasa', filter: 'hue-rotate(85deg) saturate(1.45) brightness(1.05)', light: '255, 140, 70' },
    { name: 'areia', filter: 'hue-rotate(118deg) saturate(1.1) brightness(1.2)', light: '255, 214, 120' },
    { name: 'turquesa', filter: 'hue-rotate(-125deg) saturate(1.1) brightness(1.1)', light: '90, 230, 210' },
    { name: 'sangue', filter: 'hue-rotate(55deg) saturate(1.6) brightness(0.95)', light: '255, 70, 80' }
];

// Duas runs: semente, paletas dos lobos e peças reais do editor (miolo).
export const RUNS = [
    { seed: 3101, pals: [1, 2, 3, 4], pieces: ['room_corner_ne_0', 'room_cross_4way_0', 'corridor_vertical_ns_0', 'room_nsw_3'] },
    { seed: 7717, pals: [5, 6, 4, 2], pieces: ['corridor_sw_1', 'room_esw_1', 'corridor_horizontal_ew_2', 'room_n_0'] }
];

// Peças reais (carregadas uma vez; falha de rede = lobo sem miolo).
const PIECES = {};
await Promise.all([...new Set(RUNS.flatMap(r => r.pieces))].map(async (id) => {
    try {
        const res = await fetch(new URL(`../../../map/${id}.json`, import.meta.url));
        if (res.ok) PIECES[id] = await res.json();
    } catch { /* sem miolo */ }
}));

const idx = (x, y) => y * GW + x;
const inGrid = (x, y) => x >= 0 && y >= 0 && x < GW && y < GH;

/** Predicados de piso de um retrato do mapa (floor: 0 vazio, 1 piso, 2 buraco). */
function preds(floor) {
    return {
        isF: (x, y) => inGrid(x, y) && floor[idx(x, y)] > 0,
        isHole: (x, y) => inGrid(x, y) && floor[idx(x, y)] === 2
    };
}

/** Spec do tile em (x,y) + paleta (piso: dono; parede: o dono mais antigo vizinho). */
function cellSpec(floor, owner, pal, x, y) {
    const p = preds(floor);
    if (p.isF(x, y)) return { t: floorTile(p.isF, p.isHole, x, y), pal: pal[owner[idx(x, y)]] };
    const s = wallTile(neighborMask(p.isF, x, y), x, y);
    if (!s || s.bad) return null;
    let o = 99;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (p.isF(x + dx, y + dy)) o = Math.min(o, owner[idx(x + dx, y + dy)]);
    }
    return { ...s, pal: pal[o] ?? 0 };
}
const specKey = (s) => s ? `${s.t}|${s.ov ? s.ov.t + ':' + s.ov.sx : ''}|${s.pal}` : '';

/**
 * Gera uma run: a sala padrão + N lobos. Devolve
 * { lobes: [{ id, x, y, w, h, cx, cy, pal, spikes:[[gx,gy]], buttons:[[gx,gy]] }], snaps: [floor, owner][] }
 * onde snaps[k] = estado depois do lobo k (k = 0: só a sala padrão).
 */
export function buildRun(run) {
    const rng = mulberry32(run.seed);
    const floor = new Uint8Array(GW * GH), owner = new Int8Array(GW * GH).fill(-1);
    const lobes = [];
    const add = (lobe, mask) => {
        for (let y = 0; y < lobe.h; y++) for (let x = 0; x < lobe.w; x++) {
            if (!mask[y][x]) continue;
            const k = idx(lobe.x + x, lobe.y + y);
            if (!floor[k]) { floor[k] = 1; owner[k] = lobe.id; }
        }
    };
    // Sala padrão.
    const S = { id: 0, ...START, pal: 0, spikes: [], buttons: [] };
    add(S, makeShape('rect', S.w, S.h, rng));
    lobes.push(finish(S));
    const snaps = [[floor.slice(), owner.slice()]];
    const pal = [0, ...run.pals];

    for (let i = 1; i <= run.pals.length; i++) {
        let placed = null;
        for (let tries = 0; tries < 200 && !placed; tries++) {
            const target = tries < 60 ? lobes[lobes.length - 1 - ((rng() * Math.min(2, lobes.length)) | 0)]
                : lobes[(rng() * lobes.length) | 0];
            const side = 'NESW'[(rng() * 4) | 0];
            const [w, h] = SIZES[(rng() * SIZES.length) | 0];
            const kind = pickKind(rng, w, h);
            const mask = makeShape(kind, w, h, rng);
            const off = ((rng() * 3) | 0) - 1;
            const L = { id: i, w, h };
            const ix0 = target.x + 1, ix1 = target.x + target.w - 2;
            const iy0 = target.y + 1, iy1 = target.y + target.h - 2;
            if (side === 'E') { L.x = ix1; L.y = target.cy - (h >> 1) + off; }
            else if (side === 'W') { L.x = ix0 - (w - 1); L.y = target.cy - (h >> 1) + off; }
            else if (side === 'N') { L.y = iy0 - (h - 1); L.x = target.cxi - (w >> 1) + off; }
            else { L.y = iy1; L.x = target.cxi - (w >> 1) + off; }
            if (L.x < 1 || L.y < 1 || L.x + w > GW - 1 || L.y + h > GH - 1) continue;
            // Não pode invadir piso existente (só encostar).
            let clash = false, touch = 0;
            for (let y = 0; y < h && !clash; y++) for (let x = 0; x < w; x++) {
                if (!mask[y][x]) continue;
                const gx = L.x + x, gy = L.y + y;
                if (floor[idx(gx, gy)]) { clash = true; break; }
                for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const k = idx(gx + dx, gy + dy);
                    if (floor[k] && owner[k] !== target.id) { clash = true; break; }
                    if (floor[k]) touch++;
                }
            }
            if (clash || touch < 2) continue;
            placed = { L, mask };
        }
        if (!placed) break;
        const { L, mask } = placed;
        L.pal = run.pals[i - 1];
        add(L, mask);
        repair(floor, owner, i);
        finish(L);
        carvePiece(floor, owner, L, PIECES[run.pieces[i - 1]]);
        lobes.push(L);
        snaps.push([floor.slice(), owner.slice()]);
    }
    return { lobes, snaps, pal };
}

function pickKind(rng, w, h) {
    const lw = w / 2 - 2;
    const ok = KINDS.filter(k => {
        if (k === 'pillars') return h >= 11 && lw >= 4;
        if (k === 'hall') return h >= 11 && lw >= 5;
        if (k === 'L' || k === 'cross' || k === 'T') return lw >= 3;
        return true;
    });
    return ok[(rng() * ok.length) | 0];
}

function finish(L) {
    L.cx = L.x + L.w / 2;
    L.cy = L.y + (L.h >> 1);
    L.cxi = L.x + (L.w >> 1);
    L.spikes ??= []; L.buttons ??= [];
    return L;
}

// Paredes impossíveis na emenda (parede de 1 tile entre pisos, beliscão na
// diagonal) viram piso do lobo novo, até estabilizar.
function repair(floor, owner, id) {
    for (let pass = 0; pass < 30; pass++) {
        const p = preds(floor);
        const fix = [];
        for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
            if (p.isF(x, y)) continue;
            const m = neighborMask(p.isF, x, y);
            if (!m) continue;
            const s = wallTile(m, x, y);
            if (s && s.bad) fix.push([x, y]);
        }
        if (!fix.length) return;
        for (const [x, y] of fix) {
            if (x <= 0 || y <= 0 || x >= GW - 1 || y >= GH - 1) continue;
            floor[idx(x, y)] = 1;
            owner[idx(x, y)] = id;
        }
    }
}

// Miolo da peça real: buracos (-1), espinhos e botões, centralizados no lobo.
// O "corredor do meio" do lobo (2 linhas + 2 colunas centrais) fica livre.
function carvePiece(floor, owner, L, piece) {
    if (!piece) return;
    const ox = L.x + Math.round((L.w - piece.cols) / 2), oy = L.y + Math.round((L.h - piece.rows) / 2);
    const midR = L.y + (L.h >> 1), midC = L.x + L.w / 2;
    const free = (gx, gy) => Math.abs(gy + 0.5 - midR) < 1.6 || Math.abs(gx + 0.5 - midC) < 1.6;
    const mine = (gx, gy) => inGrid(gx, gy) && floor[idx(gx, gy)] === 1 && owner[idx(gx, gy)] === L.id;
    for (let r = 1; r < piece.rows - 1; r++) for (let c = 1; c < piece.cols - 1; c++) {
        if (piece.floor?.[r]?.[c] !== -1) continue;
        const gx = ox + c, gy = oy + r;
        if (mine(gx, gy) && !free(gx, gy)) floor[idx(gx, gy)] = 2;
    }
    for (const hz of piece.hazards || []) {
        const cells = [];
        if (hz.type === 'spike' || hz.type === 'button') cells.push([hz.col, hz.row]);
        else if (hz.type === 'spikeRow') {
            const v = hz.dir === 'up' || hz.dir === 'down';
            for (let i = 0; i < (hz.count || 4); i++) cells.push(v ? [hz.col, hz.row + i] : [hz.col + i, hz.row]);
        } else continue;
        for (const [c, r] of cells) {
            const gx = ox + c, gy = oy + r;
            if (!mine(gx, gy)) continue;
            (hz.type === 'button' ? L.buttons : L.spikes).push([gx, gy]);
        }
    }
}

// ---------------------------------------------------------------------------
// Assado (canvas em 16 px por tile).

/** Tilesets tingidos (um por paleta) a partir do tileset do jogo. */
export function tintTilesets(img) {
    return PALETTES.map(p => {
        if (p.filter === 'none') return img;
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.filter = p.filter;
        g.drawImage(img, 0, 0);
        return c;
    });
}

function drawSpec(ctx, img, s, dx, dy) {
    drawTile16(ctx, img, s.t, dx, dy);
    if (s.ov) {
        const o = s.ov;
        ctx.drawImage(img, (o.t % 10) * T + o.sx, ((o.t / 10) | 0) * T, o.sw, T, dx + o.sx, dy, o.sw, T);
    }
}

function silhouette(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff6ec';
    g.fillRect(0, 0, c.width, c.height);
    return c;
}

/**
 * Assa a run: `base` = sala padrão; `diffs[k]` (k >= 1) = só as células que
 * mudam quando o lobo k nasce (piso novo, emendas de parede, paredes novas),
 * recortadas no bbox, com a silhueta branca do "pop".
 */
export function bakeRun(R, tilesets) {
    const specsOf = ([floor, owner]) => {
        const out = new Map();
        for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
            const s = cellSpec(floor, owner, R.pal, x, y);
            if (s) out.set(idx(x, y), s);
        }
        return out;
    };
    const all = R.snaps.map(specsOf);
    const draw = (cells, specs, bx, by, bw, bh) => {
        const c = document.createElement('canvas');
        c.width = bw * T; c.height = bh * T;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        for (const k of cells) {
            const x = k % GW, y = (k / GW) | 0;
            const s = specs.get(k);
            const dx = (x - bx) * T, dy = (y - by) * T;
            drawTile16(g, tilesets[s.pal], BACKGROUND_TILE, dx, dy);
            drawSpec(g, tilesets[s.pal], s, dx, dy);
        }
        return c;
    };
    R.base = draw([...all[0].keys()], all[0], 0, 0, GW, GH);
    R.diffs = [null];
    for (let k = 1; k < all.length; k++) {
        const prev = all[k - 1], cur = all[k];
        const cells = [];
        let x0 = GW, y0 = GH, x1 = -1, y1 = -1;
        for (const [key, s] of cur) {
            if (specKey(prev.get(key)) === specKey(s)) continue;
            cells.push(key);
            const x = key % GW, y = (key / GW) | 0;
            x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
        if (!cells.length) { R.diffs.push(null); continue; }
        const img = draw(cells, cur, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
        R.diffs.push({ img, flash: silhouette(img), x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
    }
    return R;
}

/** Bbox (tiles) dos lobos 0..k. */
export function extentOf(R, k) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i <= k && i < R.lobes.length; i++) {
        const L = R.lobes[i];
        x0 = Math.min(x0, L.x); y0 = Math.min(y0, L.y);
        x1 = Math.max(x1, L.x + L.w); y1 = Math.max(y1, L.y + L.h);
    }
    return { x0, y0, x1, y1 };
}
