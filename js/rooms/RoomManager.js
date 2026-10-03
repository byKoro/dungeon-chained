import { Dungeon } from '../core/Dungeon.js';
import { Room } from './Room.js';
import {
    TILE, ROOM_COLS, ROOM_ROWS, GRID_COLS, GRID_ROWS, ROOM_COUNT,
    DOOR_ENTER_DEPTH
} from '../config/GameConfig.js';

/**
 * RoomManager — API única para gerenciar a criação e o ciclo de vida das salas.
 *
 * Consolida o que antes estava espalhado:
 *   - geração/cache de layout de tiles (ex-`getRoomTiles` do main.js);
 *   - população de inimigos (ex-`enterRoom` do main.js);
 *   - estado "limpa/trancada" (ex-`roomStates` do main + `cleared`/`visited`
 *     do Dungeon);
 *   - geometria de portas e confinamento do jogador aos vãos.
 *
 * Fachada principal:
 *   rooms.reset()                  -> gera uma nova dungeon
 *   rooms.enter(key?)              -> prepara/popula a sala (lazy, cacheada)
 *   rooms.current                  -> a Room ativa
 *   rooms.isLocked()               -> portas trancadas?
 *   rooms.tryClearCurrent()        -> marca limpa quando sem inimigos
 *   rooms.doorsOfCurrent()         -> vãos de porta no mundo
 *   rooms.transitionTo(door)       -> move para a sala vizinha
 *   rooms.clampEnemy / clampPlayer -> confinamento físico
 */
export class RoomManager {
    /**
     * @param {object} opts
     * @param {SpawnSystem} opts.spawnSystem
     * @param {() => number} opts.getFloor  retorna o andar atual
     */
    constructor({ spawnSystem, getFloor }) {
        this.spawnSystem = spawnSystem;
        this.getFloor = getFloor;
        this.rooms = new Map();   // key "gx,gy" -> Room
        this.dungeon = null;
        this.reset();
    }

    // Gera uma nova dungeon do zero ou carrega a sala do editor se estiver em modo playtest.
    reset() {
        let customGraph = null;
        if (typeof window !== "undefined" && window.sessionStorage) {
            const isPlaytest = window.location.search.includes("playtest=true");
            const raw = window.sessionStorage.getItem("editor_custom_room");
            if (isPlaytest && raw) {
                try {
                    const data = JSON.parse(raw);
                    const midGx = (GRID_COLS / 2) | 0;
                    const midGy = (GRID_ROWS / 2) | 0;
                    const cells = new Map();
                    const key = `${midGx},${midGy}`;

                    cells.set(key, {
                        gx: midGx,
                        gy: midGy,
                        kind: data.kind || "room",
                        type: data.type || "start",
                        doors: data.doors || { N: false, S: false, E: false, W: false },
                        customFloor: data.floor,
                        customHazards: data.hazards,
                        customEnemies: data.enemies,
                        customName: data.name
                    });

                    customGraph = {
                        cols: GRID_COLS,
                        rows: GRID_ROWS,
                        cells,
                        rooms: [{ gx: midGx, gy: midGy, type: data.type || "start" }],
                        start: { gx: midGx, gy: midGy }
                    };
                } catch (e) {
                    console.error("Erro ao carregar sala do editor para playtest:", e);
                }
            }
        }

        this.dungeon = new Dungeon({
            cols: GRID_COLS, rows: GRID_ROWS, roomCount: ROOM_COUNT,
            tile: TILE, roomCols: ROOM_COLS, roomRows: ROOM_ROWS,
            graph: customGraph || null
        });
        this.rooms.clear();
        return this.dungeon;
    }

    get currentKey() {
        return this.dungeon.currentKey;
    }

    get currentCell() {
        return this.dungeon.current;
    }

    // Bounds jogáveis da sala atual (o antigo "arenaBounds").
    get currentBounds() {
        return this.dungeon.currentBounds();
    }

    get doorHalfWidth() {
        return this.dungeon.doorHalfWidth;
    }

    // Obtém (ou cria) a Room de uma célula.
    _roomFor(cell) {
        const key = `${cell.gx},${cell.gy}`;
        let room = this.rooms.get(key);
        if (!room) {
            room = new Room(cell, this.dungeon.cellBounds(cell.gx, cell.gy));
            this.rooms.set(key, room);
        }
        return room;
    }

    get current() {
        return this._roomFor(this.dungeon.current);
    }

