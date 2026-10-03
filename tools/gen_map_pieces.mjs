/**
 * Gera peças iniciais em /map, uma para cada assinatura de portas (as 15
 * combinações possíveis), usando RoomTiles para a moldura + piso base.
 *
 * Essas peças são um PONTO DE PARTIDA (piso liso, sem conteúdo). Você as
 * substitui/duplica desenhando no editor. O index.json lista todas.
 *
 * Uso:  node tools/gen_map_pieces.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { RoomTiles } from '../js/core/RoomTiles.js';
import { ROOM_COLS, ROOM_ROWS } from '../js/config/GameConfig.js';

const DIR = new URL('../map/', import.meta.url);
mkdirSync(DIR, { recursive: true });

// Nome curto da assinatura de portas (N,E,S,W -> "NE", "cross", etc.)
function sig(doors) {
    const parts = [];
    if (doors.N) parts.push('N');
    if (doors.E) parts.push('E');
    if (doors.S) parts.push('S');
    if (doors.W) parts.push('W');
    const count = parts.length;
    if (count === 4) return 'cross';
    return parts.join('') || 'none';
}

const files = [];
for (let m = 1; m < 16; m++) {
    const doors = { N: !!(m & 1), S: !!(m & 2), E: !!(m & 4), W: !!(m & 8) };
    const count = Object.values(doors).filter(Boolean).length;
    // Corredores retos (2 portas opostas) são "corridor"; o resto "room".
    const straight = (doors.N && doors.S && !doors.E && !doors.W) ||
                     (doors.E && doors.W && !doors.N && !doors.S);
    const kind = straight ? 'corridor' : 'room';

    const rt = new RoomTiles(ROOM_COLS, ROOM_ROWS, doors, 1, kind === 'room');
    const s = sig(doors);
    const id = `piece_${s}_01`;

    const piece = {
        id,
        name: `Peça ${s.toUpperCase()} (base)`,
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        kind,
        type: 'normal',
        doors,
        floor: rt.floor,
        holes: [],
        torches: [],
        props: [],
        enemies: [],
        hazards: []
    };

    const fname = `${id}.json`;
    writeFileSync(new URL(fname, DIR), JSON.stringify(piece));
    files.push(fname);
}

writeFileSync(new URL('index.json', DIR), JSON.stringify({ rooms: files }, null, 2));
console.log(`Geradas ${files.length} peças + index.json`);
