export const DIRECTION = Object.freeze({
    NORTH: "N",
    SOUTH: "S",
    EAST: "E",
    WEST: "W"
});

export const ALL_DIRECTIONS = Object.freeze(["N", "S", "E", "W"]);

export const OPPOSITE_DIRECTION = Object.freeze({
    N: "S",
    S: "N",
    E: "W",
    W: "E"
});

export const DIRECTION_DELTA = Object.freeze({
    N: Object.freeze({ dx: 0, dy: -1 }),
    S: Object.freeze({ dx: 0, dy: 1 }),
    E: Object.freeze({ dx: 1, dy: 0 }),
    W: Object.freeze({ dx: -1, dy: 0 })
});

export class RoomSocket {

    constructor({
        id = null,
        dir,
        offset,
        span = 2,
        type = "standard",
        state = "open",
        tags = []
    }) {
        if (!ALL_DIRECTIONS.includes(dir)) {
            throw new Error(`Direção inválida para RoomSocket: "${dir}". Esperado: N, S, E ou W.`);
        }
        if (typeof offset !== "number" || isNaN(offset) || offset < 0) {
            throw new Error(`Offset inválido para RoomSocket: ${offset}. Deve ser um número >= 0.`);
        }
        if (typeof span !== "number" || isNaN(span) || span < 1) {
            throw new Error(`Span inválido para RoomSocket: ${span}. Deve ser um número >= 1.`);
        }

        this.dir = dir;
        this.offset = Math.floor(offset);
        this.span = Math.floor(span);
        this.type = type;
        this.state = state;
        this.tags = Array.isArray(tags) ? [...tags] : [];
        this.id = id || `${this.dir}_${this.offset}_span${this.span}`;
    }

    get range() {
        return [this.offset, this.offset + this.span - 1];
    }

    containsCoord(pos) {
        return pos >= this.offset && pos < this.offset + this.span;
    }

    matches(other) {
        if (!other || !(other instanceof RoomSocket)) return false;
        if (other.dir !== OPPOSITE_DIRECTION[this.dir]) return false;
        if (other.offset !== this.offset) return false;
        if (other.span !== this.span) return false;
        if (other.type !== this.type) return false;
        return true;
    }

    clone() {
        return new RoomSocket({
            id: this.id,
            dir: this.dir,
            offset: this.offset,
            span: this.span,
            type: this.type,
            state: this.state,
            tags: [...this.tags]
        });
    }

    toJSON() {
        return {
            id: this.id,
            dir: this.dir,
            offset: this.offset,
            span: this.span,
            type: this.type,
            state: this.state,
            tags: [...this.tags]
        };
    }

    static fromJSON(data) {
        return new RoomSocket(data);
    }
}

export class RoomTemplate {

    constructor({
        id,
        name = "",
        cols = 14,
        rows = 9,
        sockets = [],
        kind = "room",
        type = "normal",
        metadata = {}
    }) {
        if (!id) {
            throw new Error("RoomTemplate requer um identificador 'id' não-vazio.");
        }
        this.id = id;
        this.name = name || id;
        this.cols = Number(cols) || 14;
        this.rows = Number(rows) || 9;
        this.kind = kind;
        this.type = type;
        this.metadata = { ...metadata };

        this.sockets = [];
        for (const s of sockets) {
            const socket = s instanceof RoomSocket ? s : new RoomSocket(s);
            this._validateSocketBounds(socket);
            this.sockets.push(socket);
        }
    }

    _validateSocketBounds(socket) {
        const edgeLength = (socket.dir === "N" || socket.dir === "S") ? this.cols : this.rows;
        if (socket.offset + socket.span > edgeLength) {
            throw new Error(
                `Socket "${socket.id}" na borda ${socket.dir} ultrapassa o tamanho da sala: ` +
                `offset ${socket.offset} + span ${socket.span} > ${edgeLength} tiles.`
            );
        }
    }

    getSockets(dir) {
        return this.sockets.filter(s => s.dir === dir);
    }

    findSocket(dir, offset, span = 2) {
        return this.sockets.find(s => s.dir === dir && s.offset === offset && s.span === span) || null;
    }

    getDoorsBoolean() {
        return {
            N: this.sockets.some(s => s.dir === "N"),
            S: this.sockets.some(s => s.dir === "S"),
            E: this.sockets.some(s => s.dir === "E"),
            W: this.sockets.some(s => s.dir === "W")
        };
    }

