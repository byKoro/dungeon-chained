/**
 * DungeonGraph — geração PROCEDURAL pura do layout da dungeon.
 *
 * Não desenha nada nem conhece o Canvas: só produz DADOS. Inspirado no
 * gerador (salas na grade + algoritmo de Prim para conectar as mais próximas
 * + corredores em L), portado para JS puro.
 *
 * Saída de generate():
 * {
 *   cols, rows,                     // dimensões da grade
 *   cells: Map<"x,y", cell>,        // células ocupadas (salas e corredores)
 *   rooms: [{ gx, gy, type }],      // salas (type: "start" | "normal" | "boss")
 *   start: { gx, gy },              // sala inicial
 *   // cada cell: { gx, gy, kind: "room"|"corridor", doors: {N,S,E,W:bool} }
 * }
 *
 * "doors" indica em quais lados a célula conecta a um vizinho ocupado.
 */

const DIRS = [
    { dx: 0, dy: -1, key: "N", opp: "S" },
    { dx: 0, dy: 1, key: "S", opp: "N" },
    { dx: 1, dy: 0, key: "E", opp: "W" },
    { dx: -1, dy: 0, key: "W", opp: "E" }
];

export class DungeonGraph {
    /**
     * @param {object} opts
     *   cols, rows        tamanho da grade
     *   roomCount         quantas salas gerar
     *   rng               função () => [0,1) (opcional, default Math.random)
     */
    constructor(opts = {}) {
        this.cols = opts.cols ?? 9;
        this.rows = opts.rows ?? 7;
        this.roomCount = opts.roomCount ?? 8;
        this.rng = opts.rng ?? Math.random;
        this.layout = opts.layout ?? null;
    }

    _key(x, y) { return `${x},${y}`; }
    _rand(n) { return Math.floor(this.rng() * n); }

    // Distância de grade (usada pelo Prim). Euclidiana ao quadrado basta.
    _dist2(a, b) {
        const dx = a.gx - b.gx, dy = a.gy - b.gy;
        return dx * dx + dy * dy;
    }

    /**
     * Espalha salas na grade com um espaçamento mínimo, para não ficarem
     * grudadas (versão simples de "poisson-like": tenta pontos aleatórios e
     * rejeita os muito próximos de salas já colocadas).
     */
    _scatterRooms() {
        const rooms = [];
        const minSpacing = 2; // células de distância mínima entre centros
        let attempts = 0;
        const maxAttempts = this.roomCount * 60;

        // Sala inicial no centro
        const start = { gx: (this.cols / 2) | 0, gy: (this.rows / 2) | 0, type: "start" };
        rooms.push(start);

        while (rooms.length < this.roomCount && attempts < maxAttempts) {
            attempts++;
            const gx = 1 + this._rand(this.cols - 2);
            const gy = 1 + this._rand(this.rows - 2);
            const candidate = { gx, gy, type: "normal" };

            let ok = true;
            for (const r of rooms) {
                if (Math.abs(r.gx - gx) < minSpacing && Math.abs(r.gy - gy) < minSpacing) {
                    ok = false;
                    break;
                }
            }
            if (ok) rooms.push(candidate);
        }

        // A sala mais distante da inicial vira a "boss"
        if (rooms.length > 1) {
            let far = rooms[1], farD = -1;
            for (let i = 1; i < rooms.length; i++) {
                const d = this._dist2(start, rooms[i]);
                if (d > farD) { farD = d; far = rooms[i]; }
            }
            far.type = "boss";
        }

        return { rooms, start };
    }

    /**
     * Conecta as salas com o algoritmo de Prim: começa por uma sala e vai
     * ligando sempre o par (visitada, restante) de menor distância, formando
     * uma árvore geradora mínima (todas alcançáveis, sem excesso de arestas).
     * Retorna a lista de arestas [{ a, b }] (salas a conectar por corredor).
     */
    _connectPrim(rooms) {
        const edges = [];
        if (rooms.length <= 1) return edges;

        const visited = [rooms[0]];
        const remaining = rooms.slice(1);

        while (remaining.length > 0) {
            let best = null, bestD = Infinity, bestIdx = -1;
            for (const v of visited) {
                for (let i = 0; i < remaining.length; i++) {
                    const d = this._dist2(v, remaining[i]);
                    if (d < bestD) {
                        bestD = d;
                        best = { a: v, b: remaining[i] };
                        bestIdx = i;
                    }
                }
            }
            if (!best) break;
            edges.push(best);
            visited.push(best.b);
            remaining.splice(bestIdx, 1);
        }

        return edges;
    }

    /**
     * Cava um corredor em L entre duas salas, marcando as células percorridas.
     * Move primeiro no eixo de maior distância, depois no outro (igual ao
     * gerador original).
     */
    _carveCorridor(a, b, cells) {
        let x = a.gx, y = a.gy;
        const x2 = b.gx, y2 = b.gy;

        while (x !== x2 || y !== y2) {
            if (Math.abs(x - x2) > Math.abs(y - y2)) {
                x += x < x2 ? 1 : -1;
            } else if (y !== y2) {
                y += y < y2 ? 1 : -1;
            } else {
                x += x < x2 ? 1 : -1;
            }

            const key = this._key(x, y);
            // Não sobrescreve uma sala; só cria corredor em célula vazia.
            if (!cells.has(key)) {
                cells.set(key, { gx: x, gy: y, kind: "corridor", doors: { N: false, S: false, E: false, W: false } });
            }
        }
    }