    /**
     * Entra na sala atual (ou numa chave específica): cria/popula sob demanda e
     * sincroniza o estado "cleared" com o Dungeon.
     */
    enter() {
        const room = this.current;
        room.populate(this.spawnSystem, this.getFloor(), this.spawnSystem.assets);
        if (room.cleared) this.dungeon.cleared.add(room.key);
        return room;
    }

    get enemies() {
        return this.current.enemies;
    }

    isLocked() {
        return this.current.isLocked();
    }

    tryClearCurrent() {
        const room = this.current;
        if (room.tryClear()) {
            this.dungeon.markCurrentCleared();
            return true;
        }
        return false;
    }

    // Layout de tiles da sala atual (ex-getRoomTiles).
    get currentTiles() {
        return this.current.tiles;
    }

    cellRect(cell = this.dungeon.current) {
        return this.dungeon.cellRect(cell.gx, cell.gy);
    }

    cellCenter(cell = this.dungeon.current) {
        return this.dungeon.cellCenter(cell.gx, cell.gy);
    }

    doorsOfCurrent() {
        return this.dungeon.doorsOfCurrent();
    }

    // Move para a sala vizinha através de uma porta e popula a nova sala.
    transitionTo(door) {
        this.dungeon.moveTo(door.gx, door.gy);
        return this.enter();
    }

    // ---- Física de confinamento (ex-main.js) ----

    // Prende um inimigo dentro dos bounds da sala.
    clampEnemy(entity, bounds = this.currentBounds) {
        entity.x = Math.max(bounds.minX + entity.hitRadius, Math.min(bounds.maxX - entity.hitRadius, entity.x));
        entity.y = Math.max(bounds.minY + entity.hitRadius, Math.min(bounds.maxY - entity.hitRadius, entity.y));
    }

    /**
     * Clampa o jogador aos bounds, mas permite ADENTRAR o vão de uma porta
     * aberta (avançar além da parede, dentro da passagem, até DOOR_ENTER_DEPTH).
     */
    clampPlayer(player, bounds, doors, canPass) {
        const doorHalf = this.doorHalfWidth;
        const r = player.hitRadius;

        const has = { N: null, S: null, E: null, W: null };
        if (canPass) {
            for (const d of doors) {
                if (d.dir === "N" || d.dir === "S") {
                    if (Math.abs(player.x - d.x) < doorHalf) has[d.dir] = d;
                } else {
                    if (Math.abs(player.y - d.y) < doorHalf) has[d.dir] = d;
                }
            }
        }

        const minX = has.W ? bounds.minX - DOOR_ENTER_DEPTH : bounds.minX + r;
        const maxX = has.E ? bounds.maxX + DOOR_ENTER_DEPTH : bounds.maxX - r;
        player.x = Math.max(minX, Math.min(maxX, player.x));

        const minY = has.N ? bounds.minY - DOOR_ENTER_DEPTH : bounds.minY + r;
        const maxY = has.S ? bounds.maxY + DOOR_ENTER_DEPTH : bounds.maxY - r;
        player.y = Math.max(minY, Math.min(maxY, player.y));

        // Confinamento no corredor: dentro do vão, não deslizar lateralmente
        // para dentro da parede (as quinas da entrada viram parede).
        const inset = r;
        if (has.N && player.y < bounds.minY) {
            player.x = Math.max(has.N.x - doorHalf + inset, Math.min(has.N.x + doorHalf - inset, player.x));
        }
        if (has.S && player.y > bounds.maxY) {
            player.x = Math.max(has.S.x - doorHalf + inset, Math.min(has.S.x + doorHalf - inset, player.x));
        }
        if (has.W && player.x < bounds.minX) {
            player.y = Math.max(has.W.y - doorHalf + inset, Math.min(has.W.y + doorHalf - inset, player.y));
        }
        if (has.E && player.x > bounds.maxX) {
            player.y = Math.max(has.E.y - doorHalf + inset, Math.min(has.E.y + doorHalf - inset, player.y));
        }
    }

    // O jogador está alinhado com o vão da porta (eixo perpendicular)?
    playerAlignedToDoor(player, door) {
        const doorHalf = this.doorHalfWidth;
        if (door.dir === "N" || door.dir === "S") return Math.abs(player.x - door.x) < doorHalf;
        return Math.abs(player.y - door.y) < doorHalf;
    }

    // Quão fundo o jogador entrou no vão (0 = na borda, cresce ao adentrar).
    doorEntryDepth(player, door, bounds) {
        if (door.dir === "N") return bounds.minY - player.y;
        if (door.dir === "S") return player.y - bounds.maxY;
        if (door.dir === "W") return bounds.minX - player.x;
        if (door.dir === "E") return player.x - bounds.maxX;
        return -Infinity;
    }
}