    rotate(quarterTurns = 1) {
        const turns = ((quarterTurns % 4) + 4) % 4;
        if (turns === 0) return this.clone();

        let currentCols = this.cols;
        let currentRows = this.rows;
        let rotatedSockets = this.sockets.map(s => s.clone());

        for (let t = 0; t < turns; t++) {
            const nextCols = currentRows;
            const nextRows = currentCols;
            const nextSockets = [];

            for (const s of rotatedSockets) {
                let nextDir;
                let nextOffset;

                if (s.dir === "N") {
                    nextDir = "E";
                    nextOffset = s.offset;
                } else if (s.dir === "E") {
                    nextDir = "S";
                    nextOffset = nextCols - (s.offset + s.span);
                } else if (s.dir === "S") {
                    nextDir = "W";
                    nextOffset = nextRows - (s.offset + s.span);
                } else if (s.dir === "W") {
                    nextDir = "N";
                    nextOffset = s.offset;
                }

                nextSockets.push(new RoomSocket({
                    id: `${s.id}_rot`,
                    dir: nextDir,
                    offset: nextOffset,
                    span: s.span,
                    type: s.type,
                    state: s.state,
                    tags: [...s.tags]
                }));
            }

            currentCols = nextCols;
            currentRows = nextRows;
            rotatedSockets = nextSockets;
        }

        return new RoomTemplate({
            id: `${this.id}_rot${turns * 90}`,
            name: `${this.name} (${turns * 90}°)`,
            cols: currentCols,
            rows: currentRows,
            sockets: rotatedSockets,
            kind: this.kind,
            type: this.type,
            metadata: { ...this.metadata, rotationAngle: turns * 90 }
        });
    }

    clone() {
        return new RoomTemplate({
            id: this.id,
            name: this.name,
            cols: this.cols,
            rows: this.rows,
            sockets: this.sockets.map(s => s.clone()),
            kind: this.kind,
            type: this.type,
            metadata: { ...this.metadata }
        });
    }

    static createStandard({
        id,
        name = "",
        cols = 14,
        rows = 9,
        doors = {},
        kind = "room",
        type = "normal",
        metadata = {}
    }) {
        const midC = (cols / 2) | 0;
        const midR = (rows / 2) | 0;
        const sockets = [];

        if (doors.N) {
            sockets.push(new RoomSocket({
                id: `${id}_door_N`,
                dir: "N",
                offset: midC - 1,
                span: 2
            }));
        }
        if (doors.S) {
            sockets.push(new RoomSocket({
                id: `${id}_door_S`,
                dir: "S",
                offset: midC - 1,
                span: 2
            }));
        }
        if (doors.E) {
            sockets.push(new RoomSocket({
                id: `${id}_door_E`,
                dir: "E",
                offset: midR - 1,
                span: 2
            }));
        }
        if (doors.W) {
            sockets.push(new RoomSocket({
                id: `${id}_door_W`,
                dir: "W",
                offset: midR - 1,
                span: 2
            }));
        }

        return new RoomTemplate({
            id,
            name: name || id,
            cols,
            rows,
            sockets,
            kind,
            type,
            metadata
        });
    }

    static fromJSON(json) {
        const data = typeof json === "string" ? JSON.parse(json) : json;

        if (Array.isArray(data.sockets)) {
            return new RoomTemplate({
                id: data.id || "unnamed_room",
                name: data.name,
                cols: data.cols ?? data.w ?? 14,
                rows: data.rows ?? data.h ?? 9,
                sockets: data.sockets.map(s => RoomSocket.fromJSON(s)),
                kind: data.kind ?? "room",
                type: data.type ?? "normal",
                metadata: data.metadata ?? {}
            });
        }

        if (data.doors && typeof data.doors === "object") {
            return RoomTemplate.createStandard({
                id: data.id || "unnamed_room",
                name: data.name,
                cols: data.cols ?? data.w ?? 14,
                rows: data.rows ?? data.h ?? 9,
                doors: data.doors,
                kind: data.kind ?? "room",
                type: data.type ?? "normal",
                metadata: data.metadata ?? {}
            });
        }

        return new RoomTemplate({
            id: data.id || "unnamed_room",
            name: data.name,
            cols: data.cols ?? data.w ?? 14,
            rows: data.rows ?? data.h ?? 9,
            sockets: [],
            kind: data.kind ?? "room",
            type: data.type ?? "normal",
            metadata: data.metadata ?? {}
        });
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            cols: this.cols,
            rows: this.rows,
            kind: this.kind,
            type: this.type,
            sockets: this.sockets.map(s => s.toJSON()),
            doors: this.getDoorsBoolean(),
            metadata: this.metadata
        };
    }
}
