/**
 * PhysicsSim - Pure mathematical collision and constraint solver.
 * Extracted from Physics.js and ChainObstacleSystem.js.
 * Zero browser or engine dependencies. Directly portable to C# static class PhysicsSim.
 */
export class PhysicsSim {
    static applyChainConstraint(p1, p2, maxRestDistance = 145, stiffness = 0.045) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);

        if (dist > maxRestDistance) {
            const diff = dist - maxRestDistance;
            const force = diff * stiffness;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            p1.vx += fx;
            p1.vy += fy;
            p2.vx -= fx;
            p2.vy -= fy;
        }
    }

    static distToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    }

    static closestPointOnSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return { x: x1, y: y1 };
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
    }

    static resolveCircleCollision(entity, cx, cy, radius, impulse = 0.35) {
        if (entity.immovable) return;
        const r = radius + (entity.hitRadius ?? 0);
        let dx = entity.x - cx;
        let dy = entity.y - cy;
        let dist = Math.hypot(dx, dy);
        if (dist >= r) return;

        if (dist === 0) { dx = 1; dy = 0; dist = 1; }

        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = r - dist;

        entity.x = cx + nx * r;
        entity.y = cy + ny * r;

        PhysicsSim._addImpulse(entity, nx * overlap * impulse, ny * overlap * impulse);
    }

    static resolveBoxCollisions(entity, boxes) {
        const r = entity.hitRadius || 16;
        for (let i = 0; i < boxes.length; i++) {
            const b = boxes[i];
            // Broadphase AABB early-out
            if (entity.x + r < b.x || entity.x - r > b.x + b.w ||
                entity.y + r < b.y || entity.y - r > b.y + b.h) {
                continue;
            }

            const nearestX = Math.max(b.x, Math.min(entity.x, b.x + b.w));
            const nearestY = Math.max(b.y, Math.min(entity.y, b.y + b.h));
            const distX = entity.x - nearestX;
            const distY = entity.y - nearestY;
            const dist = Math.hypot(distX, distY);

            if (dist < r) {
                const overlap = r - dist;
                if (dist === 0) {
                    entity.x += overlap;
                } else {
                    entity.x += (distX / dist) * overlap;
                    entity.y += (distY / dist) * overlap;
                }
            }
        }
    }

    static resolveEntityCollisions(entities, opts = {}) {
        const radiusXMul = opts.radiusXMul ?? 0.72;
        const radiusYMul = opts.radiusYMul ?? 1.15;
        const push = opts.push ?? 0.5;
        const impulse = opts.impulse ?? 0.35;

        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const a = entities[i];
                const b = entities[j];

                if (a.immovable || b.immovable) {
                    if (a.immovable && b.immovable) continue;
                    PhysicsSim._resolveImmovableCollision(a.immovable ? b : a, a.immovable ? a : b, radiusXMul, radiusYMul);
                    continue;
                }

                const rx = (a.hitRadius + b.hitRadius) * radiusXMul;
                const ry = (a.hitRadius + b.hitRadius) * radiusYMul;

                let dx = b.x - a.x;
                let dy = b.y - a.y;

                const nx = dx / rx;
                const ny = dy / ry;
                const distNorm = Math.hypot(nx, ny);

                if (distNorm > 0 && distNorm < 1) {
                    const overlap = (1 - distNorm);

                    let sx = (nx / distNorm) * rx;
                    let sy = (ny / distNorm) * ry;
                    const sLen = Math.hypot(sx, sy) || 1;
                    sx /= sLen;
                    sy /= sLen;

                    const sep = overlap * ((rx + ry) / 2);
                    const moveA = sep * push;
                    const moveB = sep * (1 - push);

                    a.x -= sx * moveA;
                    a.y -= sy * moveA;
                    b.x += sx * moveB;
                    b.y += sy * moveB;

                    const imp = sep * impulse;
                    PhysicsSim._addImpulse(a, -sx * imp, -sy * imp);
                    PhysicsSim._addImpulse(b,  sx * imp,  sy * imp);
                }
            }
        }
    }

    static _addImpulse(e, ix, iy) {
        if (e.pushVx !== undefined) {
            e.pushVx += ix;
            e.pushVy += iy;
        } else {
            e.vx += ix;
            e.vy += iy;
        }
    }

    static _resolveImmovableCollision(entity, obstacle, radiusXMul, radiusYMul) {
        const bodies = obstacle.collisionBodies ?? [{
            x: 0, y: 0,
            radiusX: obstacle.hitRadius * radiusXMul,
            radiusY: obstacle.hitRadius * radiusYMul
        }];
        for (const body of bodies) {
            const cx = obstacle.x + body.x, cy = obstacle.y + body.y;
            const rx = body.radiusX + entity.hitRadius * radiusXMul;
            const ry = body.radiusY + entity.hitRadius * radiusYMul;
            let dx = entity.x - cx, dy = entity.y - cy;
            let distance = Math.hypot(dx / rx, dy / ry);
            if (distance >= 1) continue;
            if (distance === 0) { dx = rx; dy = 0; distance = 1; }
            entity.x = cx + dx / distance;
            entity.y = cy + dy / distance;
            const nx = dx / (rx * rx), ny = dy / (ry * ry);
            const length = Math.hypot(nx, ny);
            for (const [vx, vy] of [['vx', 'vy'], ['pushVx', 'pushVy']]) {
                if (entity[vx] === undefined) continue;
                const inward = (entity[vx] * nx + entity[vy] * ny) / length;
                if (inward < 0) {
                    entity[vx] -= inward * nx / length;
                    entity[vy] -= inward * ny / length;
                }
            }
        }
    }

    static findContactPoint(weapon, p1, p2, obstacles, cfg = {}) {
        const samples = cfg.samples ?? 8;
        const cableRadius = cfg.cableRadius ?? 4;
        let deepest = null;
        const points = [];

        if (weapon.cablePoint) {
            for (let i = 1; i < samples; i++) {
                const pt = weapon.cablePoint(p1, p2, i / samples);
                points.push({ ...pt, radius: cableRadius, kind: 'chain' });
            }
        }

        const discs = weapon.getSawPositions?.(p1, p2) ?? [];
        for (const disc of discs) {
            points.push({ ...disc, radius: weapon.discRadius ?? 14, kind: 'disc' });
        }

        for (const obstacle of obstacles) {
            if (!obstacle.immovable || obstacle.state === 'dying' || obstacle.state === 'dead') continue;
            const bodies = obstacle.collisionBodies ?? [{
                x: 0, y: 0,
                radiusX: obstacle.hitRadius,
                radiusY: obstacle.hitRadius
            }];

            for (const body of bodies) {
                const cx = obstacle.x + body.x, cy = obstacle.y + body.y;
                for (const point of points) {
                    const rx = body.radiusX + point.radius;
                    const ry = body.radiusY + point.radius;
                    let dx = point.x - cx;
                    let dy = point.y - cy;
                    let distance = Math.hypot(dx / rx, dy / ry);
                    if (distance >= 1) continue;
                    if (distance === 0) {
                        dx = -(p2.y - p1.y); dy = p2.x - p1.x;
                        if (!dx && !dy) dy = -1;
                        distance = Math.hypot(dx / rx, dy / ry);
                        dx *= 0.001; dy *= 0.001; distance *= 0.001;
                    }
                    const sx = dx / distance - dx;
                    const sy = dy / distance - dy;
                    const depth = Math.hypot(sx, sy);
                    if (!deepest || depth > deepest.depth) {
                        deepest = { obstacle, x: point.x, y: point.y, sx, sy, depth, kind: point.kind };
                    }
                }
            }
        }
        return deepest;
    }
}
