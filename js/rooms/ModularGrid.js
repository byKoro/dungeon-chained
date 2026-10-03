/**
 * ModularGrid.js — Gerenciador do Grid Global e Validador de Encaixe de Salas.
 *
 * Controla o posicionamento de salas modulares em uma grade 2D [gx, gy],
 * funcionando como peças de quebra-cabeça com sockets (portas) nas bordas.
 *
 * Responsabilidades:
 * 1. Validação de Encaixe / Adjacência:
 *    - Verifica sobreposição (célula já ocupada).
 *    - Verifica compatibilidade exata de sockets em todas as bordas adjacentes:
 *      * Se a Sala A possui porta no Leste, a Sala B vizinha no Oeste DEVE possuir
 *        porta correspondente na EXATA mesma coordenada vertical e mesma largura.
 *      * Se um dos lados tem porta e o outro tem parede sólida -> REJEITADO.
 *      * Se ambos têm parede sólida -> VÁLIDO.
 * 2. Gestão do Grid Global:
 *    - Armazena instâncias de PlacedRoom por coordenadas [gx, gy].
 *    - Mantém conexões bidirecionais entre portas conectadas.
 *    - Rastreia sockets abertos (fronteiras de expansão) para o gerador ou editor.
 *    - Trata ou bloqueia beiradas sem saída (dead-ends).
 *    - Exporta para a estrutura esperada por Dungeon.js / RoomManager.js.
 */

import {
    DIRECTION,
    ALL_DIRECTIONS,
    OPPOSITE_DIRECTION,
    DIRECTION_DELTA,
    RoomSocket,
    RoomTemplate
} from './RoomSocket.js';
import { ROOM_COLS, ROOM_ROWS, GRID_COLS, GRID_ROWS, TILE } from '../config/GameConfig.js';

/**
 * PlacedRoom — Instância concreta de uma sala posicionada no grid global.
 */
export class PlacedRoom {
    /**
     * @param {object} opts
     * @param {RoomTemplate} opts.template  Template da sala
     * @param {number} opts.gx             Coordenada X no grid
     * @param {number} opts.gy             Coordenada Y no grid
     * @param {string} [opts.id]           ID único da instância
     */
    constructor({ template, gx, gy, id = null }) {
        this.template = template;
        this.gx = gx;
        this.gy = gy;
        this.id = id || `room_${gx}_${gy}_${template.id}`;
        this.key = `${gx},${gy}`;

        // Sockets ativos nesta instância (cópia dos sockets do template)
        this.sockets = template.sockets.map(s => s.clone());

        // Mapa de conexões: socketId -> { neighborKey, neighborGx, neighborGy, neighborSocketId }
        this.connections = new Map();
    }

    get kind() { return this.template.kind; }
    get type() { return this.template.type; }
    get cols() { return this.template.cols; }
    get rows() { return this.template.rows; }

    /**
     * Retorna o socket pelo ID.
     * @param {string} socketId
     * @returns {RoomSocket|null}
     */
    getSocket(socketId) {
        return this.sockets.find(s => s.id === socketId) || null;
    }

    /**
     * Retorna todos os sockets de uma borda (N, S, E, W).
     * @param {"N"|"S"|"E"|"W"} dir
     * @returns {RoomSocket[]}
     */
    getSockets(dir) {
        return this.sockets.filter(s => s.dir === dir);
    }

    /**
     * Conecta um socket a uma sala vizinha.
     * @param {string} socketId
     * @param {PlacedRoom} neighborRoom
     * @param {string} neighborSocketId
     */
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

    /**
     * Desconecta um socket.
     * @param {string} socketId
     */
    disconnectSocket(socketId) {
        const socket = this.getSocket(socketId);
        if (socket) socket.state = "open";
        this.connections.delete(socketId);
    }

    /**
     * Verifica se um socket específico está conectado.
     * @param {string} socketId
     * @returns {boolean}
     */
    isSocketConnected(socketId) {
        return this.connections.has(socketId);
    }

    /**
     * Retorna a lista de sockets que ainda estão abertos (sem conexão com vizinho).
     * @returns {RoomSocket[]}
     */
    getOpenSockets() {
        return this.sockets.filter(s => !this.isSocketConnected(s.id));
    }

    /**
     * Retorna a lista de sockets conectados.
     * @returns {Array<{ socket: RoomSocket, connection: object }>}
     */
    getConnectedSockets() {
        const list = [];
        for (const s of this.sockets) {
            const conn = this.connections.get(s.id);
            if (conn) list.push({ socket: s, connection: conn });
        }
        return list;
    }

