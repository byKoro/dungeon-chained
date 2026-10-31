import {
    ALL_DIRECTIONS,
    OPPOSITE_DIRECTION,
    DIRECTION_DELTA,
    RoomTemplate
} from './RoomSocket.js';
import { ROOM_COLS, ROOM_ROWS, GRID_COLS, GRID_ROWS, TILE } from '../config/GameConfig.js';

export class PlacedRoom {

    constructor({ template, gx, gy, id = null }) {
        this.template = template;
        this.gx = gx;
        this.gy = gy;
        this.id = id || `room_${gx}_${gy}_${template.id}`;
        this.key = `${gx},${gy}`;

        this.sockets = template.sockets.map(s => s.clone());

        this.connections = new Map();
    }

    get kind() { return this.template.kind; }
    get type() { return this.template.type; }
    get cols() { return this.template.cols; }
    get rows() { return this.template.rows; }

    getSocket(socketId) {
        return this.sockets.find(s => s.id === socketId) || null;
    }

    getSockets(dir) {
        return this.sockets.filter(s => s.dir === dir);
    }

    connectSocket(socketId, neighborRoom, neighborSocketId) {
        const socket = this.getSocket(socketId);
        if (!socket) return false;

        this.connections.set(socketId, {
            neighborKey: neighborRoom.key,
            neighborGx: neighborRoom.gx,
            neighborGy: neighborRoom.gy,
            neighborSocketId
        });
        socket.state = "connected";
        return true;
    }

    disconnectSocket(socketId) {
        const socket = this.getSocket(socketId);
        if (socket) socket.state = "open";
        this.connections.delete(socketId);
    }

    isSocketConnected(socketId) {
        return this.connections.has(socketId);
    }

    getOpenSockets() {
        return this.sockets.filter(s => !this.isSocketConnected(s.id));
    }

    getConnectedSockets() {
        const list = [];
        for (const s of this.sockets) {
            const conn = this.connections.get(s.id);
            if (conn) list.push({ socket: s, connection: conn });
        }
        return list;
    }

    getDoorsBoolean() {
        return {
            N: this.sockets.some(s => s.dir === "N" && this.isSocketConnected(s.id)),
            S: this.sockets.some(s => s.dir === "S" && this.isSocketConnected(s.id)),
            E: this.sockets.some(s => s.dir === "E" && this.isSocketConnected(s.id)),
            W: this.sockets.some(s => s.dir === "W" && this.isSocketConnected(s.id))
        };
    }

    toJSON() {
        const connectionsObj = {};
        for (const [k, v] of this.connections.entries()) {
            connectionsObj[k] = v;
        }

        return {
            id: this.id,
            gx: this.gx,
            gy: this.gy,
            templateId: this.template.id,
            template: this.template.toJSON(),
            connections: connectionsObj
        };
    }
}

export class ModularGrid {

    constructor(opts = {}) {
        this.cols = opts.cols ?? GRID_COLS;
        this.rows = opts.rows ?? GRID_ROWS;
        this.cellTileCols = opts.cellTileCols ?? ROOM_COLS;
        this.cellTileRows = opts.cellTileRows ?? ROOM_ROWS;
        this.tile = opts.tile ?? TILE;

        this.cells = new Map();
    }

    _key(gx, gy) {
        return `${gx},${gy}`;
    }

    getRoom(gx, gy) {
        return this.cells.get(this._key(gx, gy)) || null;
    }

    hasRoom(gx, gy) {
        return this.cells.has(this._key(gx, gy));
    }

    get roomCount() {
        return this.cells.size;
    }

    getAllRooms() {
        return Array.from(this.cells.values());
    }

    getOccupiedBounds() {
        if (this.cells.size === 0) {
            return { minGx: 0, maxGx: 0, minGy: 0, maxGy: 0, count: 0 };
        }
        let minGx = Infinity, maxGx = -Infinity, minGy = Infinity, maxGy = -Infinity;
        for (const room of this.cells.values()) {
            if (room.gx < minGx) minGx = room.gx;
            if (room.gx > maxGx) maxGx = room.gx;
            if (room.gy < minGy) minGy = room.gy;
            if (room.gy > maxGy) maxGy = room.gy;
        }
        return { minGx, maxGx, minGy, maxGy, count: this.cells.size };
    }

