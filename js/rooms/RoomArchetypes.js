/**
 * RoomArchetypes.js — Sistema de Arquétipos, Variações e Transformações Automáticas.
 *
 * Filosofia de Design:
 * 1. MOLDURA IMUTÁVEL: Paredes externas, cantos, tochas e posições das portas
 *    são geradas automaticamente pela engine e nunca precisam ser redesenhadas.
 * 2. PERSONALIZAÇÃO FOCADA NO MIOLO: O usuário desenha apenas o piso interno e detalhes.
 * 3. TRANSFORMAÇÃO AUTOMÁTICA: Desenhe apenas 1 modelo base (ex: Curva NE).
 *    O sistema gera automaticamente as outras 3 orientações (NW, SE, SW)
 *    através de espelhamento e rotação matemática do miolo.
 * 4. VARIAÇÕES: Crie múltiplas variações de piso para o mesmo arquétipo
 *    (ex: Curva Pedras Rachadas, Curva Covil de Sangue, etc.), que serão
 *    sorteadas pela geração procedural da dungeon.
 */

import { ROOM_COLS, ROOM_ROWS } from '../config/GameConfig.js';

export const ARCHETYPE = Object.freeze({
    CORNER: "CORNER",         // Curvas em L (2 portas adjacentes): NE, NW, SE, SW
    STRAIGHT: "STRAIGHT",     // Corredores retos (2 portas opostas): HORIZONTAL, VERTICAL
    T_JUNCTION: "T_JUNCTION", // Junções em T (3 portas): T_NORTH, T_SOUTH, T_EAST, T_WEST
    DEADEND: "DEADEND",       // Salas sem saída (1 porta): NORTH, SOUTH, EAST, WEST
    CROSS: "CROSS"            // Cruzamentos (4 portas): 4WAY
});

export const ARCHETYPE_ORIENTATIONS = Object.freeze({
    CORNER: ["NE", "NW", "SE", "SW"],
    STRAIGHT: ["HORIZONTAL", "VERTICAL"],
    T_JUNCTION: ["T_NORTH", "T_SOUTH", "T_EAST", "T_WEST"],
    DEADEND: ["NORTH", "SOUTH", "EAST", "WEST"],
    CROSS: ["4WAY"]
});

export const CANONICAL_BASE_ORIENTATION = Object.freeze({
    CORNER: "NE",
    STRAIGHT: "HORIZONTAL",
    T_JUNCTION: "T_NORTH",
    DEADEND: "NORTH",
    CROSS: "4WAY"
});

/**
 * Identifica o arquétipo e a orientação de uma sala com base nas portas ativas { N, S, E, W }.
 * @param {{ N?: boolean, S?: boolean, E?: boolean, W?: boolean }} doors
 * @returns {{ archetype: string, orientation: string }}
 */
export function detectShapeFromDoors(doors = {}) {
    const N = !!doors.N, S = !!doors.S, E = !!doors.E, W = !!doors.W;
    const count = (N ? 1 : 0) + (S ? 1 : 0) + (E ? 1 : 0) + (W ? 1 : 0);

    if (count === 4) {
        return { archetype: ARCHETYPE.CROSS, orientation: "4WAY" };
    }

    if (count === 3) {
        if (!S) return { archetype: ARCHETYPE.T_JUNCTION, orientation: "T_NORTH" };
        if (!N) return { archetype: ARCHETYPE.T_JUNCTION, orientation: "T_SOUTH" };
        if (!W) return { archetype: ARCHETYPE.T_JUNCTION, orientation: "T_EAST" };
        if (!E) return { archetype: ARCHETYPE.T_JUNCTION, orientation: "T_WEST" };
    }

    if (count === 2) {
        if (E && W) return { archetype: ARCHETYPE.STRAIGHT, orientation: "HORIZONTAL" };
        if (N && S) return { archetype: ARCHETYPE.STRAIGHT, orientation: "VERTICAL" };
        if (N && E) return { archetype: ARCHETYPE.CORNER, orientation: "NE" };
        if (N && W) return { archetype: ARCHETYPE.CORNER, orientation: "NW" };
        if (S && E) return { archetype: ARCHETYPE.CORNER, orientation: "SE" };
        if (S && W) return { archetype: ARCHETYPE.CORNER, orientation: "SW" };
    }

    if (count === 1) {
        if (N) return { archetype: ARCHETYPE.DEADEND, orientation: "NORTH" };
        if (S) return { archetype: ARCHETYPE.DEADEND, orientation: "SOUTH" };
        if (E) return { archetype: ARCHETYPE.DEADEND, orientation: "EAST" };
        if (W) return { archetype: ARCHETYPE.DEADEND, orientation: "WEST" };
    }

    // Padrão de fallback caso nenhuma porta esteja definida
    return { archetype: ARCHETYPE.CROSS, orientation: "4WAY" };
}

