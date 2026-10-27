import { Physics } from '../core/Physics.js';
import { PLAYER_SAFE_ZONE, MAX_ACTIVE_GIBS, HEART_DROP } from '../config/GameConfig.js';

const HIT_COMBO_WINDOW_MS = 900;
const HIT_COMBO_PITCH_STEP = 0.035;
const HIT_COMBO_MAX_STEPS = 5;

export class CombatSystem {
    constructor({ renderer, particleSystem, audio = null }) {
        this.renderer = renderer;
        this.particleSystem = particleSystem;
        this.audio = audio;
        this._combo = 0;
        this._lastHitAt = -Infinity;
    }

    _now() {
        return globalThis.performance?.now?.() ?? Date.now();
    }

    _playSawHit(count) {
        if (!this.audio) return;
        const now = this._now();
        this._combo = now - this._lastHitAt < HIT_COMBO_WINDOW_MS ? this._combo + 1 : 0;
        this._lastHitAt = now;
        const step = Math.min(this._combo, HIT_COMBO_MAX_STEPS);
        this.audio.play("sawHit", {
            rateMultiplier: 1 + step * HIT_COMBO_PITCH_STEP,
            volumeMultiplier: Math.min(1.35, 1 + (count - 1) * 0.15)
        });
        this.audio.duck?.(-7, { attackMs: 10, holdMs: 90, releaseMs: 500 });
    }

    updateEnemies(enemies, players) {
        for (const e of enemies) {
            e.update(players, (hitPlayer) => {
                this.renderer.triggerShake(14);
                if (hitPlayer) {
                    if (this.audio) this.audio.play("playerHurt");
                    this.particleSystem.triggerBlood(hitPlayer.x, hitPlayer.y, 16, 1.1);
                }
            });
            if (this.audio) {
                if (e.justStepped) this.audio.play("enemyStep");
                if (e.justAttacked) {
                    this.audio.play("enemyAttack");
                    this.audio.play("enemyAttackVoice");
                }
            }
        }
    }

    resolveWeaponHits(weapon, enemies, p1, p2, connected = true, onKill = null) {
        if (!connected) return;

        const sawPos = weapon.getSawPositions ? weapon.getSawPositions(p1, p2)[0] : null;
        const discR = (sawPos && weapon.discRadius) ? weapon.discRadius : 0;
        let hits = 0;

        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.state === "dying") continue;

            const d = Physics.distToSegment(enemy.x, enemy.y, p1.x, p1.y, p2.x, p2.y);
            const dP1 = Math.hypot(enemy.x - p1.x, enemy.y - p1.y);
            const dP2 = Math.hypot(enemy.x - p2.x, enemy.y - p2.y);
            const nearPlayer = dP1 < PLAYER_SAFE_ZONE || dP2 < PLAYER_SAFE_ZONE;

            const hitChain = !nearPlayer && d < weapon.hitThreshold + enemy.hitRadius;
            const hitDisc = discR > 0 &&
                Math.hypot(enemy.x - sawPos.x, enemy.y - sawPos.y) < discR + enemy.hitRadius;

            if (hitChain || hitDisc) {
                if (enemy.takeHit) { if (!enemy.takeHit()) continue; }
                else enemy.startDying();
                weapon.onHit?.();
                hits++;
                if (this.audio) this.audio.play("monsterHurt");
                this.renderer.triggerShake(10);
                this.particleSystem.triggerBlood(enemy.x, enemy.y, 10, 0.9);
                onKill?.(enemy);
            }
        }

        if (hits > 0) this._playSawHit(hits);
    }

    resolveDeaths(room, gibs, onKill = null, players = []) {
        const enemies = room.enemies;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (!enemy.readyToGib) continue;

            this.particleSystem.triggerBlood(enemy.x, enemy.y, 26, 1.35);
            this.particleSystem.triggerBloodPool(enemy.x, enemy.y);
            gibs.push(...enemy.explodeIntoGibs());
            while (gibs.length > MAX_ACTIVE_GIBS) gibs.shift();

            if (this.canDropHeart(room, players)) {
                const chanceField = room.cell.heartDropChance;
                const pct = Number.isFinite(chanceField) ? chanceField : HEART_DROP.chance;
                if (Math.random() < pct / 100) room.addHeart(enemy.x, enemy.y);
            }

            room.removeEnemyAt(i);
            this.renderer.triggerShake(7);
            onKill?.(enemy);
        }
    }

    canDropHeart(room, players) {
        const missing = players.reduce(
            (sum, p) => sum + Math.max(0, HEART_DROP.maxLives - (p?.lives ?? HEART_DROP.maxLives)), 0
        );
        return missing > (room.hearts?.length ?? 0);
    }
}