    canPlace(template, gx, gy, options = {}) {
        const requireConnection = options.requireConnection ?? (this.cells.size > 0);
        const allowDanglingSockets = options.allowDanglingSockets ?? true;

        if (this.hasRoom(gx, gy)) {
            return {
                valid: false,
                reason: "CELL_OCCUPIED",
                message: `Posicionamento rejeitado: a célula (${gx}, ${gy}) já está ocupada por outra sala.`,
                details: { gx, gy, occupiedBy: this.getRoom(gx, gy).id }
            };
        }

        if (this.cols !== null && (gx < 0 || gx >= this.cols)) {
            return {
                valid: false,
                reason: "OUT_OF_BOUNDS_X",
                message: `Posicionamento rejeitado: coluna ${gx} fora dos limites do grid (0 a ${this.cols - 1}).`,
                details: { gx, gy, maxCols: this.cols }
            };
        }
        if (this.rows !== null && (gy < 0 || gy >= this.rows)) {
            return {
                valid: false,
                reason: "OUT_OF_BOUNDS_Y",
                message: `Posicionamento rejeitado: linha ${gy} fora dos limites do grid (0 a ${this.rows - 1}).`,
                details: { gx, gy, maxRows: this.rows }
            };
        }

        const connections = [];
        const danglingSockets = [];
        const neighborDetails = {};

        for (const dir of ALL_DIRECTIONS) {
            const delta = DIRECTION_DELTA[dir];
            const oppDir = OPPOSITE_DIRECTION[dir];
            const nGx = gx + delta.dx;
            const nGy = gy + delta.dy;
            const neighbor = this.getRoom(nGx, nGy);

            const candSockets = template.getSockets(dir);

            if (!neighbor) {

                for (const s of candSockets) {
                    danglingSockets.push({
                        socket: s,
                        dir,
                        targetGx: nGx,
                        targetGy: nGy
                    });
                }

                if (!allowDanglingSockets && candSockets.length > 0) {
                    return {
                        valid: false,
                        reason: "DANGLING_SOCKET_FORBIDDEN",
                        message: `Posicionamento rejeitado: a borda ${dir} possui ${candSockets.length} porta(s) abrindo para célula vazia em (${nGx}, ${nGy}).`,
                        details: { dir, targetGx: nGx, targetGy: nGy, sockets: candSockets }
                    };
                }

                neighborDetails[dir] = { exists: false, targetGx: nGx, targetGy: nGy };
                continue;
            }

            const neighSockets = neighbor.getSockets(oppDir);

            neighborDetails[dir] = {
                exists: true,
                neighborId: neighbor.id,
                neighborGx: nGx,
                neighborGy: nGy,
                candSocketsCount: candSockets.length,
                neighSocketsCount: neighSockets.length
            };

            if (candSockets.length > 0 && neighSockets.length === 0) {
                return {
                    valid: false,
                    reason: "DOOR_TO_WALL_MISMATCH",
                    message: `Posicionamento rejeitado: a borda ${dir} da nova sala possui porta aberta, mas a sala vizinha em (${nGx}, ${nGy}) tem parede sólida na borda ${oppDir}.`,
                    details: {
                        dir,
                        oppDir,
                        neighborGx: nGx,
                        neighborGy: nGy,
                        candidateSockets: candSockets.map(s => s.toJSON()),
                        neighborSockets: []
                    }
                };
            }

            if (candSockets.length === 0 && neighSockets.length > 0) {
                return {
                    valid: false,
                    reason: "WALL_TO_DOOR_MISMATCH",
                    message: `Posicionamento rejeitado: a sala vizinha em (${nGx}, ${nGy}) possui porta aberta na borda ${oppDir}, mas a nova sala possui parede sólida na borda ${dir}.`,
                    details: {
                        dir,
                        oppDir,
                        neighborGx: nGx,
                        neighborGy: nGy,
                        candidateSockets: [],
                        neighborSockets: neighSockets.map(s => s.toJSON())
                    }
                };
            }

            if (candSockets.length !== neighSockets.length) {
                return {
                    valid: false,
                    reason: "SOCKET_COUNT_MISMATCH",
                    message: `Posicionamento rejeitado: divergência na quantidade de portas na divisa ${dir}/${oppDir} (${candSockets.length} na nova sala vs ${neighSockets.length} no vizinho em (${nGx}, ${nGy})).`,
                    details: {
                        dir,
                        oppDir,
                        neighborGx: nGx,
                        neighborGy: nGy,
                        candidateSockets: candSockets.map(s => s.toJSON()),
                        neighborSockets: neighSockets.map(s => s.toJSON())
                    }
                };
            }

            const matchedNeighSockets = new Set();

            for (const candSocket of candSockets) {

                const matchingNeighSocket = neighSockets.find(ns =>
                    !matchedNeighSockets.has(ns.id) && candSocket.matches(ns)
                );

                if (!matchingNeighSocket) {

                    const coordName = (dir === "E" || dir === "W") ? "vertical (linha)" : "horizontal (coluna)";
                    const nearbySocket = neighSockets.find(ns => !matchedNeighSockets.has(ns.id));

                    let errorMsg = `Posicionamento rejeitado: a porta na borda ${dir} (offset ${candSocket.offset}, span ${candSocket.span}) ` +
                                   `não encontra correspondência na borda ${oppDir} da sala vizinha em (${nGx}, ${nGy}).`;

                    if (nearbySocket) {
                        errorMsg += ` Vizinho possui porta na coordenada ${coordName} ${nearbySocket.offset} (span ${nearbySocket.span}), resultando em desalinhamento.`;
                    }

                    return {
                        valid: false,
                        reason: "SOCKET_ALIGNMENT_MISMATCH",
                        message: errorMsg,
                        details: {
                            dir,
                            oppDir,
                            neighborGx: nGx,
                            neighborGy: nGy,
                            candidateSocket: candSocket.toJSON(),
                            unmatchedNeighborSockets: neighSockets.filter(ns => !matchedNeighSockets.has(ns.id)).map(s => s.toJSON())
                        }
                    };
                }

                matchedNeighSockets.add(matchingNeighSocket.id);
                connections.push({
                    socket: candSocket,
                    neighborSocket: matchingNeighSocket,
                    dir,
                    neighborGx: nGx,
                    neighborGy: nGy
                });
            }
        }

        if (requireConnection && this.cells.size > 0 && connections.length === 0) {
            return {
                valid: false,
                reason: "NO_CONNECTION_TO_GRID",
                message: `Posicionamento rejeitado: a sala em (${gx}, ${gy}) faz fronteira apenas com paredes sólidas e não possui conexão com nenhuma porta existente.`,
                details: { gx, gy, neighborDetails }
            };
        }

        return {
            valid: true,
            connections,
            danglingSockets,
            neighborDetails
        };
    }

