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

    // Colisão entre entidades (players e inimigos) com empurrão mútuo.
    // A colisão é ANISOTRÓPICA (elíptica): mais rígida no eixo vertical
    // (não dá pra subir em cima do outro) e mais permissiva no horizontal
    // (dá pra chegar perto lado a lado, com um empurrão elástico).
    static resolveEntityCollisions(entities, opts = {}) {
        // Multiplicadores do raio de colisão por eixo.
        // radiusY maior => bloqueio vertical forte. radiusX menor => folga lateral.
        const radiusXMul = opts.radiusXMul ?? 0.72; // sobreposição horizontal permitida
        const radiusYMul = opts.radiusYMul ?? 1.15; // vertical mais rígido
        const push = opts.push ?? 0.5;              // 0.5 = cada um cede metade
        const impulse = opts.impulse ?? 0.35;       // quanto do empurrão vira velocidade

        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const a = entities[i];
                const b = entities[j];

                const rx = (a.hitRadius + b.hitRadius) * radiusXMul;
                const ry = (a.hitRadius + b.hitRadius) * radiusYMul;

                let dx = b.x - a.x;
                let dy = b.y - a.y;

                // Distância no espaço "normalizado" pelos raios elípticos
                const nx = dx / rx;
                const ny = dy / ry;
                const distNorm = Math.hypot(nx, ny);

                if (distNorm > 0 && distNorm < 1) {
                    // Estão se sobrepondo. Calcula quanto e para qual direção separar.
                    const overlap = (1 - distNorm);

                    // Direção de separação de volta para o espaço real (respeita a elipse)
                    let sx = (nx / distNorm) * rx;
                    let sy = (ny / distNorm) * ry;
                    const sLen = Math.hypot(sx, sy) || 1;
                    sx /= sLen;
                    sy /= sLen;

                    // Deslocamento total necessário (aprox.), dividido entre os dois
                    const sep = overlap * ((rx + ry) / 2);
                    const moveA = sep * push;
                    const moveB = sep * (1 - push);

                    a.x -= sx * moveA;
                    a.y -= sy * moveA;
                    b.x += sx * moveB;
                    b.y += sy * moveB;

                    // Empurrão que vira velocidade (sensação de se empurrar).
                    // Entidades com pushVx/pushVy (inimigos) recebem nesse campo
                    // dedicado, para o empurrão não ser engolido pela IA de ataque.
                    const imp = sep * impulse;
                    Physics._addImpulse(a, -sx * imp, -sy * imp);
                    Physics._addImpulse(b,  sx * imp,  sy * imp);
                }
            }
        }
    }

    // Aplica um impulso de empurrão. Se a entidade tiver um canal de empurrão
    // dedicado (pushVx/pushVy), usa-o; senão soma direto em vx/vy.
    static _addImpulse(e, ix, iy) {
        if (e.pushVx !== undefined) {
            e.pushVx += ix;
            e.pushVy += iy;
        } else {
            e.vx += ix;
            e.vy += iy;
        }
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