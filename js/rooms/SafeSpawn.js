import { HOLE_TILE } from '../config/GameConfig.js';

export function isSafeFloorCell(floor, col, row, cols, rows) {
    const line = floor[row];
    if (!line) return false;
    const value = line[col];
    if (value === undefined) return false;
    if (value === HOLE_TILE) return false;
    if (value < 0) return false;

    if (col <= 0 || row <= 0 || col >= cols - 1 || row >= rows - 1) return false;
    return true;
}

export function findSafeFloorCell(floor, col, row) {
    const rows = floor.length;
    const cols = rows > 0 ? floor[0].length : 0;
    if (cols === 0) return { col, row, moved: false, found: false };

    if (isSafeFloorCell(floor, col, row, cols, rows)) {
        return { col, row, moved: false, found: true };
    }

    const maxRadius = Math.max(cols, rows);
    for (let radius = 1; radius < maxRadius; radius++) {

        let best = null;
        let bestDist = Infinity;
        for (let dr = -radius; dr <= radius; dr++) {
            for (let dc = -radius; dc <= radius; dc++) {
                if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
                const c = col + dc, r = row + dr;
                if (!isSafeFloorCell(floor, c, r, cols, rows)) continue;
                const dist = dc * dc + dr * dr;
                if (dist < bestDist) {
                    bestDist = dist;
                    best = { col: c, row: r };
                }
            }
        }
        if (best) return { col: best.col, row: best.row, moved: true, found: true };
    }

    return { col, row, moved: false, found: false };
}
