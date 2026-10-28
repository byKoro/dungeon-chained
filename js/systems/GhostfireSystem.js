import { GHOSTFIRE } from '../config/GhostfireConfig.js';
import { TILE } from '../config/GameConfig.js';
import { Physics } from '../core/Physics.js';
import { isSafeFloorCell } from '../rooms/SafeSpawn.js';
import { GhostfireRenderer } from './GhostfireRenderer.js';

export class GhostfireSystem {
    constructor({ spawnSystem, particleSystem, renderer, audio }) {
        this.spawnSystem = spawnSystem;
        this.particleSystem = particleSystem;
        this.renderer = renderer;
        this.audio = audio;
        this.bossRenderer = new GhostfireRenderer();
        this._deathEffects = new WeakSet();
    }

    update(room, players) {
        for (const boss of room.enemies.filter(e => e.isBoss && !e.frozen)) {
            if (boss.state === "dying") {
                if (!this._deathEffects.has(boss)) {
                    this._deathEffects.add(boss);
                    this.particleSystem.triggerFlameBurst(boss.x, boss.y, GHOSTFIRE.flameColor);
                    this.renderer.triggerShake(GHOSTFIRE.deathShake);
                    this.audio?.play("ghostfireDeath");
                    for (const enemy of room.enemies) {
                        if (!enemy.isBoss && enemy.state !== "dying") enemy.startDying?.();
                    }
                }
                continue;
            }
            if (boss.justArrived) this.renderer.triggerShake(GHOSTFIRE.arrivalShake);
            if (boss.justRoared) this.audio?.play("ghostfireRoar");
            if (boss.justCharging) this.audio?.play("ghostfireCharge");
            if (boss.justSummoned) this._summon(room, boss, players, 1);
            if (boss.justAttacked) {
                this.audio?.play("ghostfireBeam");
                this.renderer.triggerShake(GHOSTFIRE.attackShake);
                this.particleSystem.triggerFlameBurst(boss.x, boss.y, GHOSTFIRE.flameColor);
            }
            if (boss.justTeleported) {
                for (const point of [boss.teleportFrom, boss]) {
                    this.particleSystem.triggerFlameBurst(point.x, point.y, GHOSTFIRE.flameColor);
                }
            }
            if (boss.state === "beam" && boss.beam) {
                const beam = boss.beam;
                for (const enemy of room.enemies) {
                    if (enemy.isBoss || enemy.state === "dying" || enemy.frozen) continue;
                    const hitRadius = enemy.hitRadius ?? 12;
                    if (Physics.distToSegment(enemy.x, enemy.y, beam.x, beam.y, beam.endX, beam.endY) <= GHOSTFIRE.beamWidth / 2 + hitRadius) {
                        enemy.startDying?.();
                    }
                }
            }
        }
    }

