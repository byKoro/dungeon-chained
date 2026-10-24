import { ROOM_COLS, ROOM_ROWS } from '../config/GameConfig.js';

export const ARCHETYPE = Object.freeze({
    CORNER: "CORNER",
    STRAIGHT: "STRAIGHT",
    T_JUNCTION: "T_JUNCTION",
    DEADEND: "DEADEND",
    CROSS: "CROSS"
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

    return { archetype: ARCHETYPE.CROSS, orientation: "4WAY" };
}

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
            return { N: true, S: false, E: true, W: false };

        case ARCHETYPE.T_JUNCTION:
            if (orientation === "T_SOUTH") return { N: false, S: true, E: true, W: true };
            if (orientation === "T_EAST")  return { N: true, S: true, E: true, W: false };
            if (orientation === "T_WEST")  return { N: true, S: true, E: false, W: true };
            return { N: true, S: false, E: true, W: true };

        case ARCHETYPE.DEADEND:
            if (orientation === "SOUTH") return { N: false, S: true, E: false, W: false };
            if (orientation === "EAST")  return { N: false, S: false, E: true, W: false };
            if (orientation === "WEST")  return { N: false, S: false, E: false, W: true };
            return { N: true, S: false, E: false, W: false };

        default:
            return { N: true, S: true, E: true, W: true };
    }
}

export function applyImmutableFrame(floorMatrix, doors = {}, cols = ROOM_COLS, rows = ROOM_ROWS) {
    const lastCol = cols - 1;
    const lastRow = rows - 1;
    const midC = (cols / 2) | 0;
    const midR = (rows / 2) | 0;

    const result = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push(floorMatrix && floorMatrix[r] && floorMatrix[r][c] !== undefined ? floorMatrix[r][c] : 16);
        }
        result.push(row);
    }

    result[0][0] = 0;
    result[0][lastCol] = 5;
    result[lastRow][0] = 40;
    result[lastRow][lastCol] = 45;

    for (let c = 1; c < lastCol; c++) {
        result[0][c] = 2;
        result[lastRow][c] = 42;
    }
    for (let r = 1; r < lastRow; r++) {
        result[r][0] = 20;
        result[r][lastCol] = 25;
    }

    const topRow = 1, botRow = lastRow - 1, leftCol = 1, rightCol = lastCol - 1;

    if (!doors.N && !doors.W && result[topRow][leftCol] === 16) result[topRow][leftCol] = 11;
    if (!doors.N && !doors.E && result[topRow][rightCol] === 16) result[topRow][rightCol] = 14;
    if (!doors.S && !doors.W && result[botRow][leftCol] === 16) result[botRow][leftCol] = 31;
    if (!doors.S && !doors.E && result[botRow][rightCol] === 16) result[botRow][rightCol] = 34;

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

export function transformRoomFloor(baseMatrix, archetype, targetOrientation, cols = ROOM_COLS, rows = ROOM_ROWS) {

    let transformed = baseMatrix.map(r => [...r]);

    if (archetype === ARCHETYPE.CORNER) {

        if (targetOrientation === "NW") transformed = flipInnerHorizontal(transformed, cols, rows);

    } else if (archetype === ARCHETYPE.STRAIGHT) {

        if (targetOrientation === "VERTICAL") {
            transformed = adaptStraightOrDeadendAxis(transformed, "HORIZONTAL", "VERTICAL", cols, rows);
        }
    } else if (archetype === ARCHETYPE.DEADEND) {

        if (targetOrientation === "EAST" || targetOrientation === "WEST") {
            transformed = adaptStraightOrDeadendAxis(transformed, "VERTICAL", "HORIZONTAL", cols, rows);
            if (targetOrientation === "EAST") transformed = flipInnerHorizontal(transformed, cols, rows);
        }

    } else if (archetype === ARCHETYPE.T_JUNCTION) {

        if (targetOrientation === "T_WEST") {
            transformed = adaptTJunctionToWest(transformed, cols, rows);
        } else if (targetOrientation === "T_EAST") {
            transformed = flipInnerHorizontal(adaptTJunctionToWest(transformed, cols, rows), cols, rows);
        }

    }

    const targetDoors = getDoorsForOrientation(archetype, targetOrientation);
    return applyImmutableFrame(transformed, targetDoors, cols, rows);
}

