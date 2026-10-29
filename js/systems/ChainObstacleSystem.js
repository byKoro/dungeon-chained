import { CHAIN_COLLISION } from '../config/ChainCollisionConfig.js';

export class ChainObstacleSystem {
    constructor({ config = CHAIN_COLLISION } = {}) {
        this.config = config;
    }

    beginStep(chain) {
        chain.weapon.obstacleContacts = new Map();
        this._correctionRemaining = this.config.correctionPerStep;
    }

    resolve(chain, p1, p2, enemies, constrainPlayers = null) {
        const weapon = chain.weapon;
        if (!chain.isConnected || !weapon.cablePoint) return true;
        const cfg = this.config;
        const contacts = weapon.obstacleContacts;
        for (let iteration = 0; iteration < cfg.iterations; iteration++) {
            const deepest = this._findContact(weapon, p1, p2, enemies);
            if (!deepest) return true;
            const { sx, sy, depth, enemy } = deepest;
            const nx = sx / depth, ny = sy / depth;
            const fresh = !contacts.has(enemy);
            contacts.set(enemy, deepest);
            const hardCorrection = Math.max(0, depth - cfg.compression);
            const softCorrection = Math.min(Math.max(0, depth - hardCorrection - cfg.contactSlop)
                * cfg.correctionStrength, this._correctionRemaining);
            this._correctionRemaining -= softCorrection;
            const correction = hardCorrection + softCorrection;
            for (const player of [p1, p2]) {
                player.x += nx * correction;
                player.y += ny * correction;
                const inward = player.vx * nx + player.vy * ny;
                if (fresh && inward < 0) {
                    player.vx -= inward * nx * cfg.inwardResistance;
                    player.vy -= inward * ny * cfg.inwardResistance;
                }
                if (fresh) {
                    player.vx *= 1 - cfg.friction;
                    player.vy *= 1 - cfg.friction;
                }
            }
            constrainPlayers?.();
            const remaining = this._findContact(weapon, p1, p2, enemies);
            if (!remaining || remaining.depth <= cfg.compression + cfg.contactSlop) return true;
        }
        return false;
    }

    _findContact(weapon, p1, p2, enemies) {
        const cfg = this.config;
        let deepest = null;
        for (const enemy of enemies) {
            if (!enemy.immovable || enemy.ignoresEntityCollisions || enemy.state === 'dying') continue;
            for (const body of enemy.collisionBodies ?? []) {
                const cx = enemy.x + body.x, cy = enemy.y + body.y;
                for (let i = 1; i < cfg.samples; i++) {
                    const t = i / cfg.samples;
                    const point = weapon.cablePoint(p1, p2, t);
                    const disc = i === cfg.samples / 2;
                    const radius = disc ? weapon.discRadius : cfg.cableRadius;
                    const rx = body.radiusX + radius, ry = body.radiusY + radius;
                    let dx = point.x - cx, dy = point.y - cy;
                    let distance = Math.hypot(dx / rx, dy / ry);
                    if (distance >= 1) continue;
                    if (distance === 0) {
                        dx = -(p2.y - p1.y); dy = p2.x - p1.x;
                        if (!dx && !dy) dy = -1;
                        distance = Math.hypot(dx / rx, dy / ry);
                        dx *= 0.001; dy *= 0.001; distance *= 0.001;
                    }
                    const sx = dx / distance - dx, sy = dy / distance - dy;
                    const depth = Math.hypot(sx, sy);
                    if (!deepest || depth > deepest.depth) {
                        deepest = { enemy, x: point.x, y: point.y, sx, sy, depth, kind: disc ? 'disc' : 'chain' };
                    }
                }
            }
        }
        return deepest;
    }
}