/**
 * Retorna o objeto de portas { N, S, E, W } correspondente a um arquétipo e orientação.
 * @param {string} archetype
 * @param {string} orientation
 * @returns {{ N: boolean, S: boolean, E: boolean, W: boolean }}
 */
export function getDoorsForOrientation(archetype, orientation) {
    switch (archetype) {
        case ARCHETYPE.CROSS:
            return { N: true, S: true, E: true, W: true };

        case ARCHETYPE.STRAIGHT:
            if (orientation === "VERTICAL") return { N: true, S: true, E: false, W: false };
            return { N: false, S: false, E: true, W: true };

        case ARCHETYPE.CORNER:
            if (orientation === "NW") return { N: true, S: false, E: false, W: true };
            if (orientation === "SE") return { N: false, S: true, E: true, W: false };
            if (orientation === "SW") return { N: false, S: true, E: false, W: true };
            return { N: true, S: false, E: true, W: false }; // NE

        case ARCHETYPE.T_JUNCTION:
            if (orientation === "T_SOUTH") return { N: false, S: true, E: true, W: true };
            if (orientation === "T_EAST")  return { N: true, S: true, E: true, W: false };
            if (orientation === "T_WEST")  return { N: true, S: true, E: false, W: true };
            return { N: true, S: false, E: true, W: true }; // T_NORTH

        case ARCHETYPE.DEADEND:
            if (orientation === "SOUTH") return { N: false, S: true, E: false, W: false };
            if (orientation === "EAST")  return { N: false, S: false, E: true, W: false };
            if (orientation === "WEST")  return { N: false, S: false, E: false, W: true };
            return { N: true, S: false, E: false, W: false }; // NORTH

        default:
            return { N: true, S: true, E: true, W: true };
    }
}

/**
 * Aplica a Moldura Imutável (Paredes, Cantos e Portas) sobre uma matriz de piso customizada.
 * O miolo desenhado pelo usuário (colunas 1..cols-2, linhas 1..rows-2) é 100% preservado.
 * As paredes externas e portas são esculpidas matematicamente nos locais exatos.
 *
 * @param {number[][]} floorMatrix Matriz [rows][cols] com tiles customizados do usuário
 * @param {{ N?: boolean, S?: boolean, E?: boolean, W?: boolean }} doors Portas ativas
 * @param {number} [cols=ROOM_COLS]
 * @param {number} [rows=ROOM_ROWS]
 * @returns {number[][]} Nova matriz de tiles com a moldura perfeita aplicada
 */