    placeRoom(template, gx, gy, options = {}) {
        const validation = this.canPlace(template, gx, gy, options);

        if (!validation.valid) {
            if (options.throwOnError) {
                throw new Error(validation.message);
            }
            return {
                success: false,
                error: validation.message,
                validation
            };
        }

        const room = new PlacedRoom({ template, gx, gy });
        this.cells.set(this._key(gx, gy), room);

        for (const conn of validation.connections) {
            const neighbor = this.getRoom(conn.neighborGx, conn.neighborGy);
            if (neighbor) {
                room.connectSocket(conn.socket.id, neighbor, conn.neighborSocket.id);
                neighbor.connectSocket(conn.neighborSocket.id, room, conn.socket.id);
            }
        }

        return {
            success: true,
            room,
            validation
        };
    }

    removeRoom(gx, gy) {
        const key = this._key(gx, gy);
        const room = this.cells.get(key);
        if (!room) return null;

        for (const [socketId, conn] of room.connections.entries()) {
            const neighbor = this.getRoom(conn.neighborGx, conn.neighborGy);
            if (neighbor) {
                neighbor.disconnectSocket(conn.neighborSocketId);
            }
        }

        this.cells.delete(key);
        return room;
    }

    getOpenSockets() {
        const openList = [];
        for (const room of this.cells.values()) {
            for (const socket of room.getOpenSockets()) {
                const delta = DIRECTION_DELTA[socket.dir];
                const targetGx = room.gx + delta.dx;
                const targetGy = room.gy + delta.dy;

                openList.push({
                    gx: room.gx,
                    gy: room.gy,
                    dir: socket.dir,
                    socket,
                    targetGx,
                    targetGy
                });
            }
        }
        return openList;
    }

