import { ROOM_COLS, ROOM_ROWS, HOLE_TILE, EMPTY_FLOOR_TILE } from './GameConfig.js';

export const MAP_FORMAT = "dungeon-chained-map";
export const MAP_VERSION = 1;

export const MAP_LIMITS = Object.freeze({
    minGrid: 1,
    maxGrid: 12,
    minRoomCols: 5,
    minRoomRows: 5,
    maxRoomCols: 40,
    maxRoomRows: 30
});

export const MAP_DEFAULTS = Object.freeze({
    name: "Demo",
    gridCols: 5,
    gridRows: 4,
    roomCols: ROOM_COLS,
    roomRows: ROOM_ROWS
});

// Atributo de cada tile, guardado como 1 caractere por coluna em `kinds[row]`.
export const TILE_KIND = Object.freeze({
    FLOOR: "f",
    WALL: "w",
    HOLE: "h",
    VOID: "v"
});

export const TILE_KINDS = Object.freeze({
    f: { label: "Piso", walkable: true },
    w: { label: "Parede (colisão)", walkable: false },
    h: { label: "Buraco (cai)", walkable: false },
    v: { label: "Vazio", walkable: false }
});

export const HOLE_INDEX = HOLE_TILE;
export const VOID_INDEX = EMPTY_FLOOR_TILE;
export const FLOOR_INDEX = 16;

// Índices do tileset que, no modo automático, são pintados como parede (mesma lista da paleta do editor antigo).
export const WALL_TILE_INDICES = Object.freeze([
    0, 1, 2, 3, 4, 5,
    10, 15, 20, 25, 30, 35,
    40, 41, 42, 43, 44, 45,
    50, 51, 52, 53, 54, 55
]);

// `sprite` fica null até existir o asset próprio (ex.: portão do boss).
export const DOOR_TYPES = Object.freeze({
    normal: { label: "Porta", color: "#2cb67d", sprite: null },
    boss: { label: "Portão do boss", color: "#e53170", sprite: null }
});

export const DEFAULT_DOOR_TYPE = "normal";