    /**
     * Gera o objeto clássico { N, S, E, W } de portas abertas/conectadas.
     * Permite integração direta e retrocompatibilidade com RoomTiles.js e Dungeon.js.
     * @returns {{ N: boolean, S: boolean, E: boolean, W: boolean }}
     */
    getDoorsBoolean() {
        return {
            N: this.sockets.some(s => s.dir === "N" && this.isSocketConnected(s.id)),
            S: this.sockets.some(s => s.dir === "S" && this.isSocketConnected(s.id)),
            E: this.sockets.some(s => s.dir === "E" && this.isSocketConnected(s.id)),
            W: this.sockets.some(s => s.dir === "W" && this.isSocketConnected(s.id))
        };
    }

    /**
     * Serializa a sala posicionada.
     */
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

/**
 * ModularGrid — Gerenciador do Grid 2D de salas e Validador Central.
 */
export class ModularGrid {
    /**
     * @param {object} [opts={}]
     * @param {number} [opts.cols=GRID_COLS]         Limite de colunas (ou null para infinito/esparso)
     * @param {number} [opts.rows=GRID_ROWS]         Limite de linhas (ou null para infinito/esparso)
     * @param {number} [opts.cellTileCols=ROOM_COLS] Largura de cada célula em tiles (padrão 14)
     * @param {number} [opts.cellTileRows=ROOM_ROWS] Altura de cada célula em tiles (padrão 9)
     * @param {number} [opts.tile=TILE]              Tamanho de 1 tile no mundo em px (padrão 64)
     */
    constructor(opts = {}) {
        this.cols = opts.cols ?? GRID_COLS;
        this.rows = opts.rows ?? GRID_ROWS;
        this.cellTileCols = opts.cellTileCols ?? ROOM_COLS;
        this.cellTileRows = opts.cellTileRows ?? ROOM_ROWS;
        this.tile = opts.tile ?? TILE;

        // Mapa de células ocupadas: "gx,gy" -> PlacedRoom
        this.cells = new Map();
    }

    _key(gx, gy) {
        return `${gx},${gy}`;
    }

    /**
     * Retorna a sala posicionada em (gx, gy) ou null se vazia.
     * @param {number} gx
     * @param {number} gy
     * @returns {PlacedRoom|null}
     */
    getRoom(gx, gy) {
        return this.cells.get(this._key(gx, gy)) || null;
    }

    /**
     * Verifica se existe uma sala em (gx, gy).
     * @param {number} gx
     * @param {number} gy
     * @returns {boolean}
     */
    hasRoom(gx, gy) {
        return this.cells.has(this._key(gx, gy));
    }

    /**
     * Quantidade total de salas posicionadas no grid.
     */
    get roomCount() {
        return this.cells.size;
    }

    /**
     * Retorna a lista de todas as salas posicionadas.
     * @returns {PlacedRoom[]}
     */
    getAllRooms() {
        return Array.from(this.cells.values());
    }

    /**
     * Retorna os limites ocupados no grid (bounding box).
     * @returns {{ minGx: number, maxGx: number, minGy: number, maxGy: number, count: number }}
     */
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

