export class RoomTiles {

    constructor(cols, rows, doors, seed, decorate = true) {
        this.cols = cols;
        this.rows = rows;
        this.doors = doors || {};
        this._decorate = decorate;

        this.floor = [];
        this.props = [];
        this.doorCells = [];
        this.torches = [];
        this._build(decorate);
    }

    _build(decorate) {
        const C = this.cols, R = this.rows;
        const last = C - 1, bottom = R - 1;

        for (let r = 0; r < R; r++) {
            const line = [];
            for (let c = 0; c < C; c++) {
                line.push(this._tileAt(c, r, last, bottom));
            }
            this.floor.push(line);
        }

        this._openDoors(last, bottom);

    }

    _tileAt(c, r, last, bottom) {

        if (r === 0 && c === 0) return 0;
        if (r === 0 && c === last) return 5;
        if (r === bottom && c === 0) return 40;
        if (r === bottom && c === last) return 45;

        if (r === 0) return 2;
        if (r === bottom) return 42;
        if (c === 0) return 20;
        if (c === last) return 25;

        const topRow = 1, botRow = bottom - 1, leftCol = 1, rightCol = last - 1;
        if (r === topRow && c === leftCol) return 11;
        if (r === topRow && c === rightCol) return 14;
        if (r === botRow && c === leftCol) return 31;
        if (r === botRow && c === rightCol) return 34;
        if (r === topRow) return 12;
        if (r === botRow) return 32;
        if (c === leftCol) return 21;
        if (c === rightCol) return 24;

        return 16;
    }

    _openDoors(last, bottom) {

        const midC = (this.cols / 2) | 0;
        const midR = (this.rows / 2) | 0;

        const FLOOR = 16;
        if (this.doors.N) {
            this.floor[0][midC - 1] = FLOOR;
            this.floor[0][midC] = FLOOR;
            this.doorCells.push({ col: midC - 1, row: 0, index: 36 }, { col: midC, row: 0, index: 37 });
        }
        if (this.doors.S) {
            this.floor[bottom][midC - 1] = FLOOR;
            this.floor[bottom][midC] = FLOOR;
            this.doorCells.push({ col: midC - 1, row: bottom, index: 36 }, { col: midC, row: bottom, index: 37 });
        }
        if (this.doors.W) {
            this.floor[midR - 1][0] = FLOOR;
            this.floor[midR][0] = FLOOR;
            this.doorCells.push({ col: 0, row: midR - 1, index: 47 }, { col: 0, row: midR, index: 57 });
        }
        if (this.doors.E) {
            this.floor[midR - 1][last] = FLOOR;
            this.floor[midR][last] = FLOOR;
            this.doorCells.push({ col: last, row: midR - 1, index: 48 }, { col: last, row: midR, index: 58 });
        }

        const topRow = 1, botRow = bottom - 1, leftCol = 1, rightCol = last - 1;
        if (this.doors.N) {
            this.floor[topRow][midC - 1] = FLOOR;
            this.floor[topRow][midC] = FLOOR;
        }
        if (this.doors.S) {
            this.floor[botRow][midC - 1] = FLOOR;
            this.floor[botRow][midC] = FLOOR;
        }
        if (this.doors.W) {
            this.floor[midR - 1][leftCol] = FLOOR;
            this.floor[midR][leftCol] = FLOOR;
        }
        if (this.doors.E) {
            this.floor[midR - 1][rightCol] = FLOOR;
            this.floor[midR][rightCol] = FLOOR;
        }
    }

}
