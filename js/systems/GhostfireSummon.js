import { GHOSTFIRE } from '../config/GhostfireConfig.js';
import { TILE } from '../config/GameConfig.js';
import { isSafeFloorCell, findSafeFloorCell } from '../rooms/SafeSpawn.js';

export class GhostfireSummon {
    constructor({ spawnSystem, particleSystem, renderer, audio }) {
        Object.assign(this, { spawnSystem, particleSystem, renderer, audio });
        this.room = null;
        this.projectiles = [];
        this._waveSeq = 0;
    }

    forRoom(room) {
        return this.room === room ? this.projectiles : [];
    }

    _setRoom(room) {
        if (this.room === room) return;
        this.room = room;
        this.projectiles = [];
    }

    _activeCount(room) {
        return room.enemies.filter(e => !e.isBoss && e.state !== "dying").length;
    }

    _walkable(room, x, y) {
        const { floor, walls } = room.tiles;
        const r = GHOSTFIRE.summon.spawnRadius;
        const b = room.bounds;
        if (x - r < b.minX || x + r > b.maxX || y - r < b.minY || y + r > b.maxY) return false;
        const minCol = Math.floor((x - r - b.minX) / TILE) + 1;
        const maxCol = Math.floor((x + r - b.minX) / TILE) + 1;
        const minRow = Math.floor((y - r - b.minY) / TILE) + 1;
        const maxRow = Math.floor((y + r - b.minY) / TILE) + 1;
        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                if (!isSafeFloorCell(floor, col, row, floor[0].length, floor.length) ||
                    walls.some(w => w.col === col && w.row === row)) return false;
            }
        }
        return true;
    }

    _formation(center, direction) {
        return GHOSTFIRE.summon.formation.map(([x, y]) => ({
            x: center.x + x * direction * GHOSTFIRE.summon.spacing,
            y: center.y + y * GHOSTFIRE.summon.spacing
        }));
    }

    _landing(room, boss, players, mouth, direction) {
        const s = GHOSTFIRE.summon;
        const target = { x: mouth.x + direction * s.distance, y: boss.y };
        const candidates = [target];
        for (let row = 1; row < room.tiles.floor.length - 1; row++) {
            for (let col = 1; col < room.tiles.floor[row].length - 1; col++) {
                candidates.push({ x: room.bounds.minX + (col - 0.5) * TILE, y: room.bounds.minY + (row - 0.5) * TILE });
            }
        }
        candidates.sort((a, b) => Math.hypot(a.x - target.x, a.y - target.y) - Math.hypot(b.x - target.x, b.y - target.y));
        return candidates.find(center => {
            if (direction * (center.x - mouth.x) < s.spacing) return false;
            return this._formation(center, direction).every(point =>
                this._walkable(room, point.x, point.y) &&
                !players.some(p => p.lives > 0 && !p.falling && Math.hypot(p.x - point.x, p.y - point.y) < s.spawnRadius + (p.hitRadius ?? 16) + s.playerPadding) &&
                !room.enemies.some(e => e.state !== "dying" && Math.hypot(e.x - point.x, e.y - point.y) < s.spawnRadius + (e.hitRadius ?? 18)) &&
                !this.projectiles.some(shot => Math.hypot(shot.target.x - point.x, shot.target.y - point.y) < s.spawnRadius * 2)
            );
        });
    }

    // Snap a world point to the center of the nearest safe floor cell.
    _snapToFloor(room, point) {
        const b = room.bounds;
        const col = Math.floor((point.x - b.minX) / TILE) + 1;
        const row = Math.floor((point.y - b.minY) / TILE) + 1;
        const safe = findSafeFloorCell(room.tiles.floor, col, row);
        if (!safe.found) return null;
        return { x: b.minX + (safe.col - 0.5) * TILE, y: b.minY + (safe.row - 0.5) * TILE };
    }

    launch(room, boss, players) {
        this._setRoom(room);
        // One wave of fire-trail projectiles already in flight for this boss? Skip.
        if (this.projectiles.some(shot => shot.boss === boss) ||
            this._activeCount(room) + (this._pendingWaves() + 1) * GHOSTFIRE.summonCount > GHOSTFIRE.maxMinions) return false;
        const direction = boss.side === "right" ? -1 : 1;
        const mouth = { x: boss.x + direction * GHOSTFIRE.sprite.mouthOffset * GHOSTFIRE.sprite.scale, y: boss.y + boss.hoverOffset };
        const target = this._landing(room, boss, players, mouth, direction);
        if (!target) return false;
        // Like the trailer: the boss spits each minion out as its own fire projectile
        // that streaks forward leaving a flame trail. The whole wave shares a waveId
        // so flight timing and limit-reservation stay in lockstep.
        const waveId = ++this._waveSeq;
        const positions = this._formation(target, direction);
        positions.forEach((point, i) => {
            const type = GHOSTFIRE.summonTypes[i % GHOSTFIRE.summonTypes.length];
            this.projectiles.push({
                boss, direction, waveId, type,
                start: { ...mouth }, target: point, age: 0, x: mouth.x, y: mouth.y
            });
        });
        this.particleSystem.triggerFlameBurst(mouth.x, mouth.y, GHOSTFIRE.flameColor, GHOSTFIRE.summon.launch);
        this.audio?.play("ghostfireSummon");
        return true;
    }

    // Distinct waves currently in flight, so capacity is reserved per wave.
    _pendingWaves() {
        return new Set(this.projectiles.map(shot => shot.waveId)).size;
    }

    update(room) {
        this._setRoom(room);
        const impacted = [];
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const shot = this.projectiles[i];
            if (!room.enemies.includes(shot.boss) || shot.boss.state === "dying") {
                this.projectiles.splice(i, 1);
                continue;
            }
            if (shot.boss.frozen) continue;
            const t = Math.min(1, ++shot.age / GHOSTFIRE.summon.flightFrames);
            // Straight horizontal streak (no arc) — reads as a fire trail, like the trailer.
            shot.x = shot.start.x + (shot.target.x - shot.start.x) * t;
            shot.y = shot.start.y + (shot.target.y - shot.start.y) * t;
            if (t >= 1) {
                this.projectiles.splice(i, 1);
                impacted.push(shot);
            } else if (shot.age % GHOSTFIRE.summon.trailEvery === 0) {
                this.particleSystem.triggerFlameBurst(shot.x, shot.y, GHOSTFIRE.flameColor, GHOSTFIRE.summon.trail);
            }
        }
        // Resolve impacts after advancing the whole wave so a single wave lands together.
        const impactedWaves = new Set();
        for (const shot of impacted) this._impact(room, shot, impactedWaves);
    }

    _impact(room, shot, impactedWaves) {
        const s = GHOSTFIRE.summon;
        this.particleSystem.triggerFlameBurst(shot.target.x, shot.target.y, GHOSTFIRE.flameColor, s.impact);
        this.particleSystem.triggerFlash?.(shot.target.x, shot.target.y, s.flashAmount, s.flashPower);
        this.renderer.triggerShake(GHOSTFIRE.summonShake);
        // One impact cue per wave, not one per projectile, to avoid stacked audio.
        if (impactedWaves && !impactedWaves.has(shot.waveId)) {
            impactedWaves.add(shot.waveId);
            this.audio?.play("ghostfireSummonImpact");
        }
        if (this._activeCount(room) >= GHOSTFIRE.maxMinions) return;
        // Each fire trail resolves into exactly one minion, snapped to a safe floor
        // cell so the trail never drops its payload onto a wall/hole.
        const spot = this._walkable(room, shot.target.x, shot.target.y)
            ? shot.target
            : (this._snapToFloor(room, shot.target) || shot.target);
        const enemy = this.spawnSystem.createEnemy(spot.x, spot.y, room._spawnFloor, shot.type);
        enemy.setNavigationFloor(room.tiles.floor, room.bounds, room.tiles.walls);
        enemy.facingLeft = shot.direction < 0;
        enemy.state = "recover";
        enemy.stateTimer = s.recoverFrames;
        room.enemies.push(enemy);
        this.audio?.play("enemySpawn");
    }
}