    /**
     * Valida se uma sala candidata pode ser posicionada nas coordenadas (gx, gy).
     *
     * Regras Rígidas de Validação:
     * 1. Sobreposição: A célula (gx, gy) NÃO pode estar previamente ocupada.
     * 2. Limites do Grid: Se cols/rows forem definidos, (gx, gy) deve estar dentro da grade.
     * 3. Validação de Adjacência (Mandatório):
     *    Para cada vizinho ortogonal nas 4 direções (N, S, E, W):
     *    - Se a célula vizinha possui uma sala:
     *      * A borda em comum DEVE apresentar correspondência 1-para-1 exata:
     *        - Porta do candidato deve encontrar porta da sala vizinha na mesma coordenada
     *          (mesmo offset horizontal p/ N/S ou vertical p/ E/W) e com a mesma largura (span).
     *        - Se o candidato tem porta e o vizinho tem parede sólida -> REJEITADO (retorna inválido).
     *        - Se o vizinho tem porta e o candidato tem parede sólida -> REJEITADO (retorna inválido).
     *        - Se o offset ou span divergir entre as portas vizinhas -> REJEITADO (retorna inválido).
     *        - Se ambos têm parede sólida -> VÁLIDO (parede encosta em parede sem conflito).
     * 4. Conectividade:
     *    Se requireConnection for true e o grid já tiver salas, a nova sala deve se conectar
     *    a pelo menos uma porta de sala vizinha existente (evita ilhas isoladas).
     * 5. Sockets Abertos no Vazio:
     *    Se allowDanglingSockets for false, rejeita salas que possuam portas abrindo para células vazias.
     *
     * @param {RoomTemplate} template
     * @param {number} gx
     * @param {number} gy
     * @param {object} [options={}]
     * @param {boolean} [options.requireConnection=true]   Exige que conecte a ao menos um socket existente
     * @param {boolean} [options.allowDanglingSockets=true] Permite portas voltadas para o vazio (fronteira)
     * @returns {{
     *   valid: boolean,
     *   reason?: string,
     *   message?: string,
     *   connections?: Array<{ socket: RoomSocket, neighborSocket: RoomSocket, dir: string, neighborGx: number, neighborGy: number }>,
     *   danglingSockets?: Array<{ socket: RoomSocket, dir: string, targetGx: number, targetGy: number }>,
     *   neighborDetails?: object
     * }}
     */
    canPlace(template, gx, gy, options = {}) {
        const requireConnection = options.requireConnection ?? (this.cells.size > 0);
        const allowDanglingSockets = options.allowDanglingSockets ?? true;

        // 1. Verificação de Sobreposição
        if (this.hasRoom(gx, gy)) {
            return {
                valid: false,
                reason: "CELL_OCCUPIED",
                message: `Posicionamento rejeitado: a célula (${gx}, ${gy}) já está ocupada por outra sala.`,
                details: { gx, gy, occupiedBy: this.getRoom(gx, gy).id }
            };
        }

        // 2. Verificação de Limites do Grid (se configurados)
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

        // 3. Validação de Adjacência nas 4 Direções (N, S, E, W)
        for (const dir of ALL_DIRECTIONS) {
            const delta = DIRECTION_DELTA[dir];
            const oppDir = OPPOSITE_DIRECTION[dir];
            const nGx = gx + delta.dx;
            const nGy = gy + delta.dy;
            const neighbor = this.getRoom(nGx, nGy);

            const candSockets = template.getSockets(dir);

            if (!neighbor) {
                // Vizinho vazio: portas do candidato para esta direção são portas de fronteira
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

            // Vizinho existente: validação rígida de encaixe
            const neighSockets = neighbor.getSockets(oppDir);

            neighborDetails[dir] = {
                exists: true,
                neighborId: neighbor.id,
                neighborGx: nGx,
                neighborGy: nGy,
                candSocketsCount: candSockets.length,
                neighSocketsCount: neighSockets.length
            };

            // Caso A: Candidato tem porta, mas o vizinho tem parede sólida
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

            // Caso B: Vizinho tem porta aberta, mas o candidato tem parede sólida
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

            // Caso C: Ambos têm portas — verificar quantidade e alinhamento exato de coordenadas
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

            // Verifica se cada porta do candidato se alinha perfeitamente com uma porta do vizinho
            const matchedNeighSockets = new Set();

            for (const candSocket of candSockets) {
                // Procura um socket correspondente exato
                const matchingNeighSocket = neighSockets.find(ns =>
                    !matchedNeighSockets.has(ns.id) && candSocket.matches(ns)
                );

                if (!matchingNeighSocket) {
                    // Descobre o motivo específico para uma mensagem de erro precisa
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

        // 4. Verificação de Conectividade com a Rede de Salas
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

    /**
     * Posiciona uma sala no grid caso a validação seja bem-sucedida.
     * Atualiza as conexões bidirecionais de sockets entre as salas.
     *
     * @param {RoomTemplate} template
     * @param {number} gx
     * @param {number} gy
     * @param {object} [options={}]
     * @param {boolean} [options.throwOnError=false]
     * @returns {{ success: boolean, room?: PlacedRoom, error?: string, validation?: object }}
     */
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

        // Estabelece as conexões mútuas entre os sockets
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

    /**
     * Remove uma sala do grid e desconecta os sockets das salas vizinhas.
     * @param {number} gx
     * @param {number} gy
     * @returns {PlacedRoom|null} A sala removida ou null se não existia
     */
    removeRoom(gx, gy) {
        const key = this._key(gx, gy);
        const room = this.cells.get(key);
        if (!room) return null;

        // Desconecta vizinhos
        for (const [socketId, conn] of room.connections.entries()) {
            const neighbor = this.getRoom(conn.neighborGx, conn.neighborGy);
            if (neighbor) {
                neighbor.disconnectSocket(conn.neighborSocketId);
            }
        }

        this.cells.delete(key);
        return room;
    }

    /**
     * Retorna todos os sockets abertos do grid (fronteiras de expansão).
     * Útil para o gerador procedural ou cursor do editor saber para onde a dungeon pode crescer.
     * @returns {Array<{ gx: number, gy: number, dir: string, socket: RoomSocket, targetGx: number, targetGy: number }>}
     */
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

    /**
     * Retorna a lista de coordenadas [gx, gy] vazias que possuem ao menos
     * um conector aberto apontando para elas (a "fronteira" do mapa).
     * @returns {Array<{ gx: number, gy: number, incomingSocketsCount: number }>}
     */
    getFrontierCells() {
        const counts = new Map();

        for (const open of this.getOpenSockets()) {
            const key = this._key(open.targetGx, open.targetGy);
            // Ignora se estiver fora dos limites globais
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

    /**
     * Encontra todas as posições válidas no grid onde um template específico pode ser encaixado.
     * @param {RoomTemplate} template
     * @param {object} [options={}]
     * @returns {Array<{ gx: number, gy: number, validation: object }>}
     */
    findValidPlacements(template, options = {}) {
        const validSpots = [];
        const frontier = this.getFrontierCells();

        // Se o grid estiver vazio, testa o centro ou posição inicial (0, 0)
        if (this.cells.size === 0) {
            const initialGx = this.cols !== null ? ((this.cols / 2) | 0) : 0;
            const initialGy = this.rows !== null ? ((this.rows / 2) | 0) : 0;
            const res = this.canPlace(template, initialGx, initialGy, options);
            if (res.valid) {
                validSpots.push({ gx: initialGx, gy: initialGy, validation: res });
            }
            return validSpots;
        }

        // Testa cada célula de fronteira
        for (const cell of frontier) {
            const res = this.canPlace(template, cell.gx, cell.gy, options);
            if (res.valid) {
                validSpots.push({ gx: cell.gx, gy: cell.gy, validation: res });
            }
        }

        return validSpots;
    }

    /**
     * Identifica beiradas sem saída (dead-ends): sockets que apontam para fora do grid
     * ou para células que não podem ser ocupadas.
     * @returns {Array<{ gx: number, gy: number, dir: string, socket: RoomSocket }>}
     */
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

    /**
     * Trata/bloqueia beiradas sem saída, fechando o estado dos sockets desconectados
     * ou convertendo-os em paredes sólidas para que não fiquem buracos abertos para o vazio.
     * @param {"blocked"|"locked"|"sealed"} [action="sealed"]
     * @returns {number} Quantidade de sockets tratados
     */
    sealDeadEnds(action = "sealed") {
        let count = 0;
        for (const open of this.getOpenSockets()) {
            open.socket.state = action;
            open.socket.tags.push("sealed_deadend");
            count++;
        }
        return count;
    }

    /**
     * Valida a integridade completa do grid construído:
     * - Verifica se todas as conexões são recíprocas e válidas.
     * - Rastreia se existem salas desconectadas da sala inicial (usando flood fill BFS).
     * - Lista sockets pendentes/dangling.
     *
     * @param {object} [opts={}]
     * @param {string} [opts.startKey] Chave da sala inicial (ex: "gx,gy")
     * @returns {{
     *   isValid: boolean,
     *   totalRooms: number,
     *   connectedRoomsCount: number,
     *   unreachableRooms: PlacedRoom[],
     *   danglingSocketsCount: number,
     *   errors: string[]
     * }}
     */
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

        // 1. Verificação de reciprocidade das conexões
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

        // 2. Verificação de acessibilidade (Flood fill BFS)
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

    /**
     * Exporta o grid modular diretamente para o formato consumido pela engine
     * (Dungeon.js, RoomTiles.js e RoomManager.js).
     *
     * Estrutura compatível com DungeonGraph:
     * {
     *   cols: number,
     *   rows: number,
     *   cells: Map<"x,y", { gx, gy, kind, type, doors: { N, S, E, W } }>,
     *   rooms: [{ gx, gy, type }],
     *   start: { gx, gy }
     * }
     *
     * @returns {object}
     */
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

    /**
     * Serializa todo o grid para JSON.
     * @returns {object}
     */
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

    /**
     * Restaura um grid modular a partir de dados JSON.
     * @param {object|string} json
     * @param {Map<string, RoomTemplate>} [templateCatalog] Catálogo de templates (opcional)
     * @returns {ModularGrid}
     */
    static fromJSON(json, templateCatalog = new Map()) {
        const data = typeof json === "string" ? JSON.parse(json) : json;
        const grid = new ModularGrid({
            cols: data.cols,
            rows: data.rows,
            cellTileCols: data.cellTileCols,
            cellTileRows: data.cellTileRows,
            tile: data.tile
        });

        // 1. Instancia as salas
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

        // 2. Reconstrói as conexões de sockets
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
