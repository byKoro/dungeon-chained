import { DungeonGraph } from './DungeonGraph.js';

/**
 * Dungeon — estado de jogo da dungeon gerada.
 *
 * Consome o DungeonGraph (dados puros) e adiciona:
 *  - conversão grade -> mundo (cada célula é um "tile" de cellW x cellH px);
 *  - bounds jogáveis de cada célula (área interna, descontando a parede);
 *  - posições das portas (no meio de cada lado que conecta a um vizinho);
 *  - controle da célula ATUAL, de quais salas foram limpas e transições.
 *
 * O mundo inteiro tem coordenadas contínuas; a câmera cuida de mostrar a parte
 * relevante. Assim salas e corredores existem lado a lado num grande plano.
 */
export class Dungeon {
    constructor(opts = {}) {
        // Tiles chunky: cada célula é uma grade de tiles grandes.
        this.tile = opts.tile ?? 64;         // tamanho do tile no mundo (px)
        this.roomCols = opts.roomCols ?? 13; // tiles na largura da sala
        this.roomRows = opts.roomRows ?? 9;  // tiles na altura da sala

        // Tamanho de cada célula no mundo, derivado da grade de tiles.
        this.cellW = this.roomCols * this.tile;
        this.cellH = this.roomRows * this.tile;
        // Parede = 1 tile de espessura.
        this.wall = this.tile;
        // Vão da porta: meia-largura = 1 tile (o vão tem 2 tiles de largura,
        // exatamente os 2 tiles de porta desenhados).
        this.doorHalf = opts.doorHalf ?? this.tile;

        this.graph = new DungeonGraph(opts).generate();

        // Estado
        this.currentKey = this._key(this.graph.start.gx, this.graph.start.gy);
        this.cleared = new Set();   // chaves de células (salas) já limpas
        this.visited = new Set([this.currentKey]);
    }

    _key(x, y) { return `${x},${y}`; }

    get current() {
        return this.graph.cells.get(this.currentKey);
    }

    get startKey() {
        return this._key(this.graph.start.gx, this.graph.start.gy);
    }

    cellAtKey(key) {
        return this.graph.cells.get(key) || null;
    }

    // Centro de mundo (px) do centro de uma célula de grade.
    cellCenter(gx, gy) {
        return {
            x: gx * this.cellW + this.cellW / 2,
            y: gy * this.cellH + this.cellH / 2
        };
    }

    // Bounds jogáveis (px) de uma célula: área interna descontando a parede.
    cellBounds(gx, gy) {
        const x0 = gx * this.cellW;
        const y0 = gy * this.cellH;
        return {
            minX: x0 + this.wall,
            maxX: x0 + this.cellW - this.wall,
            minY: y0 + this.wall,
            maxY: y0 + this.cellH - this.wall
        };
    }

    // Bounds da célula atual (usado como "arenaBounds" pela lógica de jogo).
    currentBounds() {
        const c = this.current;
        return this.cellBounds(c.gx, c.gy);
    }

    // Retângulo total (px) de uma célula (incluindo paredes) — para desenho.
    cellRect(gx, gy) {
        return {
            x: gx * this.cellW,
            y: gy * this.cellH,
            w: this.cellW,
            h: this.cellH
        };
    }

    /**
     * Portas de uma célula: para cada lado conectado, o vão no mundo.
     * Retorna [{ dir, x, y, gx, gy }] onde (x,y) é o centro do vão na borda
     * interna e (gx,gy) é a célula vizinha para onde a porta leva.
     */
    doorsOf(gx, gy) {
        const cell = this.graph.cells.get(this._key(gx, gy));
        if (!cell) return [];
        const b = this.cellBounds(gx, gy);
        const x0 = gx * this.cellW, y0 = gy * this.cellH;
        // Alinha o centro do vão com o par de tiles de porta (2 tiles).
        // N/S: colunas midC-1 e midC => centro em midC*tile. E/W idem nas linhas.
        const midC = (this.roomCols / 2) | 0;
        const midR = (this.roomRows / 2) | 0;
        const doorCx = x0 + midC * this.tile;
        const doorCy = y0 + midR * this.tile;
        const out = [];
        if (cell.doors.N) out.push({ dir: "N", x: doorCx, y: b.minY, gx, gy: gy - 1 });
        if (cell.doors.S) out.push({ dir: "S", x: doorCx, y: b.maxY, gx, gy: gy + 1 });
        if (cell.doors.E) out.push({ dir: "E", x: b.maxX, y: doorCy, gx: gx + 1, gy });
        if (cell.doors.W) out.push({ dir: "W", x: b.minX, y: doorCy, gx: gx - 1, gy });
        return out;
    }

    doorsOfCurrent() {
        const c = this.current;
        return this.doorsOf(c.gx, c.gy);
    }

    // Uma sala "de combate" (precisa ser limpa) — corredores são livres.
    isRoom(key = this.currentKey) {
        const c = this.graph.cells.get(key);
        return c && c.kind === "room";
    }

    isCleared(key = this.currentKey) {
        return this.cleared.has(key);
    }

    markCurrentCleared() {
        this.cleared.add(this.currentKey);
    }

    // Move a célula atual para (gx, gy) (transição por porta).
    moveTo(gx, gy) {
        this.currentKey = this._key(gx, gy);
        this.visited.add(this.currentKey);
        return this.current;
    }

    get doorHalfWidth() { return this.doorHalf; }
    get wallThickness() { return this.wall; }
}
