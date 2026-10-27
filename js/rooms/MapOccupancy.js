import { ANIMATED_PROPS } from '../config/PropConfig.js';

export function occupiedCells(object) {
    const prop = ANIMATED_PROPS[object.type];
    const vertical = object.dir === 'up' || object.dir === 'down';
    const width = object.type === 'spikeRow' ? vertical ? 1 : object.count || 1 : prop?.w || 1;
    const height = object.type === 'spikeRow' ? vertical ? object.count || 1 : 1 : prop?.h || 1;
    const cells = [];
    for (let row = 0; row < height; row++) for (let col = 0; col < width; col++) cells.push({ col: object.col + col, row: object.row + row });
    return cells;
}

export function dangerousCells(room) {
    return new Set((room.hazards || []).filter(h => h.type !== 'button').flatMap(occupiedCells).map(p => `${p.col},${p.row}`));
}
