/**
 * RoomPresets.js — Catálogo de peças modulares prontas (templates de salas e corredores).
 *
 * Todas as peças seguem as dimensões padrão do jogo (14x9 tiles) com portas
 * centralizadas de 2 tiles de largura, correspondendo fielmente à geometria
 * de RoomTiles.js e GameConfig.js.
 */

import { RoomTemplate } from './RoomSocket.js';
import { ROOM_COLS, ROOM_ROWS } from '../config/GameConfig.js';

export const RoomPresets = Object.freeze({
    // Salas 4-vias (cruzamento)
    CROSS_4WAY: RoomTemplate.createStandard({
        id: "room_cross_4way",
        name: "Sala de Quatro Vias",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: true, S: true, E: true, W: true },
        kind: "room",
        type: "normal"
    }),

    // Salas 3-vias (T-Junctions)
    T_JUNCTION_NORTH: RoomTemplate.createStandard({
        id: "room_t_junction_n",
        name: "Junção T (Sem porta Sul)",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: true, S: false, E: true, W: true },
        kind: "room",
        type: "normal"
    }),

    T_JUNCTION_SOUTH: RoomTemplate.createStandard({
        id: "room_t_junction_s",
        name: "Junção T (Sem porta Norte)",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: false, S: true, E: true, W: true },
        kind: "room",
        type: "normal"
    }),

    T_JUNCTION_EAST: RoomTemplate.createStandard({
        id: "room_t_junction_e",
        name: "Junção T (Sem porta Oeste)",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: true, S: true, E: true, W: false },
        kind: "room",
        type: "normal"
    }),

    T_JUNCTION_WEST: RoomTemplate.createStandard({
        id: "room_t_junction_w",
        name: "Junção T (Sem porta Leste)",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: true, S: true, E: false, W: true },
        kind: "room",
        type: "normal"
    }),

    // Corredores retos 2-vias
    CORRIDOR_HORIZONTAL: RoomTemplate.createStandard({
        id: "corridor_horizontal_ew",
        name: "Corredor Leste-Oeste",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: false, S: false, E: true, W: true },
        kind: "corridor",
        type: "normal"
    }),

    CORRIDOR_VERTICAL: RoomTemplate.createStandard({
        id: "corridor_vertical_ns",
        name: "Corredor Norte-Sul",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: true, S: true, E: false, W: false },
        kind: "corridor",
        type: "normal"
    }),

    // Cotovelos / Curvas em L (2-vias)
    CORNER_NE: RoomTemplate.createStandard({
        id: "room_corner_ne",
        name: "Curva Norte-Leste",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: true, S: false, E: true, W: false },
        kind: "room",
        type: "normal"
    }),

    CORNER_NW: RoomTemplate.createStandard({
        id: "room_corner_nw",
        name: "Curva Norte-Oeste",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: true, S: false, E: false, W: true },
        kind: "room",
        type: "normal"
    }),

    CORNER_SE: RoomTemplate.createStandard({
        id: "room_corner_se",
        name: "Curva Sul-Leste",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: false, S: true, E: true, W: false },
        kind: "room",
        type: "normal"
    }),

    CORNER_SW: RoomTemplate.createStandard({
        id: "room_corner_sw",
        name: "Curva Sul-Oeste",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: false, S: true, E: false, W: true },
        kind: "room",
        type: "normal"
    }),

    // Finais de linha / Dead-ends (1-via)
    DEADEND_WEST: RoomTemplate.createStandard({
        id: "room_deadend_w",
        name: "Câmara sem Saída (Entrada Oeste)",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: false, S: false, E: false, W: true },
        kind: "room",
        type: "normal"
    }),

    DEADEND_EAST: RoomTemplate.createStandard({
        id: "room_deadend_e",
        name: "Câmara sem Saída (Entrada Leste)",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: false, S: false, E: true, W: false },
        kind: "room",
        type: "normal"
    }),

    DEADEND_NORTH: RoomTemplate.createStandard({
        id: "room_deadend_n",
        name: "Câmara sem Saída (Entrada Norte)",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: true, S: false, E: false, W: false },
        kind: "room",
        type: "normal"
    }),

    DEADEND_SOUTH: RoomTemplate.createStandard({
        id: "room_deadend_s",
        name: "Câmara sem Saída (Entrada Sul)",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: false, S: true, E: false, W: false },
        kind: "room",
        type: "normal"
    }),

    // Sala Inicial e Sala do Chefe
    START_ROOM: RoomTemplate.createStandard({
        id: "room_start_hub",
        name: "Câmara Inicial",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: true, S: true, E: true, W: true },
        kind: "room",
        type: "start"
    }),

    BOSS_ROOM: RoomTemplate.createStandard({
        id: "room_boss_chamber",
        name: "Câmara do Chefe",
        cols: ROOM_COLS,
        rows: ROOM_ROWS,
        doors: { N: false, S: false, E: false, W: true },
        kind: "room",
        type: "boss"
    })
});

/**
 * Retorna todos os presets como um Map de id -> RoomTemplate.
 * @returns {Map<string, RoomTemplate>}
 */
export function getPresetCatalog() {
    const catalog = new Map();
    for (const template of Object.values(RoomPresets)) {
        catalog.set(template.id, template);
    }
    return catalog;
}