export function applyImmutableFrame(floorMatrix, doors = {}, cols = ROOM_COLS, rows = ROOM_ROWS) {
    const lastCol = cols - 1;
    const lastRow = rows - 1;
    const midC = (cols / 2) | 0;
    const midR = (rows / 2) | 0;

    // Clona a matriz para não modificar a original
    const result = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push(floorMatrix && floorMatrix[r] && floorMatrix[r][c] !== undefined ? floorMatrix[r][c] : 16);
        }
        result.push(row);
    }

    // 1. Quatro Cantos de Parede Sólida
    result[0][0] = 0;          // Canto Noroeste
    result[0][lastCol] = 5;    // Canto Nordeste
    result[lastRow][0] = 40;   // Canto Sudoeste
    result[lastRow][lastCol] = 45; // Canto Sudeste

    // 2. Paredes Externas Sólidas (Topo, Base, Esquerda, Direita)
    for (let c = 1; c < lastCol; c++) {
        result[0][c] = 2;        // Parede topo
        result[lastRow][c] = 42; // Parede base
    }
    for (let r = 1; r < lastRow; r++) {
        result[r][0] = 20;       // Parede esquerda
        result[r][lastCol] = 25; // Parede direita
    }

    // 3. Beiras e Molduras de Piso de Transição (linhas 1 e lastRow-1, colunas 1 e lastCol-1)
    const topRow = 1, botRow = lastRow - 1, leftCol = 1, rightCol = lastCol - 1;

    // Cantos internos do piso (apenas se for parede sólida ao redor)
    if (!doors.N && !doors.W && result[topRow][leftCol] === 16) result[topRow][leftCol] = 11;
    if (!doors.N && !doors.E && result[topRow][rightCol] === 16) result[topRow][rightCol] = 14;
    if (!doors.S && !doors.W && result[botRow][leftCol] === 16) result[botRow][leftCol] = 31;
    if (!doors.S && !doors.E && result[botRow][rightCol] === 16) result[botRow][rightCol] = 34;

    // 4. Abertura Oficial de Portas (sempre 2 tiles centralizados)
    if (doors.N) {
        result[0][midC - 1] = 16;
        result[0][midC] = 17;
        result[topRow][midC - 1] = 16;
        result[topRow][midC] = 17;
    }
    if (doors.S) {
        result[lastRow][midC - 1] = 16;
        result[lastRow][midC] = 17;
        result[botRow][midC - 1] = 16;
        result[botRow][midC] = 17;
    }
    if (doors.W) {
        result[midR - 1][0] = 16;
        result[midR][0] = 17;
        result[midR - 1][leftCol] = 16;
        result[midR][leftCol] = 17;
    }
    if (doors.E) {
        result[midR - 1][lastCol] = 16;
        result[midR][lastCol] = 17;
        result[midR - 1][rightCol] = 16;
        result[midR][rightCol] = 17;
    }

    return result;
}

/**
 * Espelha horizontalmente o miolo interno de piso (colunas 1..cols-2).
 */
export function flipInnerHorizontal(matrix, cols = ROOM_COLS, rows = ROOM_ROWS) {
    const result = matrix.map(r => [...r]);
    const firstCol = 1;
    const lastCol = cols - 2;

    for (let r = 1; r < rows - 1; r++) {
        for (let c = firstCol; c <= Math.floor((firstCol + lastCol) / 2); c++) {
            const oppC = lastCol - (c - firstCol);
            const temp = result[r][c];
            result[r][c] = result[r][oppC];
            result[r][oppC] = temp;
        }
    }
    return result;
}

/**
 * Espelha verticalmente o miolo interno de piso (linhas 1..rows-2).
 */
export function flipInnerVertical(matrix, cols = ROOM_COLS, rows = ROOM_ROWS) {
    const result = matrix.map(r => [...r]);
    const firstRow = 1;
    const lastRow = rows - 2;

    for (let r = firstRow; r <= Math.floor((firstRow + lastRow) / 2); r++) {
        const oppR = lastRow - (r - firstRow);
        for (let c = 1; c < cols - 1; c++) {
            const temp = result[r][c];
            result[r][c] = result[oppR][c];
            result[oppR][c] = temp;
        }
    }
    return result;
}