    getFrontierCells() {
        const counts = new Map();

        for (const open of this.getOpenSockets()) {
            const key = this._key(open.targetGx, open.targetGy);

            if (this.cols !== null && (open.targetGx < 0 || open.targetGx >= this.cols)) continue;
            if (this.rows !== null && (open.targetGy < 0 || open.targetGy >= this.rows)) continue;

            if (!this.hasRoom(open.targetGx, open.targetGy)) {
                if (!counts.has(key)) {
                    counts.set(key, { gx: open.targetGx, gy: open.targetGy, incomingSocketsCount: 0 });
                }
                counts.get(key).incomingSocketsCount++;
            }
        }

        return Array.from(counts.values());
    }

    findValidPlacements(template, options = {}) {
        const validSpots = [];
        const frontier = this.getFrontierCells();

        if (this.cells.size === 0) {
            const initialGx = this.cols !== null ? ((this.cols / 2) | 0) : 0;
            const initialGy = this.rows !== null ? ((this.rows / 2) | 0) : 0;
            const res = this.canPlace(template, initialGx, initialGy, options);
            if (res.valid) {
                validSpots.push({ gx: initialGx, gy: initialGy, validation: res });
            }
            return validSpots;
        }

        for (const cell of frontier) {
            const res = this.canPlace(template, cell.gx, cell.gy, options);
            if (res.valid) {
                validSpots.push({ gx: cell.gx, gy: cell.gy, validation: res });
            }
        }

        return validSpots;
    }

    getDeadEnds() {
        const deadEnds = [];
        for (const open of this.getOpenSockets()) {
            const isOutOfBounds = (this.cols !== null && (open.targetGx < 0 || open.targetGx >= this.cols)) ||
                                  (this.rows !== null && (open.targetGy < 0 || open.targetGy >= this.rows));
            if (isOutOfBounds) {
                deadEnds.push({
                    gx: open.gx,
                    gy: open.gy,
                    dir: open.dir,
                    socket: open.socket
                });
            }
        }
        return deadEnds;
    }

    sealDeadEnds(action = "sealed") {
        let count = 0;
        for (const open of this.getOpenSockets()) {
            open.socket.state = action;
            open.socket.tags.push("sealed_deadend");
            count++;
        }
        return count;
    }

