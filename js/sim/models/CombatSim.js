import { PhysicsSim } from '../math/PhysicsSim.js';

/**
 * CombatSim - Engine-agnostic combat hit detection and damage resolution.
 * Extracted from CombatSystem.js.
 * Zero browser, Audio, or Canvas dependencies. Emits SimulationEvents for audio and juice.
 * Directly portable to C# class CombatSim.
 */
export class CombatSim {
    resolveWeaponHits(saw, tether, enemies, p1, p2, events = null) {
        if (!tether.connected) return;

        const saws = saw.getSawPositions ? saw.getSawPositions(p1, p2) : [];
        const discR = saw.discRadius ?? 14;
        const safeZone = tether.playerSafeZone ?? 46;
        let hits = 0;
        let heavy = false;

        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.isDying || enemy.isDead) continue;

            const d = PhysicsSim.distToSegment(enemy.x, enemy.y, p1.x, p1.y, p2.x, p2.y);
            const dP1 = Math.hypot(enemy.x - p1.x, enemy.y - p1.y);
            const dP2 = Math.hypot(enemy.x - p2.x, enemy.y - p2.y);
            const nearPlayer = dP1 < safeZone || dP2 < safeZone;

            const hitChain = !nearPlayer && d < (saw.radius ?? 14) + enemy.hitRadius;
            const hitSaw = discR > 0
                ? saws.find(s => Math.hypot(enemy.x - s.x, enemy.y - s.y) < discR + enemy.hitRadius)
                : null;

            if (hitChain || hitSaw) {
                let dirX = 0, dirY = -1;
                let impactX = enemy.x, impactY = enemy.y;

                if (hitSaw) {
                    dirX = enemy.x - hitSaw.x;
                    dirY = enemy.y - hitSaw.y;
                    const len = Math.hypot(dirX, dirY);
                    if (len > 0.001) { dirX /= len; dirY /= len; }
                    impactX = hitSaw.x + dirX * discR;
                    impactY = hitSaw.y + dirY * discR;
                } else {
                    const pt = PhysicsSim.closestPointOnSegment(enemy.x, enemy.y, p1.x, p1.y, p2.x, p2.y);
                    dirX = enemy.x - pt.x;
                    dirY = enemy.y - pt.y;
                    const len = Math.hypot(dirX, dirY);
                    if (len > 0.001) { dirX /= len; dirY /= len; }
                    impactX = pt.x;
                    impactY = pt.y;
                }

                const hitResult = enemy.takeHit(1, { dirX, dirY }, events);
                if (hitResult) {
                    hits++;
                    if (hitResult.poiseBroken) heavy = true;
                    saw.onHit?.();
                    events?.emitSawHit(impactX, impactY, 1, hitResult.poiseBroken);
                    events?.emitCameraShake(hitResult.poiseBroken ? 16 : 10);
                }
            }
        }
        return hits;
    }

    resolveLooseSawHits(saw, enemies, events = null) {
        if (!saw.spinningLoose) return 0;
        const discR = saw.discRadius ?? 14;
        let hits = 0;

        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.isDying || enemy.isDead) continue;

            const dist = Math.hypot(enemy.x - saw.dropX, enemy.y - saw.dropY);
            if (dist < discR + enemy.hitRadius) {
                let dirX = enemy.x - saw.dropX;
                let dirY = enemy.y - saw.dropY;
                const len = Math.hypot(dirX, dirY) || 1;
                dirX /= len;
                dirY /= len;

                const hitResult = enemy.takeHit(1, { dirX, dirY }, events);
                if (hitResult) {
                    hits++;
                    saw.onHit?.();
                    events?.emitSawHit(saw.dropX, saw.dropY, 1, hitResult.poiseBroken);
                    events?.emitCameraShake(10);
                }
            }
        }
        return hits;
    }

    resolveSnapWave(x, y, radius, enemies, events = null) {
        let hits = 0;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.isDying || enemy.isDead) continue;

            const dist = Math.hypot(enemy.x - x, enemy.y - y);
            if (dist < radius + enemy.hitRadius) {
                let dirX = enemy.x - x;
                let dirY = enemy.y - y;
                const len = Math.hypot(dirX, dirY) || 1;
                dirX /= len;
                dirY /= len;

                const hitResult = enemy.takeHit(1, { dirX, dirY }, events);
                if (hitResult) {
                    hits++;
                    events?.emitSawHit(x, y, 1, true);
                    events?.emitCameraShake(14);
                }
            }
        }
        return hits;
    }
}
