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
        // Tamanho de cada célula no mundo (px). Salas ocupam a tela ~inteira.
        this.cellW = opts.cellW ?? 1100;
        this.cellH = opts.cellH ?? 680;
        // Espessura da "parede" (margem não-jogável dentro da célula).
        this.wall = opts.wall ?? 70;
        // Meia-largura da abertura da porta (vão livre).
        this.doorHalf = opts.doorHalf ?? 70;

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
        const cx = gx * this.cellW + this.cellW / 2;
        const cy = gy * this.cellH + this.cellH / 2;
        const out = [];
        if (cell.doors.N) out.push({ dir: "N", x: cx, y: b.minY, gx, gy: gy - 1 });
        if (cell.doors.S) out.push({ dir: "S", x: cx, y: b.maxY, gx, gy: gy + 1 });
        if (cell.doors.E) out.push({ dir: "E", x: b.maxX, y: cy, gx: gx + 1, gy });
        if (cell.doors.W) out.push({ dir: "W", x: b.minX, y: cy, gx: gx - 1, gy });
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
