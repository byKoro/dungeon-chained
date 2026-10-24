import { applyImmutableFrame } from './RoomArchetypes.js';

const MAP_DIR = "map/";
const INDEX_FILE = "index.json";

export function doorSignature(doors = {}) {
    return `${doors.N ? 1 : 0},${doors.E ? 1 : 0},${doors.S ? 1 : 0},${doors.W ? 1 : 0}`;
}

function pieceType(piece) {
    const t = piece && piece.type;
    return (t === "start" || t === "boss" || t === "challenge") ? t : "normal";
}

function catalogKey(type, doors) {
    return `${type}|${doorSignature(doors)}`;
}

export class RoomCatalog {
    constructor() {

        this.bySignature = new Map();

        this.byType = new Map();
        this.pieces = [];
        this.loaded = false;
    }

    async load() {
        if (this.loaded) return this;
        let index;
        try {
            const res = await fetch(MAP_DIR + INDEX_FILE, { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            index = await res.json();
        } catch (e) {
            console.warn(`[RoomCatalog] Não foi possível ler ${MAP_DIR}${INDEX_FILE}:`, e.message);
            this.loaded = true;
            return this;
        }

        const files = Array.isArray(index.rooms) ? index.rooms : [];
        const results = await Promise.all(files.map(async (file) => {
            try {
                const res = await fetch(MAP_DIR + file, { cache: "no-store" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const piece = await res.json();
                if (!this._validate(piece, file)) return null;

                Object.defineProperty(piece, "__file", { value: file, enumerable: false });
                return piece;
            } catch (e) {
                console.warn(`[RoomCatalog] Falha ao carregar peça "${file}":`, e.message);
                return null;
            }
        }));

        for (const piece of results) {
            if (!piece) continue;
            this.pieces.push(piece);
            const type = pieceType(piece);
            const key = catalogKey(type, piece.doors);
            if (!this.bySignature.has(key)) this.bySignature.set(key, []);
            this.bySignature.get(key).push(piece);
            if (!this.byType.has(type)) this.byType.set(type, []);
            this.byType.get(type).push(piece);
        }

        this.loaded = true;
        return this;
    }

    _validate(piece, file) {
        if (!piece || typeof piece !== "object") return false;
        if (!piece.doors || typeof piece.doors !== "object") {
            console.warn(`[RoomCatalog] Peça "${file}" sem "doors"; ignorada.`);
            return false;
        }
        if (!Array.isArray(piece.floor)) {
            console.warn(`[RoomCatalog] Peça "${file}" sem matriz "floor"; ignorada.`);
            return false;
        }
        return true;
    }

    countFor(doors, type = "normal") {
        return (this.bySignature.get(catalogKey(type, doors)) || []).length;
    }

    hasFor(doors, type = "normal") {
        return this.countFor(doors, type) > 0;
    }

    _rand(list, rng) {
        if (!list || list.length === 0) return null;
        return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
    }

    pick(doors, type = "normal", rng = Math.random) {

        const exact = this._rand(this.bySignature.get(catalogKey(type, doors)), rng);
        if (exact) return exact;

        if (type === "start" || type === "boss") {
            const anyOfType = this._rand(this.byType.get(type), rng);
            if (anyOfType) return this._adaptToDoors(anyOfType, doors);
            return null;
        }

        if (type === "challenge") {
            return this._rand(this.bySignature.get(catalogKey("normal", doors)), rng);
        }

        return null;
    }

    _adaptToDoors(piece, doors) {
        const cols = piece.cols || (piece.floor[0] ? piece.floor[0].length : 14);
        const rows = piece.rows || piece.floor.length;
        const adaptedFloor = applyImmutableFrame(piece.floor, doors, cols, rows);

        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                if (piece.floor[r] && piece.floor[r][c] === -1) adaptedFloor[r][c] = -1;
            }
        }

        return { ...piece, doors: { ...doors }, floor: adaptedFloor };
    }
}