/**
 * Transforma o miolo de piso de uma orientação base para uma orientação alvo.
 * Aplica automaticamente as simetrias matemáticas:
 *  - Curva NE -> NW (Flip X)
 *  - Curva NE -> SE (Flip Y)
 *  - Curva NE -> SW (Flip X + Flip Y / Rotação 180°)
 *  - Dead-End North -> South (Flip Y)
 *  - Dead-End West -> East (Flip X)
 *  - T-North -> T-South (Flip Y)
 *  - T-West -> T-East (Flip X)
 *
 * @param {number[][]} baseMatrix Matriz desenhada na orientação canônica base
 * @param {string} archetype
 * @param {string} targetOrientation
 * @param {number} [cols=ROOM_COLS]
 * @param {number} [rows=ROOM_ROWS]
 * @returns {number[][]} Matriz com o miolo adaptado e moldura correta aplicada
 */
export function transformRoomFloor(baseMatrix, archetype, targetOrientation, cols = ROOM_COLS, rows = ROOM_ROWS) {
    let transformed = baseMatrix.map(r => [...r]);

    if (archetype === ARCHETYPE.CORNER) {
        transformed = transformCornerFloor(transformed, targetOrientation, cols, rows);
    } else if (archetype === ARCHETYPE.DEADEND) {
        // Base: NORTH (Porta Norte)
        if (targetOrientation === "SOUTH") {
            transformed = flipInnerVertical(transformed, cols, rows);
        } else if (targetOrientation === "EAST" || targetOrientation === "WEST") {
            transformed = adaptStraightOrDeadendAxis(transformed, "VERTICAL", "HORIZONTAL", cols, rows);
            if (targetOrientation === "EAST") {
                transformed = flipInnerHorizontal(transformed, cols, rows);
            }
        }
    } else if (archetype === ARCHETYPE.STRAIGHT) {
        // Base: HORIZONTAL (Leste-Oeste)
        if (targetOrientation === "VERTICAL") {
            transformed = adaptStraightOrDeadendAxis(transformed, "HORIZONTAL", "VERTICAL", cols, rows);
        }
    } else if (archetype === ARCHETYPE.T_JUNCTION) {
        // Base: T_NORTH (Portas N, E, W)
        if (targetOrientation === "T_SOUTH") {
            transformed = flipTJunctionNorthToSouth(transformed, cols, rows);
        } else if (targetOrientation === "T_WEST") {
            transformed = adaptTJunctionToWest(transformed, cols, rows);
        } else if (targetOrientation === "T_EAST") {
            transformed = flipInnerHorizontal(adaptTJunctionToWest(transformed, cols, rows), cols, rows);
        }
    }

    // Aplica a moldura de paredes e portas inviolável para a orientação alvo
    const targetDoors = getDoorsForOrientation(archetype, targetOrientation);
    return applyImmutableFrame(transformed, targetDoors, cols, rows);
}

/**
 * Transforma o piso de Curva em L (Base: NE) para as outras 3 orientações (NW, SE, SW),
 * garantindo alinhamento perfeito com portas e paredes.
 */
export function transformCornerFloor(baseMatrix, targetOrientation, cols = ROOM_COLS, rows = ROOM_ROWS) {
    if (targetOrientation === "NW") {
        return flipInnerHorizontal(baseMatrix, cols, rows);
    }

    const midC = (cols / 2) | 0;
    const midR = (rows / 2) | 0;

    if (targetOrientation === "SE") {
        // A haste vertical que subia até o Norte (r <= midR) agora desce até o Sul (r >= midR - 1)
        // O corredor leste em rows midR-1 e midR continua alinhado com a porta Leste
        const se = Array(rows).fill(null).map(() => Array(cols).fill(16));
        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                if ((r === midR - 1 || r === midR) && c >= midC - 1) {
                    se[r][c] = baseMatrix[r][c];
                } else if ((c === midC - 1 || c === midC) && r >= midR - 1) {
                    const sourceR = (rows - 1) - r;
                    se[r][c] = baseMatrix[Math.max(1, sourceR)][c];
                } else {
                    const oppR = (rows - 1) - r;
                    se[r][c] = baseMatrix[Math.max(1, Math.min(rows - 2, oppR))][c];
                }
            }
        }
        return se;
    }

    if (targetOrientation === "SW") {
        const se = transformCornerFloor(baseMatrix, "SE", cols, rows);
        return flipInnerHorizontal(se, cols, rows);
    }

    return baseMatrix.map(r => [...r]);
}

