import { DEMO } from '../config/DemoConfig.js';
import { doorCells, sideOf } from './MapConnections.js';
import { occupiedCells } from './MapOccupancy.js';
import { STAIR_INDEX } from '../config/MapEditorConfig.js';

export function randomizeFloor(room, tiles = DEMO.floorTiles, rng = Math.random) {
    const pool = tiles.filter(n => Number.isInteger(n) && n >= 0);
    if (!pool.length) return;
    room.floorPool = [...pool];
    for (let r = 2; r < room.rows - 2; r++) {
        for (let c = 2; c < room.cols - 2; c++) {
            if (room.kinds[r][c] === 'f') room.tiles[r][c] = pool[Math.floor(rng() * pool.length)];
        }
    }
}

export function scatterProps(room, density, rng = Math.random) {
    room.props = room.props.filter(p => !p.generated);
    room.propDensity = Math.max(0, Math.min(0.4, Number(density) || 0));
    const used = new Set([...room.props, ...(room.enemies || []), ...(room.hazards || []), ...(room.torches || []), ...(room.interactives || []), ...Object.values(room.spawns || {})].flatMap(occupiedCells).map(p => `${p.col},${p.row}`));
    for (let row = 2; row < room.rows - 2; row++) {
        for (let col = 2; col < room.cols - 2; col++) {
            if (room.kinds[row][col] !== 'f' || used.has(`${col},${row}`) || rng() >= room.propDensity) continue;
            room.props.push({ col, row, index: DEMO.propTiles[Math.floor(rng() * DEMO.propTiles.length)], generated: true });
        }
    }
}

export function placeDoor(room, col, row, type, width = 2, id = null) {
    if (type === 'stairs') {
        if (col < 0 || row < 0 || col >= room.cols || row >= room.rows) return false;
        const side = sideOf(room, { col, row });
        const corner = (col === 0 || col === room.cols - 1) && (row === 0 || row === room.rows - 1);
        if (corner || (!side && room.kinds[row][col] !== 'f')) return false;
        if (room.doors.some(d => doorCells(room, d).some(p => p.col === col && p.row === row))) return false;
        let i = 0;
        while (room.doors.some(d => d.id === `door_${i}`)) i++;
        room.doors.push({ col, row, type, width: 1, id: id || `door_${i}` });
        if (side) {
            const dc = side === 'W' ? 1 : side === 'E' ? -1 : 0;
            const dr = side === 'N' ? 1 : side === 'S' ? -1 : 0;
            for (let inset = 0; inset < 2; inset++) {
                const c = col + dc * inset, r = row + dr * inset;
                room.tiles[r][c] = 16;
                room.kinds[r] = room.kinds[r].slice(0, c) + 'f' + room.kinds[r].slice(c + 1);
            }
        }
        room.props = room.props.filter(p => !(p.index === STAIR_INDEX && p.col === col && p.row === row));
        return true;
    }
    const door = { col, row, type, width: type === 'boss' ? 2 : Math.max(1, Math.min(6, Math.round(width))) };
    const side = sideOf(room, door);
    if (!side || (type === 'boss' && side !== 'N')) return false;
    const cells = doorCells(room, door);
    if (cells.some(p => p.col < 0 || p.row < 0 || p.col >= room.cols || p.row >= room.rows
        || ((p.col === 0 || p.col === room.cols - 1) && (p.row === 0 || p.row === room.rows - 1)))) return false;
    if (room.doors.some(d => doorCells(room, d).some(p => cells.some(q => p.col === q.col && p.row === q.row)))) return false;
    if (id && !room.doors.some(d => d.id === id)) door.id = id;
    else {
        let i = 0;
        while (room.doors.some(d => d.id === `door_${i}`)) i++;
        door.id = `door_${i}`;
    }
    room.doors.push(door);
    for (const p of cells) {
        for (let inset = 0; inset < 2; inset++) {
            const c = p.col + (side === 'W' ? inset : side === 'E' ? -inset : 0);
            const r = p.row + (side === 'N' ? inset : side === 'S' ? -inset : 0);
            room.tiles[r][c] = 16;
            room.kinds[r] = room.kinds[r].slice(0, c) + 'f' + room.kinds[r].slice(c + 1);
        }
    }
    return true;
}