    /** Calcula as portas de cada célula: abre para todo vizinho ocupado. */
    _computeDoors(cells) {
        for (const cell of cells.values()) {
            for (const d of DIRS) {
                const nKey = this._key(cell.gx + d.dx, cell.gy + d.dy);
                if (cells.has(nKey)) cell.doors[d.key] = true;
            }
        }
    }

    _generateFromLayout(layout) {
        if (!layout || layout.version !== 1) {
            throw new Error("Formato de mapa inválido (esperada a versão 1).");
        }
        if (layout.cols !== this.cols || layout.rows !== this.rows) {
            throw new Error(`O mapa precisa ter grade ${this.cols}x${this.rows}.`);
        }
        if (!Array.isArray(layout.rooms) || !Array.isArray(layout.edges)) {
            throw new Error("O mapa precisa conter as listas rooms e edges.");
        }

        const rooms = [];
        const roomByKey = new Map();
        for (const input of layout.rooms) {
            const { gx, gy, type } = input || {};
            if (!Number.isInteger(gx) || !Number.isInteger(gy) ||
                gx < 0 || gx >= this.cols || gy < 0 || gy >= this.rows) {
                throw new Error("Há uma sala fora dos limites da grade.");
            }
            if (!["start", "normal", "boss"].includes(type)) {
                throw new Error(`Tipo de sala inválido em ${gx},${gy}.`);
            }
            for (const [field, max] of [["enemyCount", 20], ["boxCount", 10], ["heartCount", 10], ["heartDropChance", 100]]) {
                if (input[field] !== undefined && (!Number.isInteger(input[field]) || input[field] < 0 || input[field] > max)) {
                    throw new Error(`Valor inválido para ${field} na sala ${gx},${gy}.`);
                }
            }
            if (input.enemyType !== undefined && !["random", "demon", "blood"].includes(input.enemyType)) {
                throw new Error(`Tipo de inimigo inválido na sala ${gx},${gy}.`);
            }
            const key = this._key(gx, gy);
            if (roomByKey.has(key)) throw new Error(`Há mais de uma sala em ${key}.`);
            const room = { ...input, gx, gy, type };
            rooms.push(room);
            roomByKey.set(key, room);
        }

        const starts = rooms.filter(room => room.type === "start");
        if (starts.length !== 1) throw new Error("O mapa precisa ter exatamente uma sala inicial.");
        const start = starts[0];
        if (!layout.start || layout.start.gx !== start.gx || layout.start.gy !== start.gy) {
            throw new Error("A posição start precisa apontar para a sala inicial.");
        }

        const edges = [];
        const adjacency = new Map(rooms.map(room => [this._key(room.gx, room.gy), new Set()]));
        const edgeKeys = new Set();
        for (const input of layout.edges) {
            const a = input?.a, b = input?.b;
            const aKey = a && this._key(a.gx, a.gy);
            const bKey = b && this._key(b.gx, b.gy);
            if (!a || !b || !roomByKey.has(aKey) || !roomByKey.has(bKey) || aKey === bKey) {
                throw new Error("Uma conexão aponta para uma sala inexistente ou para ela mesma.");
            }
            const edgeKey = [aKey, bKey].sort().join("|");
            if (edgeKeys.has(edgeKey)) throw new Error("O mapa contém uma conexão duplicada.");
            edgeKeys.add(edgeKey);
            const roomA = roomByKey.get(aKey), roomB = roomByKey.get(bKey);
            edges.push({ a: roomA, b: roomB });
            adjacency.get(aKey).add(bKey);
            adjacency.get(bKey).add(aKey);
        }

        const reached = new Set([this._key(start.gx, start.gy)]);
        const queue = [this._key(start.gx, start.gy)];
        while (queue.length) {
            for (const next of adjacency.get(queue.shift())) {
                if (!reached.has(next)) { reached.add(next); queue.push(next); }
            }
        }
        if (reached.size !== rooms.length) {
            throw new Error("Todas as salas precisam estar conectadas à sala inicial.");
        }

        const cells = new Map();
        for (const room of rooms) {
            cells.set(this._key(room.gx, room.gy), {
                ...room, gx: room.gx, gy: room.gy, kind: "room", type: room.type,
                doors: { N: false, S: false, E: false, W: false }
            });
        }
        for (const edge of edges) this._carveCorridor(edge.a, edge.b, cells);
        this._computeDoors(cells);

        return { cols: this.cols, rows: this.rows, cells, rooms, edges, start: { gx: start.gx, gy: start.gy } };
    }

    generate() {
        if (this.layout) return this._generateFromLayout(this.layout);
        const { rooms, start } = this._scatterRooms();

        // Registra as salas como células
        const cells = new Map();
        for (const r of rooms) {
            cells.set(this._key(r.gx, r.gy), {
                gx: r.gx, gy: r.gy, kind: "room", type: r.type,
                doors: { N: false, S: false, E: false, W: false }
            });
        }

        // Conecta com Prim e cava corredores
        const edges = this._connectPrim(rooms);
        for (const e of edges) this._carveCorridor(e.a, e.b, cells);

        // Calcula portas (conexões entre células vizinhas)
        this._computeDoors(cells);

        return {
            cols: this.cols,
            rows: this.rows,
            cells,
            rooms,
            edges,
            start: { gx: start.gx, gy: start.gy }
        };
    }
}