/**
 * Espelha verticalmente uma Junção em T (T_NORTH -> T_SOUTH).
 * A haste vertical que subia até o Norte passa a descer até o Sul,
 * enquanto o corredor Leste-Oeste em midR-1 e midR permanece alinhado às portas E e W.
 */
export function flipTJunctionNorthToSouth(matrix, cols = ROOM_COLS, rows = ROOM_ROWS) {
    const result = matrix.map(r => [...r]);
    const midC = (cols / 2) | 0;
    const midR = (rows / 2) | 0;

    // Haste central (colunas midC-1 e midC)
    for (let c = midC - 1; c <= midC; c++) {
        for (let r = 1; r < rows - 1; r++) {
            if (r >= midR) {
                // A haste sul recebe o conteúdo da haste norte original
                const sourceR = (rows - 1) - r;
                result[r][c] = matrix[Math.max(1, sourceR)][c];
            } else if (r < midR - 1) {
                // Onde havia a haste norte, passa a ter o piso de fundo do sul original
                const sourceR = (rows - 1) - r;
                result[r][c] = matrix[Math.min(rows - 2, sourceR)][c];
            }
        }
    }

    // Quadrantes fora da haste central: inverte topo e fundo
    for (let r = 1; r <= 2; r++) {
        const oppR = (rows - 1) - r;
        for (let c = 1; c < cols - 1; c++) {
            if (c !== midC - 1 && c !== midC) {
                const temp = result[r][c];
                result[r][c] = result[oppR][c];
                result[oppR][c] = temp;
            }
        }
    }

    return result;
}

/**
 * Adapta T_NORTH (haste Norte, corredor Leste-Oeste) para T_WEST (haste Oeste, corredor Norte-Sul).
 */
export function adaptTJunctionToWest(matrix, cols = ROOM_COLS, rows = ROOM_ROWS) {
    const result = Array(rows).fill(null).map(() => Array(cols).fill(16));
    const midC = (cols / 2) | 0;
    const midR = (rows / 2) | 0;

    // Corredor vertical contínuo Norte-Sul em midC-1 e midC
    for (let r = 1; r < rows - 1; r++) {
        result[r][midC - 1] = matrix[midR - 1][r % (cols - 2) + 1] || 16;
        result[r][midC] = matrix[midR][r % (cols - 2) + 1] || 17;
    }

    // Haste horizontal para o Oeste em midR-1 e midR (de c=1 até midC)
    for (let c = 1; c <= midC; c++) {
        result[midR - 1][c] = matrix[c % (rows - 2) + 1][midC - 1] || 16;
        result[midR][c] = matrix[c % (rows - 2) + 1][midC] || 17;
    }

    return result;
}

/**
 * Adapta a trilha central de piso entre corredores horizontais e verticais.
 */
function adaptStraightOrDeadendAxis(matrix, fromAxis, toAxis, cols, rows) {
    const result = matrix.map(r => [...r]);
    const midC = (cols / 2) | 0;
    const midR = (rows / 2) | 0;

    if (fromAxis === "HORIZONTAL" && toAxis === "VERTICAL") {
        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                if (c === midC - 1 || c === midC) {
                    result[r][c] = matrix[midR][c % (rows - 2) + 1] || 16;
                } else {
                    result[r][c] = 16;
                }
            }
        }
    } else if (fromAxis === "VERTICAL" && toAxis === "HORIZONTAL") {
        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                if (r === midR - 1 || r === midR) {
                    result[r][c] = matrix[r % (cols - 2) + 1][midC] || 16;
                } else {
                    result[r][c] = 16;
                }
            }
        }
    }

    return result;
}

