import { SUMMONER } from '../config/SummonerConfig.js';
import { TILE } from '../config/GameConfig.js';
import { findSafeFloorCell } from '../rooms/SafeSpawn.js';

// Materializa os minions quando um Invocador levanta `justSummoned`. A entidade só
// sinaliza; o spawn, o som e o FX ficam aqui (ADR 0002/0003).
export class SummonerSystem {
    constructor({ spawnSystem, particleSystem, audio }) {
        this.spawnSystem = spawnSystem;
        this.particleSystem = particleSystem;
        this.audio = audio;
    }

    update(room, players = []) {
        if (!room?.enemies?.length) return;
        const alive = players.filter(p => p && p.lives > 0 && !p.falling);
        for (const summoner of room.enemies) {
            if (!summoner.justSummoned) continue;
            this._spawnWave(room, alive);
        }
    }

    _activeMinions(room) {
        return room.enemies.filter(e => !e.isBoss && !e.isSummoner && e.state !== 'dying').length;
    }

    _spawnWave(room, players) {
        const types = SUMMONER.summonTypes;
        if (!players.length || this._activeMinions(room) + types.length > SUMMONER.maxMinions) return;

        const created = [];
        types.forEach((type, i) => {
            // Cada minion materializa na posição de um jogador (cerca o grupo). Com um
            // único jogador vivo, ambos nascem sobre ele com um leve desvio.
            const player = players[i % players.length];
            const spread = players.length > 1 ? 0 : (i === 0 ? -SUMMONER.spawnOffset : SUMMONER.spawnOffset);
            const raw = { x: player.x + spread, y: player.y };
            const spot = this._snapToFloor(room, raw) || raw;
            const minion = this.spawnSystem.createEnemy(spot.x, spot.y, room._spawnFloor, type);
            minion.setNavigationFloor(room.tiles.floor, room.bounds, room.tiles.walls);
            minion.facingLeft = player.x < spot.x;
            created.push({ minion, spot });
        });

        for (const { spot } of created) {
            this.particleSystem?.triggerFlameBurst?.(spot.x, spot.y, [150, 90, 220], { amount: 14 });
        }
        room.enemies.push(...created.map(c => c.minion));
        this.audio?.play('enemySpawn');
    }

    _snapToFloor(room, point) {
        const b = room.bounds;
        const col = Math.floor((point.x - b.minX) / TILE) + 1;
        const row = Math.floor((point.y - b.minY) / TILE) + 1;
        const safe = findSafeFloorCell(room.tiles.floor, col, row);
        if (!safe.found) return null;
        return { x: b.minX + (safe.col - 0.5) * TILE, y: b.minY + (safe.row - 0.5) * TILE };
    }
}
