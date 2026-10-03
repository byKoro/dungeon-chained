import { RoomTiles } from '../core/RoomTiles.js';
import { ROOM_COLS, ROOM_ROWS } from '../config/GameConfig.js';
import { ChallengeCorridor } from '../systems/ChallengeCorridor.js';
import { layoutByIndex } from '../systems/ChallengeLayouts.js';
import { GlobalRoomVariantCatalog } from './RoomArchetypes.js';

/**
 * Room — uma sala concreta da dungeon.
 *
 * Encapsula o estado que antes ficava espalhado entre `roomStates` (main.js) e
 * `cleared`/`visited` (Dungeon): o layout de tiles, os inimigos gerados e se a
 * sala já foi limpa. É criada sob demanda pelo RoomManager quando o jogador
 * entra pela primeira vez na célula correspondente.
 */
export class Room {
    /**
     * @param {object} cell   célula do grafo { gx, gy, kind, type, doors }
     * @param {object} bounds bounds jogáveis (px) da sala
     */
    constructor(cell, bounds) {
        this.cell = cell;
        this.bounds = bounds;
        this.key = `${cell.gx},${cell.gy}`;

        this.enemies = [];
        this.cleared = false;
        this.populated = false;

        // Corredor-desafio co-op (perigos + botões), criado sob demanda em
        // populate() se a célula estiver marcada como desafio.
        this.challenge = null;

        // Layout de tiles (determinístico pela posição da sala ou vindo do editor).
        const seed = (cell.gx * 73856093) ^ (cell.gy * 19349663);
        this.tiles = new RoomTiles(ROOM_COLS, ROOM_ROWS, cell.doors, seed, cell.kind === "room");
        if (cell.customFloor && Array.isArray(cell.customFloor)) {
            this.tiles.floor = cell.customFloor;
        } else if (GlobalRoomVariantCatalog) {
            const authorialFloor = GlobalRoomVariantCatalog.getFloorForDoors(cell.doors);
            if (authorialFloor) {
                this.tiles.floor = authorialFloor;
            }
        }
    }

    get isCombatRoom() {
        return this.cell.kind === "room" && this.cell.type !== "start";
    }

    get isChallengeCorridor() {
        return (this.cell.kind === "corridor" && !!this.cell.challenge) ||
               (this.cell.customHazards && this.cell.customHazards.length > 0);
    }

    get isBoss() {
        return this.cell.type === "boss";
    }

    get kind() {
        return this.cell.kind;
    }

    /**
     * Gera os inimigos uma única vez (idempotente). Salas que não são de
     * combate (start, corredores) já nascem limpas.
     * @param {SpawnSystem} spawnSystem
     * @param {number} floor
     * @param {object} assets  AssetLoader (para sprites dos perigos)
     */
    populate(spawnSystem, floor, assets = null) {
        if (this.populated) return;
        this.populated = true;

        if (this.cell.customHazards && this.cell.customHazards.length > 0) {
            // Desafio customizado vindo do Editor Visual
            const layout = { name: this.cell.customName || "Desafio Custom", elements: this.cell.customHazards };
            this.challenge = new ChallengeCorridor(layout, this.bounds, this.cell.doors, assets);
            this.cleared = false;
        } else if (this.cell.customEnemies && this.cell.customEnemies.length > 0) {
            // Inimigos colocados manualmente pelo Editor Visual
            this.enemies = this.cell.customEnemies.map(foe => {
                const ex = this.bounds.minX + foe.col * 64;
                const ey = this.bounds.minY + foe.row * 64;
                return spawnSystem.createEnemy(ex, ey, floor);
            });
        } else if (this.isChallengeCorridor) {
            // Corredor-desafio: nasce TRANCADO (portas fechadas) até o puzzle
            // co-op ser resolvido. Sem inimigos.
            const layout = layoutByIndex(this.cell.challengeIndex || 0);
            this.challenge = new ChallengeCorridor(layout, this.bounds, this.cell.doors, assets);
            this.cleared = false;
        } else if (this.isCombatRoom) {
            this.enemies = spawnSystem.populateRoom(this.bounds, floor);
        } else {
            this.cleared = true;
        }
    }

    // A sala está trancada (portas fechadas) enquanto:
    //  - for sala de combate com inimigos vivos, OU
    //  - for corredor-desafio ainda não resolvido.
    isLocked() {
        if (this.challenge) return this.challenge.locked;
        return !this.cleared && this.enemies.length > 0;
    }

    // Marca a sala como limpa quando não há mais inimigos (ou o desafio foi
    // resolvido).
    tryClear() {
        if (this.challenge) {
            if (!this.cleared && this.challenge.solved) {
                this.cleared = true;
                return true;
            }
            return false;
        }
        if (!this.cleared && this.enemies.length === 0) {
            this.cleared = true;
            return true;
        }
        return false;
    }

    removeEnemyAt(index) {
        this.enemies.splice(index, 1);
    }
}
