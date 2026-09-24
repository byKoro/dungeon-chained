export class Physics {
    // Tensão elástica entre os jogadores
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

    // Distância perpendicular entre um ponto e um segmento de linha (usado para as armas na corrente)
    static distToSegment(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    }

    // Colisão com caixas/obstáculos
    static resolveBoxCollisions(entity, boxes) {
        boxes.forEach(b => {
            const nearestX = Math.max(b.x, Math.min(entity.x, b.x + b.w));
            const nearestY = Math.max(b.y, Math.min(entity.y, b.y + b.h));
            const distX = entity.x - nearestX;
            const distY = entity.y - nearestY;
            const dist = Math.hypot(distX, distY);
            const r = entity.hitRadius || 16;

            if (dist < r) {
                const overlap = r - dist;
                if (dist === 0) {
                    entity.x += overlap;
                } else {
                    entity.x += (distX / dist) * overlap;
                    entity.y += (distY / dist) * overlap;
                }
            }
        });
    }
}