    _summon(room, boss, players, burstCount = GHOSTFIRE.summonCount) {
        const active = room.enemies.filter(e => !e.isBoss && e.state !== "dying").length;
        const count = Math.min(burstCount, GHOSTFIRE.maxMinions - active);
        const spawnSide = boss.side === "right" ? -1 : 1;
        const wave = boss.summonWave++;
        this.audio?.play("ghostfireSummon");
        this.renderer.triggerShake(GHOSTFIRE.summonShake);

        const makeCandidate = (x, y) => {
            const col = Math.floor((x - room.bounds.minX) / TILE) + 1;
            const row = Math.floor((y - room.bounds.minY) / TILE) + 1;
            if (row <= 0 || row >= room.tiles.floor.length - 1 || col <= 0 || col >= room.tiles.floor[row].length - 1) return false;
            if (!isSafeFloorCell(room.tiles.floor, col, row, room.tiles.floor[row].length, room.tiles.floor.length)) return false;
            if (room.tiles.walls.some(w => w.col === col && w.row === row)) return false;
            if ([...players, ...room.enemies].some(e => Math.hypot(e.x - x, e.y - y) < GHOSTFIRE.summonSafeDistance)) return false;
            return true;
        };

        const preferred = [];
        for (let i = 0; i < GHOSTFIRE.summonAttempts; i++) {
            const x = boss.x + spawnSide * (GHOSTFIRE.summonSidePadding + Math.random() * GHOSTFIRE.summonBurstRange);
            const y = boss.y + (Math.random() * 2 - 1) * GHOSTFIRE.summonVerticalSpread;
            if (makeCandidate(x, y)) preferred.push({ x, y });
        }

        const fallback = [];
        for (let row = 1; row < room.tiles.floor.length - 1; row++) {
            for (let col = 1; col < room.tiles.floor[row].length - 1; col++) {
                const x = room.bounds.minX + (col - 0.5) * TILE;
                const y = room.bounds.minY + (row - 0.5) * TILE;
                if (makeCandidate(x, y)) fallback.push({ x, y });
            }
        }

        const forward = fallback.filter(point => spawnSide * (point.x - boss.x) > 0);
        for (let i = 0; i < count; i++) {
            const candidates = preferred.length ? preferred : forward.length ? forward : fallback;
            if (!candidates.length) break;
            const index = Math.floor(Math.random() * candidates.length);
            const { x, y } = candidates.splice(index, 1)[0];
            const type = GHOSTFIRE.summonTypes[(wave + i) % GHOSTFIRE.summonTypes.length];
            const enemy = this.spawnSystem.createEnemy(x, y, room._spawnFloor, type);
            enemy.setNavigationFloor(room.tiles.floor, room.bounds, room.tiles.walls);
            room.enemies.push(enemy);
            this.particleSystem.triggerFlameBurst(x, y, GHOSTFIRE.flameColor);
            this.audio?.play("enemySpawn");
            for (const pool of [preferred, forward, fallback]) {
                for (let j = pool.length - 1; j >= 0; j--) {
                    if (Math.hypot(pool[j].x - x, pool[j].y - y) < GHOSTFIRE.summonSafeDistance) pool.splice(j, 1);
                }
            }
        }
    }

    drawFloor(ctx, room) {
        for (const boss of room.enemies) {
            if (boss.isHidden || boss.frozen || boss.state !== "indicator" || !boss.beam) continue;
            this.bossRenderer.drawBeam(ctx, boss);
        }
    }

    drawAir(ctx, room) {
        for (const boss of room.enemies) {
            if (boss.isHidden || boss.frozen || !["beam", "fade"].includes(boss.state) || !boss.beam) continue;
            this.bossRenderer.drawBeam(ctx, boss);
        }
    }

    renderLights(room, renderer, postProcessor) {
        const addLight = (x, y, radius) => {
            const point = renderer.worldToScreen(x, y);
            const pixel = Math.max(2, Math.round(GHOSTFIRE.sprite.scale * point.zoom));
            postProcessor.addLight(point.x, point.y, radius * point.zoom, pixel, 1, GHOSTFIRE.lightProfile);
        };
        for (const boss of room.enemies) {
            if (!boss.isBoss || boss.isHidden || boss.state === "dying") continue;
            const alpha = boss.state === "teleport" ? boss.stateTimer / GHOSTFIRE.teleportFrames : 1;
            addLight(boss.x, boss.y + boss.hoverOffset, GHOSTFIRE.lightRadius * alpha);
            if (!boss.beam || !["indicator", "beam", "fade"].includes(boss.state)) continue;
            const beam = boss.beam;
            const length = Math.abs(beam.endX - beam.x);
            const steps = Math.max(1, Math.ceil(length / GHOSTFIRE.beamLightSpacing));
            const radius = GHOSTFIRE.beamLightRadius * (boss.state === "beam" ? 1 : GHOSTFIRE.indicatorAlpha);
            for (let i = 0; i <= steps; i++) {
                addLight(beam.x + (beam.endX - beam.x) * i / steps, beam.y, radius);
            }
        }
    }
}