export const VERTICAL_ORIENTATIONS = Object.freeze({
    CORNER: ["SE", "SW"],
    T_JUNCTION: ["T_SOUTH"],
    DEADEND: ["SOUTH"],
    STRAIGHT: [],
    CROSS: []
});

export const LOWER_BASE_ORIENTATION = Object.freeze({
    CORNER: "SE",
    T_JUNCTION: "T_SOUTH",
    DEADEND: "SOUTH"
});

export function needsLowerBase(archetype, orientation) {
    const list = VERTICAL_ORIENTATIONS[archetype] || [];
    return list.includes(orientation);
}

export function adaptTJunctionToWest(matrix, cols = ROOM_COLS, rows = ROOM_ROWS) {
    const result = Array(rows).fill(null).map(() => Array(cols).fill(16));
    const midC = (cols / 2) | 0;
    const midR = (rows / 2) | 0;

    for (let r = 1; r < rows - 1; r++) {
        result[r][midC - 1] = matrix[midR - 1][r % (cols - 2) + 1] || 16;
        result[r][midC] = matrix[midR][r % (cols - 2) + 1] || 17;
    }

    for (let c = 1; c <= midC; c++) {
        result[midR - 1][c] = matrix[c % (rows - 2) + 1][midC - 1] || 16;
        result[midR][c] = matrix[c % (rows - 2) + 1][midC] || 17;
    }

    return result;
}

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

        this.addVariant(ARCHETYPE.CORNER, {
            id: "corner_default",
            name: "Curva Pedras Clássicas",
            floor: this._generateCurvedFloorPath(ROOM_COLS, ROOM_ROWS, 16, 26, "NE"),
            lowerFloor: this._generateCurvedFloorPath(ROOM_COLS, ROOM_ROWS, 16, 26, "SE")
        });

        this.addVariant(ARCHETYPE.CORNER, {
            id: "corner_ruins",
            name: "Curva Ruínas Antigas",
            floor: this._generateCurvedFloorPath(ROOM_COLS, ROOM_ROWS, 17, 72, "NE"),
            lowerFloor: this._generateCurvedFloorPath(ROOM_COLS, ROOM_ROWS, 17, 72, "SE")
        });

        this.addVariant(ARCHETYPE.STRAIGHT, {
            id: "straight_default",
            name: "Corredor Liso",
            floor: this._generateStraightFloorPath(ROOM_COLS, ROOM_ROWS, 16, 26)
        });

        this.addVariant(ARCHETYPE.T_JUNCTION, {
            id: "t_default",
            name: "Junção T Pedras Clássicas",
            floor: this._generateTJunctionFloor(ROOM_COLS, ROOM_ROWS, 16, 26, "T_NORTH"),
            lowerFloor: this._generateTJunctionFloor(ROOM_COLS, ROOM_ROWS, 16, 26, "T_SOUTH")
        });
        this.addVariant(ARCHETYPE.T_JUNCTION, {
            id: "t_ruins",
            name: "Junção T Ruínas de Sangue",
            floor: this._generateTJunctionFloor(ROOM_COLS, ROOM_ROWS, 17, 72, "T_NORTH"),
            lowerFloor: this._generateTJunctionFloor(ROOM_COLS, ROOM_ROWS, 17, 72, "T_SOUTH")
        });

        this.addVariant(ARCHETYPE.DEADEND, {
            id: "deadend_default",
            name: "Câmara de Altar",
            floor: this._generateDeadendFloor(ROOM_COLS, ROOM_ROWS, 16, 73),
            lowerFloor: this._generateDeadendFloor(ROOM_COLS, ROOM_ROWS, 16, 73)
        });

        this.addVariant(ARCHETYPE.CROSS, {
            id: "cross_default",
            name: "Pátio Central",
            floor: this._generateCrossFloor(ROOM_COLS, ROOM_ROWS, 16, 28)
        });
    }

    addVariant(archetype, { id, name, floor, lowerFloor = null }) {
        if (!this.variants[archetype]) this.variants[archetype] = [];

        const upperDoors = getDoorsForOrientation(archetype, CANONICAL_BASE_ORIENTATION[archetype]);
        const framedUpper = applyImmutableFrame(floor, upperDoors, ROOM_COLS, ROOM_ROWS);

        let framedLower = null;
        const lowerOri = LOWER_BASE_ORIENTATION[archetype];
        if (lowerOri) {
            const lowerDoors = getDoorsForOrientation(archetype, lowerOri);
            const lowerSrc = lowerFloor || Array(ROOM_ROWS).fill(null).map(() => Array(ROOM_COLS).fill(16));
            framedLower = applyImmutableFrame(lowerSrc, lowerDoors, ROOM_COLS, ROOM_ROWS);
        }

        const variant = {
            id: id || `${archetype}_var_${this.variants[archetype].length + 1}`,
            name: name || `Variação ${this.variants[archetype].length + 1}`,
            baseFloor: framedUpper,
            lowerBaseFloor: framedLower
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

    getFloorForDoors(doors, variantIndex = null) {
        const { archetype, orientation } = detectShapeFromDoors(doors);
        const list = this.getVariants(archetype);
        if (list.length === 0) {
            const emptyFloor = Array(ROOM_ROWS).fill(null).map(() => Array(ROOM_COLS).fill(16));
            return applyImmutableFrame(emptyFloor, doors, ROOM_COLS, ROOM_ROWS);
        }

        const idx = (variantIndex !== null && variantIndex >= 0 && variantIndex < list.length)
            ? variantIndex
            : Math.floor(Math.random() * list.length);

        const chosenVariant = list[idx];

        if (needsLowerBase(archetype, orientation)) {

            const lowerBase = chosenVariant.lowerBaseFloor || chosenVariant.baseFloor;
            const baseOri = LOWER_BASE_ORIENTATION[archetype];
            let m = lowerBase.map(r => [...r]);
            if (orientation !== baseOri) {

                m = flipInnerHorizontal(m, ROOM_COLS, ROOM_ROWS);
            }
            const targetDoors = getDoorsForOrientation(archetype, orientation);
            return applyImmutableFrame(m, targetDoors, ROOM_COLS, ROOM_ROWS);
        }

        return transformRoomFloor(chosenVariant.baseFloor, archetype, orientation, ROOM_COLS, ROOM_ROWS);
    }

    _generateCurvedFloorPath(cols, rows, baseTile, pathTile, orientation = "NE") {
        const m = Array(rows).fill(null).map(() => Array(cols).fill(baseTile));
        const midC = (cols / 2) | 0;
        const midR = (rows / 2) | 0;
        const north = orientation === "NE" || orientation === "NW";

        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {

                const vertical = (c === midC - 1 || c === midC) &&
                    (north ? r <= midR : r >= midR - 1);
                const horizontal = (c >= midC - 1) && (r === midR - 1 || r === midR);
                if (vertical || horizontal) m[r][c] = pathTile;
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

    _generateTJunctionFloor(cols, rows, baseTile, pathTile, orientation = "T_NORTH") {
        const m = Array(rows).fill(null).map(() => Array(cols).fill(baseTile));
        const midC = (cols / 2) | 0;
        const midR = (rows / 2) | 0;
        const north = orientation === "T_NORTH";

        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {

                if (r === midR - 1 || r === midR) m[r][c] = pathTile;

                const inStem = (c === midC - 1 || c === midC) &&
                    (north ? r <= midR : r >= midR - 1);
                if (inStem) m[r][c] = pathTile;
            }
        }
        return m;
    }

    _generateDeadendFloor(cols, rows, baseTile, shrineTile) {
        const m = Array(rows).fill(null).map(() => Array(cols).fill(baseTile));
        const midC = (cols / 2) | 0;
        const midR = (rows / 2) | 0;

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

export const GlobalRoomVariantCatalog = new RoomVariantCatalog();