/**
 * Catálogo Central de Variações de Sala.
 * Permite cadastrar múltiplos estilos de piso para cada arquétipo.
 */
export class RoomVariantCatalog {
    constructor() {
        this.variants = {
            [ARCHETYPE.CORNER]: [],
            [ARCHETYPE.STRAIGHT]: [],
            [ARCHETYPE.T_JUNCTION]: [],
            [ARCHETYPE.DEADEND]: [],
            [ARCHETYPE.CROSS]: []
        };
        this._initDefaultVariants();
    }

    _initDefaultVariants() {
        // Variação 1: Curva Padrão (NE)
        this.addVariant(ARCHETYPE.CORNER, {
            id: "corner_default",
            name: "Curva Pedras Clássicas",
            floor: this._generateCurvedFloorPath(ROOM_COLS, ROOM_ROWS, 16, 26)
        });

        // Variação 2: Curva Covil / Ruínas (NE)
        this.addVariant(ARCHETYPE.CORNER, {
            id: "corner_ruins",
            name: "Curva Ruínas Antigas",
            floor: this._generateCurvedFloorPath(ROOM_COLS, ROOM_ROWS, 17, 72)
        });

        // Variação: Corredor Reto
        this.addVariant(ARCHETYPE.STRAIGHT, {
            id: "straight_default",
            name: "Corredor Liso",
            floor: this._generateStraightFloorPath(ROOM_COLS, ROOM_ROWS, 16, 26)
        });

        // Variação: Junção em T (Base: T_NORTH - portas N, E, W)
        this.addVariant(ARCHETYPE.T_JUNCTION, {
            id: "t_default",
            name: "Junção T Pedras Clássicas",
            floor: this._generateTJunctionFloor(ROOM_COLS, ROOM_ROWS, 16, 26)
        });
        this.addVariant(ARCHETYPE.T_JUNCTION, {
            id: "t_ruins",
            name: "Junção T Ruínas de Sangue",
            floor: this._generateTJunctionFloor(ROOM_COLS, ROOM_ROWS, 17, 72)
        });

        // Variação: Dead-end (Câmara Final)
        this.addVariant(ARCHETYPE.DEADEND, {
            id: "deadend_default",
            name: "Câmara de Altar",
            floor: this._generateDeadendFloor(ROOM_COLS, ROOM_ROWS, 16, 73)
        });

        // Variação: Cruzamento 4-Vias
        this.addVariant(ARCHETYPE.CROSS, {
            id: "cross_default",
            name: "Pátio Central",
            floor: this._generateCrossFloor(ROOM_COLS, ROOM_ROWS, 16, 28)
        });
    }

    addVariant(archetype, { id, name, floor }) {
        if (!this.variants[archetype]) this.variants[archetype] = [];
        // Aplica a moldura imutável da base canônica
        const baseDoors = getDoorsForOrientation(archetype, CANONICAL_BASE_ORIENTATION[archetype]);
        const framedFloor = applyImmutableFrame(floor, baseDoors, ROOM_COLS, ROOM_ROWS);

        const variant = {
            id: id || `${archetype}_var_${this.variants[archetype].length + 1}`,
            name: name || `Variação ${this.variants[archetype].length + 1}`,
            baseFloor: framedFloor
        };

        const existingIdx = this.variants[archetype].findIndex(v => v.id === variant.id);
        if (existingIdx >= 0) {
            this.variants[archetype][existingIdx] = variant;
        } else {
            this.variants[archetype].push(variant);
        }
        return variant;
    }

    getVariants(archetype) {
        return this.variants[archetype] || [];
    }

