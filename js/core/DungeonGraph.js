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

    generate() {
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
