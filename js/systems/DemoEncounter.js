import { FIRE_SKULL } from '../config/DemoCombatConfig.js';
import { findSafeFloorCell } from '../rooms/SafeSpawn.js';
import { TILE } from '../config/GameConfig.js';

export class DemoEncounter {
    constructor({ rooms, spawnSystem, onVictory }) {
        Object.assign(this, { rooms, spawnSystem, onVictory });
        this.reset();
    }

    reset() { this.won = false; }

    update() {
        if (!this.rooms.dungeon.document || this.won) return;
        const room = this.rooms.current, rect = this.rooms.cellRect();
        for (const boss of room.enemies.filter(e => e.isBoss)) {
            const requested = boss.summonRequested;
            boss.summonRequested = 0;
            for (let i = 0; i < requested && room.enemies.length <= FIRE_SKULL.boss.maxMinions; i++) {
                const cell = findSafeFloorCell(room.tiles.floor, Math.floor((boss.x - rect.x) / TILE) + (i ? 2 : -2), Math.floor((boss.y - rect.y) / TILE) + 2);
                if (!cell.found || room.tiles.walls.some(w => w.col === cell.col && w.row === cell.row)) continue;
                const enemy = this.spawnSystem.createEnemy(rect.x + (cell.col + 0.5) * TILE, rect.y + (cell.row + 0.5) * TILE, 1, 'demon');
                enemy.setNavigationFloor(room.tiles.floor, room.bounds, room.tiles.walls);
                room.enemies.push(enemy);
            }
        }
        if (room.isBoss && room.enemiesSpawned && room.cell.customEnemies.some(e => e.type === 'fireSkullBoss') && room.enemies.length === 0) {
            this.won = true; this.onVictory();
        }
    }
}
