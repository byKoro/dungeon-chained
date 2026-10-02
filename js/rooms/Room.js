import { RoomTiles } from '../core/RoomTiles.js';
import { ROOM_COLS, ROOM_ROWS } from '../config/GameConfig.js';

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

        // Layout de tiles (determinístico pela posição da sala).
        const seed = (cell.gx * 73856093) ^ (cell.gy * 19349663);
        this.tiles = new RoomTiles(ROOM_COLS, ROOM_ROWS, cell.doors, seed, cell.kind === "room");
    }

    get isCombatRoom() {
        return this.cell.kind === "room" && this.cell.type !== "start";
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
     */
    populate(spawnSystem, floor) {
        if (this.populated) return;
        this.populated = true;

        if (this.isCombatRoom) {
            this.enemies = spawnSystem.populateRoom(this.bounds, floor);
        } else {
            this.cleared = true;
        }
    }

    // A sala está trancada (portas fechadas) enquanto houver inimigo vivo.
    isLocked() {
        return !this.cleared && this.enemies.length > 0;
    }

    // Marca a sala como limpa quando não há mais inimigos.
    tryClear() {
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
