/**
 * RoomCatalog — carrega as peças autorais de /map e as indexa por assinatura
 * de portas, para o gerador sortear uma variação que encaixe em cada slot.
 *
 * Fluxo:
 *   const catalog = new RoomCatalog();
 *   await catalog.load();                 // lê map/index.json + cada peça
 *   const piece = catalog.pick(doors, rng); // sorteia uma peça p/ a assinatura
 *
 * A peça retornada é o objeto cru do arquivo (floor, torches, props, enemies,
 * hazards, ...). Se não houver peça para a assinatura, pick() devolve null e o
 * chamador recorre ao fallback procedural.
 */

import { applyImmutableFrame } from './RoomArchetypes.js';

const MAP_DIR = "map/";
const INDEX_FILE = "index.json";

/** Assinatura canônica de portas: "N,E,S,W" como bits. Ex.: {N,E} -> "1,1,0,0". */
export function doorSignature(doors = {}) {
    return `${doors.N ? 1 : 0},${doors.E ? 1 : 0},${doors.S ? 1 : 0},${doors.W ? 1 : 0}`;
}

/** Tipo da peça normalizado. Ausente/desconhecido vira "normal". */
function pieceType(piece) {
    const t = piece && piece.type;
    return (t === "start" || t === "boss" || t === "challenge") ? t : "normal";
}

/** Chave do índice: "<tipo>|<assinatura de portas>". */
function catalogKey(type, doors) {
    return `${type}|${doorSignature(doors)}`;
}

export class RoomCatalog {
    constructor() {
        // Map "<tipo>|<assinatura>" -> piece[]
        this.bySignature = new Map();
        // Map "<tipo>" -> piece[]  (para adaptar start/boss a qualquer porta)
        this.byType = new Map();
        this.pieces = [];
        this.loaded = false;
    }

    /**
     * Carrega o índice e todas as peças listadas. Erros em peças individuais
     * são logados mas não interrompem o carregamento das demais.
     */
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
                // Rastreia o nome do arquivo de origem (para deletar/editar).
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

    /** Quantas peças existem para um tipo + assinatura de portas. */
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

    /**
     * Sorteia uma peça para o TIPO + assinatura de portas dados.
     *
     * Regras:
     *  - Primeiro tenta a assinatura EXATA do tipo.
     *  - "start"/"boss": se não houver a assinatura exata, pega QUALQUER peça do
     *    tipo e ADAPTA o floor às portas reais da célula (abre/fecha os vãos),
     *    preservando o miolo desenhado. Assim basta 1 peça start/boss para
     *    qualquer combinação de portas que a geração produzir.
     *  - "challenge": cai para "normal" se não houver específica.
     *  - "normal": só a assinatura exata (senão null -> fallback procedural).
     *
     * @param {object} doors { N,S,E,W }
     * @param {string} [type]  "normal" | "start" | "boss" | "challenge"
     * @param {() => number} [rng] função 0..1 (default Math.random)
     * @returns {object|null} peça (possivelmente com floor adaptado) ou null
     */
    pick(doors, type = "normal", rng = Math.random) {
        // 1) assinatura exata do tipo
        const exact = this._rand(this.bySignature.get(catalogKey(type, doors)), rng);
        if (exact) return exact;

        // 2) start/boss: adapta qualquer peça do tipo às portas reais
        if (type === "start" || type === "boss") {
            const anyOfType = this._rand(this.byType.get(type), rng);
            if (anyOfType) return this._adaptToDoors(anyOfType, doors);
            return null; // sem peça do tipo -> fallback procedural
        }

        // 3) challenge reaproveita normal
        if (type === "challenge") {
            return this._rand(this.bySignature.get(catalogKey("normal", doors)), rng);
        }

        return null;
    }

    /**
     * Devolve uma CÓPIA da peça com o floor adaptado às portas `doors`: a
     * moldura e os vãos são reescritos para bater com as portas reais, mantendo
     * o miolo (colunas internas) intacto. Buracos (-1) do miolo são preservados.
     */
    _adaptToDoors(piece, doors) {
        const cols = piece.cols || (piece.floor[0] ? piece.floor[0].length : 14);
        const rows = piece.rows || piece.floor.length;
        const adaptedFloor = applyImmutableFrame(piece.floor, doors, cols, rows);

        // Reaplica buracos do miolo (applyImmutableFrame não conhece -1).
        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                if (piece.floor[r] && piece.floor[r][c] === -1) adaptedFloor[r][c] = -1;
            }
        }

        return { ...piece, doors: { ...doors }, floor: adaptedFloor };
    }
}
