import { GHOSTFIRE } from '../config/GhostfireConfig.js';
import { Physics } from '../core/Physics.js';
import { GhostfireRenderer } from './GhostfireRenderer.js';
import { GhostfireSummon } from './GhostfireSummon.js';

export class GhostfireSystem {
    constructor({ spawnSystem, particleSystem, renderer, audio }) {
        this.spawnSystem = spawnSystem;
        this.particleSystem = particleSystem;
        this.renderer = renderer;
        this.audio = audio;
        this.bossRenderer = new GhostfireRenderer();
        this.summons = new GhostfireSummon({ spawnSystem, particleSystem, renderer, audio });
        this._deathEffects = new WeakSet();
    }

    update(room, players) {
        this.summons.update(room);
        for (const boss of room.enemies.filter(e => e.isGhostfire && !e.frozen)) {
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
            if (boss.justSummoned) this.summons.launch(room, boss, players);
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

    drawFloor(ctx, room) {
        for (const boss of room.enemies) {
            if (!boss.isGhostfire || boss.isHidden || boss.frozen || boss.state !== "indicator" || !boss.beam) continue;
            this.bossRenderer.drawBeam(ctx, boss);
        }
    }

    drawAir(ctx, room) {
        for (const shot of this.summons.forRoom(room)) this.bossRenderer.drawSummon(ctx, shot);
        for (const boss of room.enemies) {
            if (!boss.isGhostfire || boss.isHidden || boss.frozen || !["beam", "fade"].includes(boss.state) || !boss.beam) continue;
            this.bossRenderer.drawBeam(ctx, boss);
        }
    }

    renderLights(room, renderer, postProcessor) {
        const addLight = (x, y, radius) => {
            const point = renderer.worldToScreen(x, y);
            const pixel = Math.max(2, Math.round(GHOSTFIRE.sprite.scale * point.zoom));
            postProcessor.addLight(point.x, point.y, radius * point.zoom, pixel, 1, GHOSTFIRE.lightProfile);
        };
        for (const shot of this.summons.forRoom(room)) addLight(shot.x, shot.y, GHOSTFIRE.summon.lightRadius);
        for (const boss of room.enemies) {
            if (!boss.isGhostfire || boss.isHidden || boss.state === "dying") continue;
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
