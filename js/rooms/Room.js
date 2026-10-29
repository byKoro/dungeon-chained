import { RoomTiles } from '../core/RoomTiles.js';
import { ROOM_COLS, ROOM_ROWS, TILE } from '../config/GameConfig.js';
import { ChallengeCorridor } from '../systems/ChallengeCorridor.js';
import { GlobalRoomVariantCatalog } from './RoomArchetypes.js';
import { HeartPickup } from '../entities/HeartPickup.js';
import { findSafeFloorCell } from './SafeSpawn.js';

export class Room {

    constructor(cell, bounds) {
        this.cell = cell;
        this.bounds = bounds;
        this.key = `${cell.gx},${cell.gy}`;

        this.enemies = [];
        this.hearts = [];
        this.cleared = false;
        this.populated = false;

        this.enemiesSpawned = false;

        this.challenge = null;

        const seed = (cell.gx * 73856093) ^ (cell.gy * 19349663);
        this.tiles = new RoomTiles(cell.authored?.cols ?? ROOM_COLS, cell.authored?.rows ?? ROOM_ROWS, cell.authored ? {} : cell.doors, seed, cell.kind === "room");

        if (cell.customFloor && Array.isArray(cell.customFloor)) {
            this.tiles.floor = cell.customFloor;
        } else if (GlobalRoomVariantCatalog) {
            const authorialFloor = GlobalRoomVariantCatalog.getFloorForDoors(cell.doors);
            if (authorialFloor) {
                this.tiles.floor = authorialFloor;
            }
        }

        if (cell.authored) this.tiles.doorCells = [];
        this.tiles.walls = Array.isArray(cell.customWalls) ? cell.customWalls : [];
        this.wallBoxes = this.tiles.walls.map(wall => ({ x: bounds.minX - TILE + wall.col * TILE, y: bounds.minY - TILE + wall.row * TILE, w: TILE, h: TILE }));

        if (Array.isArray(cell.customTorches)) this.tiles.torches = cell.customTorches;
        if (Array.isArray(cell.customProps)) this.tiles.props = cell.customProps;
    }

    get isCombatRoom() {
        return this.cell.kind === "room" && this.cell.type !== "start";
    }

    get isChallengeCorridor() {
        return !!(this.cell.customHazards && this.cell.customHazards.length > 0);
    }

    get buttonCount() {
        if (!this.cell.customHazards) return 0;
        return this.cell.customHazards.filter(h => h.type === "button").length;
    }

    get lockRule() {
        const explicit = this.cell.customLock;

        if (explicit === "buttons") return this.buttonCount >= 2 ? "buttons" : "none";
        if (explicit === "enemies") return "enemies";
        if (explicit === "none") return "none";

        if (this.buttonCount >= 2) return "buttons";
        if (this.cell.customEnemies && this.cell.customEnemies.length > 0) return "enemies";
        return "none";
    }

    get isBoss() {
        return this.cell.type === "boss";
    }

    get kind() {
        return this.cell.kind;
    }

    populate(spawnSystem, floor, assets = null) {
        if (this.populated) return;
        this.populated = true;

        this._spawnSystem = spawnSystem;
        this._spawnFloor = floor;
        this._spawnAssets = assets;

        if (this.cell.customHazards && this.cell.customHazards.length > 0) {
            const layout = { name: this.cell.customName || "Desafio Custom", elements: this.cell.customHazards };
            this.challenge = new ChallengeCorridor(layout, this.bounds, this.cell.doors, assets);
        }

        const heartCount = Number.isInteger(this.cell.heartCount) ? this.cell.heartCount : 0;
        if (heartCount > 0) {
            const cx = (this.bounds.minX + this.bounds.maxX) / 2;
            const cy = (this.bounds.minY + this.bounds.maxY) / 2;
            for (let i = 0; i < heartCount; i++) {
                this.addHeart(cx + (Math.random() - 0.5) * 180, cy + (Math.random() - 0.5) * 120);
            }
        }

        const rule = this.lockRule;
        if (rule === "buttons" && this.challenge) {
            this.cleared = false;
        } else if (rule === "enemies" && this.hasPendingEnemies) {

            this.cleared = false;
        } else {
            this.cleared = true;
        }
    }

    get _authoredEnemies() {
        if (!this.cell.customEnemies || !this.cell.customEnemies.length) return [];
        return this.cell.customEnemies;
    }

    get hasPendingEnemies() {
        return !this.enemiesSpawned && this._authoredEnemies.length > 0;
    }

    spawnEnemies(frozen = false) {
        if (this.enemiesSpawned) return this.enemies;
        this.enemiesSpawned = true;

        const spawnSystem = this._spawnSystem;
        if (!spawnSystem) return this.enemies;

        const floorGrid = this.tiles.floor;
        this.enemies = [];
        for (const foe of this._authoredEnemies) {

            const safe = findSafeFloorCell(floorGrid, foe.col, foe.row);
            if (!safe.found) continue;

            const ex = this.bounds.minX + (safe.col - 0.5) * TILE;
            const ey = this.bounds.minY + (safe.row - 0.5) * TILE;
            const enemy = spawnSystem.createEnemy(ex, ey, this._spawnFloor, foe.type);
            enemy.setNavigationFloor(floorGrid, this.bounds, this.tiles.walls);
            if (frozen) enemy.beginFrozenSpawn();
            this.enemies.push(enemy);
        }
        return this.enemies;
    }

    isLocked() {
        if (this.cleared) return false;
        const rule = this.lockRule;
        if (rule === "buttons") return this.challenge ? this.challenge.locked : false;

        if (rule === "enemies") return this.enemies.length > 0 || this.hasPendingEnemies;
        return false;
    }

    tryClear() {
        if (this.cleared) return false;
        const rule = this.lockRule;

        if (rule === "buttons") {
            if (this.challenge && this.challenge.solved) {
                this.cleared = true;
                return true;
            }
            return false;
        }
        if (rule === "enemies") {

            if (this.enemiesSpawned && this.enemies.length === 0) {
                this.cleared = true;
                return true;
            }
            return false;
        }

        return false;
    }

    removeEnemyAt(index) {
        this.enemies.splice(index, 1);
    }

    addHeart(x, y) {
        this.hearts.push(new HeartPickup(x, y));
    }
}
