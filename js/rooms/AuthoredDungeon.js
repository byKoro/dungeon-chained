import { Dungeon } from '../core/Dungeon.js';
import { TILE } from '../config/GameConfig.js';
import { DEMO } from '../config/DemoConfig.js';
import { sideOf, outgoingConnections, endpointDoor, safeSpawnPair, doorCells } from './MapConnections.js';

export class AuthoredDungeon extends Dungeon {
    constructor(document) {
        const map = structuredClone(document);
        const cells = new Map();
        for (const [key, room] of Object.entries(map.rooms)) {
            const [gx, gy] = key.split(',').map(Number);
            const doors = { N: false, S: false, E: false, W: false };
            for (const d of room.doors) if (d.type !== 'stairs') doors[sideOf(room, d)] = true;
            const walls = [];
            for (let row = 1; row < room.rows - 1; row++) for (let col = 1; col < room.cols - 1; col++) {
                if (['w', 'v'].includes(room.kinds[row][col])) walls.push({ col, row, tile: room.tiles[row][col], side: 'top' });
            }
            cells.set(key, {
                gx, gy, kind: 'room', type: room.type || 'normal', doors, authored: room,
                customFloor: room.tiles, customWalls: walls, customProps: room.props,
                customEnemies: room.enemies || [], customHazards: room.hazards || [],
                customTorches: room.torches || [], customLock: room.lock || 'none', customName: room.name,
                _authored: true
            });
        }
        const start = cells.get(map.start);
        if (!start) throw new Error('Mapa sem sala inicial.');
        super({ graph: { cells, start, rooms: [...cells.values()], cols: map.grid.cols, rows: map.grid.rows }, tile: TILE });
        this.document = map;
        this.progress = {};
    }

    cellRect(gx, gy) {
        const r = this.graph.cells.get(`${gx},${gy}`).authored;
        return { x: 0, y: 0, w: r.cols * TILE, h: r.rows * TILE };
    }

    cellBounds(gx, gy) {
        const r = this.cellRect(gx, gy);
        return { minX: r.x + TILE, minY: r.y + TILE, maxX: r.x + r.w - TILE, maxY: r.y + r.h - TILE };
    }

    cellCenter(gx, gy) {
        const r = this.cellRect(gx, gy);
        return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    }

    spawnPositions(doorId = null) {
        const room = this.current.authored;
        const door = doorId ? room.doors.find(d => d.id === doorId) : null;
        const pair = safeSpawnPair(room, door);
        if (!pair) throw new Error(`${room.name}: não há entrada segura para os jogadores.`);
        const rect = this.cellRect(this.current.gx, this.current.gy);
        return Object.fromEntries(Object.entries(pair).map(([key, p]) => [key, {
            x: rect.x + (p.col + 0.5) * TILE, y: rect.y + (p.row + 0.5) * TILE
        }]));
    }

    doorsOf(gx, gy) {
        const key = `${gx},${gy}`;
        const room = this.document.rooms[key];
        const rect = this.cellRect(gx, gy), b = this.cellBounds(gx, gy);
        return room.doors.map(d => {
            const dir = sideOf(room, d);
            const link = outgoingConnections(this.document, key).find(c => c.source.door === d.id);
            const target = link && endpointDoor(this.document, link.target);
            const [tx, ty] = (link?.target.room || key).split(',').map(Number);
            const horizontal = dir === 'N' || dir === 'S';
            const halfWidth = (d.width || 1) * TILE / 2;
            return {
                id: d.id, dir, type: d.type, width: d.width || 1, halfWidth,
                passHalfWidth: d.type === 'boss' ? Math.min(halfWidth, DEMO.gatePassHalfWidth) : halfWidth,
                x: d.type === 'stairs' ? rect.x + (d.col + 0.5) * TILE : horizontal ? rect.x + (d.col + (d.width || 1) / 2) * TILE : dir === 'W' ? b.minX : b.maxX,
                y: d.type === 'stairs' ? rect.y + (d.row + 0.5) * TILE : horizontal ? dir === 'N' ? b.minY : b.maxY : rect.y + (d.row + (d.width || 1) / 2) * TILE,
                gx: tx, gy: ty, targetDoor: target?.id,
                blocked: !target || (!!link.requires && !this.progress[link.requires]),
                requires: link?.requires || '', cells: doorCells(room, d)
            };
        });
    }
}
