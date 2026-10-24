import { DungeonGraph } from './DungeonGraph.js';

export class Dungeon {
    constructor(opts = {}) {

        this.tile = opts.tile ?? 64;
        this.roomCols = opts.roomCols ?? 13;
        this.roomRows = opts.roomRows ?? 9;

        this.cellW = this.roomCols * this.tile;
        this.cellH = this.roomRows * this.tile;

        this.wall = this.tile;

        this.doorHalf = opts.doorHalf ?? this.tile;

        this.graph = opts.graph || new DungeonGraph(opts).generate();

        this.currentKey = this._key(this.graph.start.gx, this.graph.start.gy);
        this.cleared = new Set();
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

    cellCenter(gx, gy) {
        return {
            x: gx * this.cellW + this.cellW / 2,
            y: gy * this.cellH + this.cellH / 2
        };
    }

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

    currentBounds() {
        const c = this.current;
        return this.cellBounds(c.gx, c.gy);
    }

    cellRect(gx, gy) {
        return {
            x: gx * this.cellW,
            y: gy * this.cellH,
            w: this.cellW,
            h: this.cellH
        };
    }

    doorsOf(gx, gy) {
        const cell = this.graph.cells.get(this._key(gx, gy));
        if (!cell) return [];
        const b = this.cellBounds(gx, gy);
        const x0 = gx * this.cellW, y0 = gy * this.cellH;

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

    moveTo(gx, gy) {
        this.currentKey = this._key(gx, gy);
        this.visited.add(this.currentKey);
        return this.current;
    }

    get doorHalfWidth() { return this.doorHalf; }
    get wallThickness() { return this.wall; }
}