    validateIntegrity(opts = {}) {
        const errors = [];
        if (this.cells.size === 0) {
            return {
                isValid: true,
                totalRooms: 0,
                connectedRoomsCount: 0,
                unreachableRooms: [],
                danglingSocketsCount: 0,
                errors: []
            };
        }

        for (const room of this.cells.values()) {
            for (const [socketId, conn] of room.connections.entries()) {
                const neighbor = this.getRoom(conn.neighborGx, conn.neighborGy);
                if (!neighbor) {
                    errors.push(`Sala ${room.key} aponta para vizinho inexistente em (${conn.neighborGx}, ${conn.neighborGy}).`);
                    continue;
                }
                const neighConn = neighbor.connections.get(conn.neighborSocketId);
                if (!neighConn || neighConn.neighborKey !== room.key) {
                    errors.push(`Conexão assimétrica entre sala ${room.key} (socket ${socketId}) e vizinho ${neighbor.key}.`);
                }
            }
        }

        const allRooms = Array.from(this.cells.values());
        const startRoom = opts.startKey ? this.cells.get(opts.startKey) : (allRooms.find(r => r.type === "start") || allRooms[0]);

        const visited = new Set();
        const queue = [startRoom];
        visited.add(startRoom.key);

        while (queue.length > 0) {
            const curr = queue.shift();
            for (const conn of curr.connections.values()) {
                if (!visited.has(conn.neighborKey)) {
                    visited.add(conn.neighborKey);
                    const neigh = this.cells.get(conn.neighborKey);
                    if (neigh) queue.push(neigh);
                }
            }
        }

        const unreachableRooms = allRooms.filter(r => !visited.has(r.key));
        if (unreachableRooms.length > 0) {
            errors.push(`${unreachableRooms.length} sala(s) isolada(s) / inalcançáveis a partir da sala inicial.`);
        }

        const dangling = this.getOpenSockets();

        return {
            isValid: errors.length === 0,
            totalRooms: this.cells.size,
            connectedRoomsCount: visited.size,
            unreachableRooms,
            danglingSocketsCount: dangling.length,
            errors
        };
    }

    toDungeonGraphData() {
        const bounds = this.getOccupiedBounds();
        const cols = this.cols ?? (bounds.maxGx + 1);
        const rows = this.rows ?? (bounds.maxGy + 1);

        const cells = new Map();
        const roomsList = [];
        let startPos = null;

        for (const room of this.cells.values()) {
            const doors = room.getDoorsBoolean();

            const cellData = {
                gx: room.gx,
                gy: room.gy,
                kind: room.kind,
                type: room.type,
                doors,
                templateId: room.template.id,
                metadata: room.template.metadata
            };

            cells.set(room.key, cellData);

            if (room.kind === "room") {
                roomsList.push({ gx: room.gx, gy: room.gy, type: room.type });
            }

            if (room.type === "start" || !startPos) {
                startPos = { gx: room.gx, gy: room.gy };
            }
        }

        return {
            cols,
            rows,
            cells,
            rooms: roomsList,
            start: startPos || { gx: 0, gy: 0 }
        };
    }

    toJSON() {
        const roomsData = [];
        for (const r of this.cells.values()) {
            roomsData.push(r.toJSON());
        }
        return {
            cols: this.cols,
            rows: this.rows,
            cellTileCols: this.cellTileCols,
            cellTileRows: this.cellTileRows,
            tile: this.tile,
            rooms: roomsData
        };
    }

    static fromJSON(json, templateCatalog = new Map()) {
        const data = typeof json === "string" ? JSON.parse(json) : json;
        const grid = new ModularGrid({
            cols: data.cols,
            rows: data.rows,
            cellTileCols: data.cellTileCols,
            cellTileRows: data.cellTileRows,
            tile: data.tile
        });

        for (const rData of data.rooms) {
            let template = templateCatalog.get(rData.templateId);
            if (!template && rData.template) {
                template = RoomTemplate.fromJSON(rData.template);
            }
            if (!template) {
                template = new RoomTemplate({ id: rData.templateId });
            }
            const room = new PlacedRoom({
                template,
                gx: rData.gx,
                gy: rData.gy,
                id: rData.id
            });
            grid.cells.set(room.key, room);
        }

        for (const rData of data.rooms) {
            const room = grid.getRoom(rData.gx, rData.gy);
            if (room && rData.connections) {
                for (const [socketId, conn] of Object.entries(rData.connections)) {
                    const neighbor = grid.getRoom(conn.neighborGx, conn.neighborGy);
                    if (neighbor) {
                        room.connectSocket(socketId, neighbor, conn.neighborSocketId);
                    }
                }
            }
        }

        return grid;
    }
}
