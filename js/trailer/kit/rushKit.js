/**
 * rushKit — peças comuns da sequência "desespero" (cenas rápidas depois da
 * geração de mapas): base RushShot (arena com clima tenso), cenografia das
 * salas (props, estandartes, castiçais, manchas de sangue) e o tremido de
 * mão do drone.
 */
import { ArenaShot } from './ArenaShot.js';
import { TILE } from '../../config/GameConfig.js';
import { mulberry32 } from '../scenes/mapgen/mapLayout.js';

/** Arena em tela cheia com zoom liso, câmera colada, vinheta forte e luz sombria. */
export class RushShot extends ArenaShot {
    constructor(stage, opts = {}, duration = 4) {
        super(stage, {
            // camClose 1: os zooms das cenas já são "colados" (×zoomRef).
            smoothZoom: true, ambient: '32, 22, 36', vignette: 0.88, camClose: 1.0, ...opts
        }, duration);
        this.cutIn = 'impact';
    }
}

/** Tremido de mão do drone (px de mundo / rad), determinístico pelo tempo. */
export function handheld(t, amp = 1) {
    return {
        x: (Math.sin(t * 1.9) * 9 + Math.sin(t * 5.3) * 3) * amp,
        y: (Math.cos(t * 1.4) * 7 + Math.sin(t * 4.7) * 3) * amp,
        r: (Math.sin(t * 0.8) * 0.018 + Math.sin(t * 3.1) * 0.006) * amp
    };
}

const CRATES = [80, 81, 83, 85, 82];
const RUBBLE = [49, 59, 68, 77];
const LOOT = [86, 87, 89, 97, 98];

/**
 * Cenografia da sala: teias nos cantos, caixas/baús encostados na parede de
 * cima, entulho/ossos/caveiras nas beiradas, estandartes na parede, castiçais
 * nos cantos e manchas de sangue velhas no chão.
 * @param {ActionArena} A
 * @param {object} o { seed, avoid(col,row), crates, rubble, loot, banners, candles, blood }
 */
export function dressRoom(A, o = {}) {
    const rng = mulberry32(o.seed ?? 7);
    // Props/castiçais só na 1ª vez (repetir a cena não duplica); o sangue é
    // recarimbado sempre (o reset da arena limpa o buffer de sangue).
    if (!A._dressed) { A._dressed = true; dressProps(A, o, mulberry32((o.seed ?? 7) + 991)); }
    const n = o.blood ?? Math.round(A.cols * A.rows / 40);
    for (let i = 0; i < n; i++) {
        const x = (1.5 + rng() * (A.cols - 3)) * TILE, y = (1.5 + rng() * (A.rows - 3)) * TILE;
        const s = 0.6 + rng() * 0.9;
        if (!A.inHole(x, y - 14)) A.particles.triggerBloodPool(x, y, s);
    }
}

function dressProps(A, o, rng) {
    const C = A.cols, R = A.rows, last = C - 1, bottom = R - 1;
    const props = A.tiles.props;
    const used = new Set(props.map(p => `${p.col},${p.row}`));
    const holes = A._holeSet || new Set();
    const doorCols = new Set(), doorRows = new Set();
    for (const d of A.tiles.doorCells) { doorCols.add(d.col); doorRows.add(d.row); }
    const midC = (C / 2) | 0, midR = (R / 2) | 0;
    const nearDoor = (c, r) =>
        (A.doors.N && r <= 2 && Math.abs(c - midC + 0.5) < 2.5) ||
        (A.doors.S && r >= bottom - 2 && Math.abs(c - midC + 0.5) < 2.5) ||
        (A.doors.W && c <= 2 && Math.abs(r - midR + 0.5) < 2.5) ||
        (A.doors.E && c >= last - 2 && Math.abs(r - midR + 0.5) < 2.5);
    const free = (c, r) => c >= 1 && r >= 1 && c <= last - 1 && r <= bottom - 1 &&
        !used.has(`${c},${r}`) && !holes.has(r * C + c) && !nearDoor(c, r) && !(o.avoid?.(c, r));
    const put = (c, r, index) => { if (!free(c, r)) return false; used.add(`${c},${r}`); props.push({ col: c, row: r, index }); return true; };

    // Teias nos cantos de cima.
    put(1, 1, 64); put(last - 1, 1, 65);

    // Estandartes na parede de cima (entre as tochas).
    const torchCols = new Set(A.tiles.torches.filter(t => t.side === 'N').map(t => t.col));
    let nb = o.banners ?? Math.max(1, (C / 7) | 0);
    for (let c = 2; c < last - 1 && nb > 0; c += 3 + ((rng() * 3) | 0)) {
        if (torchCols.has(c) || doorCols.has(c) || torchCols.has(c - 1) || torchCols.has(c + 1)) continue;
        props.push({ col: c, row: 0, index: 74 }); nb--;
    }

    // Caixas/baús encostados na parede de cima.
    let n = o.crates ?? 2;
    for (let tries = 0; tries < 40 && n > 0; tries++) {
        const c = 2 + ((rng() * (C - 4)) | 0);
        if (put(c, 1, CRATES[(rng() * CRATES.length) | 0])) {
            n--;
            if (rng() < 0.5) put(c + 1, 1, CRATES[(rng() * CRATES.length) | 0]);
        }
    }

    // Entulho, ossos e caveiras nas beiradas.
    n = o.rubble ?? Math.round(C * R / 22);
    for (let tries = 0; tries < 200 && n > 0; tries++) {
        const edge = (rng() * 4) | 0;
        const c = edge === 0 ? 1 : edge === 1 ? last - 1 : 1 + ((rng() * (C - 2)) | 0);
        const r = edge === 2 ? 1 : edge === 3 ? bottom - 1 : 1 + ((rng() * (R - 2)) | 0);
        if (put(c, r, RUBBLE[(rng() * RUBBLE.length) | 0])) n--;
    }
    // Moedas/poções largadas.
    n = o.loot ?? 2;
    for (let tries = 0; tries < 60 && n > 0; tries++) {
        const c = 2 + ((rng() * (C - 4)) | 0), r = 2 + ((rng() * (R - 4)) | 0);
        if (put(c, r, LOOT[(rng() * LOOT.length) | 0])) n--;
    }

    // Castiçais nos cantos de baixo.
    if (o.candles ?? true) {
        for (const [c, r] of [[1, bottom - 1], [last - 1, bottom - 1]]) {
            if (!free(c, r)) continue;
            used.add(`${c},${r}`);
            A.tiles.torches.push({ col: c, row: r, side: 'F', type: rng() < 0.5 ? 'candlestick_1' : 'candlestick_2' });
        }
    }
}