    /**
     * Obtém o piso pronto e transformado para qualquer combinação de portas,
     * escolhendo uma variação específica ou aleatória.
     *
     * @param {{ N?: boolean, S?: boolean, E?: boolean, W?: boolean }} doors
     * @param {number|null} [variantIndex=null]
     * @returns {number[][]} Matriz pronta para a engine
     */
    getFloorForDoors(doors, variantIndex = null) {
        const { archetype, orientation } = detectShapeFromDoors(doors);
        const list = this.getVariants(archetype);
        if (list.length === 0) {
            // Fallback: piso liso com moldura
            const emptyFloor = Array(ROOM_ROWS).fill(null).map(() => Array(ROOM_COLS).fill(16));
            return applyImmutableFrame(emptyFloor, doors, ROOM_COLS, ROOM_ROWS);
        }

        const idx = (variantIndex !== null && variantIndex >= 0 && variantIndex < list.length)
            ? variantIndex
            : Math.floor(Math.random() * list.length);

        const chosenVariant = list[idx];
        return transformRoomFloor(chosenVariant.baseFloor, archetype, orientation, ROOM_COLS, ROOM_ROWS);
    }

    /* Geradores utilitários de pisos decorativos padrão */
    _generateCurvedFloorPath(cols, rows, baseTile, pathTile) {
        const m = Array(rows).fill(null).map(() => Array(cols).fill(baseTile));
        const midC = (cols / 2) | 0;
        const midR = (rows / 2) | 0;

        // Trilha que sai da porta Norte (colunas midC-1 e midC) e curva para a porta Leste (linhas midR-1 e midR)
        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                if ((r <= midR && (c === midC - 1 || c === midC)) ||
                    (c >= midC - 1 && (r === midR - 1 || r === midR))) {
                    m[r][c] = pathTile;
                }
            }
        }
        return m;
    }

    _generateStraightFloorPath(cols, rows, baseTile, pathTile) {
        const m = Array(rows).fill(null).map(() => Array(cols).fill(baseTile));
        const midR = (rows / 2) | 0;
        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                if (r === midR - 1 || r === midR) m[r][c] = pathTile;
            }
        }
        return m;
    }

    _generateTJunctionFloor(cols, rows, baseTile, pathTile) {
        const m = Array(rows).fill(null).map(() => Array(cols).fill(baseTile));
        const midC = (cols / 2) | 0;
        const midR = (rows / 2) | 0;

        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                // Corredor horizontal Leste-Oeste (linhas midR-1 e midR)
                if (r === midR - 1 || r === midR) {
                    m[r][c] = pathTile;
                }
                // Haste vertical Norte (colunas midC-1 e midC, r <= midR)
                if (r <= midR && (c === midC - 1 || c === midC)) {
                    m[r][c] = pathTile;
                }
            }
        }
        return m;
    }

    _generateDeadendFloor(cols, rows, baseTile, shrineTile) {
        const m = Array(rows).fill(null).map(() => Array(cols).fill(baseTile));
        const midC = (cols / 2) | 0;
        const midR = (rows / 2) | 0;

        // Altar / pedestal decorativo no fundo
        for (let r = midR - 1; r <= midR + 1; r++) {
            for (let c = midC - 1; c <= midC + 1; c++) {
                m[r][c] = shrineTile;
            }
        }
        return m;
    }

    _generateCrossFloor(cols, rows, baseTile, pathTile) {
        const m = Array(rows).fill(null).map(() => Array(cols).fill(baseTile));
        const midC = (cols / 2) | 0;
        const midR = (rows / 2) | 0;

        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                if (r === midR - 1 || r === midR || c === midC - 1 || c === midC) {
                    m[r][c] = pathTile;
                }
            }
        }
        return m;
    }
}

// Instância global compartilhada do catálogo
export const GlobalRoomVariantCatalog = new RoomVariantCatalog();
