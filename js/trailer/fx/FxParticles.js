/**
 * FxParticles — partículas de FOGO do trailer (cena do boss): brasas,
 * bolas de fogo de explosão e pedaços de pedra (tiles do cenário) voando.
 * Desenhadas por quem as possui, no espaço que estiver no ctx (mundo ou tela),
 * normalmente DEPOIS da iluminação (são emissivas).
 *
 * update(steps) avança em passos de 60 Hz (respeita a câmera lenta de quem chama).
 */

const EMBER_COLORS = ['255, 214, 120', '255, 150, 60', '255, 96, 40', '220, 50, 40'];

export class FxParticles {
    constructor() { this.list = []; }
    clear() { this.list.length = 0; }

    /** Brasa: quadradinho aditivo que sobe/deriva e apaga. */
    ember(x, y, vx, vy, { size = 4, life = 1.2, color = null } = {}) {
        this.list.push({
            kind: 'ember', x, y, vx, vy, size, life, max: life,
            color: color ?? EMBER_COLORS[(Math.random() * EMBER_COLORS.length) | 0],
            wob: Math.random() * 10
        });
    }

    /** Bola de fogo: círculo aditivo que incha e some. */
    fire(x, y, vx, vy, { r = 60, grow = 1.8, life = 0.7 } = {}) {
        this.list.push({ kind: 'fire', x, y, vx, vy, r, grow, life, max: life });
    }

    /** Pedaço de pedra (tile do cenário) arremessado girando. */
    chunk(x, y, vx, vy, tileset, index, { size = 26, life = 1.4 } = {}) {
        this.list.push({
            kind: 'chunk', x, y, vx, vy, z: 0, vz: 3 + Math.random() * 6,
            size, life, max: life, ts: tileset, index,
            rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5
        });
    }

    /** Explosão completa num ponto (fogo + brasas + pedaços). */
    blast(x, y, power = 1, tileset = null, tiles = null) {
        for (let i = 0; i < 7 * power; i++) {
            const a = Math.random() * Math.PI * 2, s = Math.random() * 4 * power;
            this.fire(x + Math.cos(a) * 20, y + Math.sin(a) * 20, Math.cos(a) * s, Math.sin(a) * s,
                { r: (40 + Math.random() * 50) * power, grow: 1.6 + Math.random(), life: 0.5 + Math.random() * 0.5 });
        }
        for (let i = 0; i < 18 * power; i++) {
            const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 11 * power;
            this.ember(x, y, Math.cos(a) * s, Math.sin(a) * s - 2, { size: 3 + Math.random() * 6, life: 0.6 + Math.random() * 1.1 });
        }
        if (tileset && tiles) {
            for (let i = 0; i < 5 * power; i++) {
                const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 9 * power;
                this.chunk(x, y, Math.cos(a) * s, Math.sin(a) * s, tileset, tiles[(Math.random() * tiles.length) | 0],
                    { size: 18 + Math.random() * 26, life: 1 + Math.random() * 0.8 });
            }
        }
    }

    update(steps = 1) {
        const dt = 1 / 60;
        for (let n = 0; n < steps; n++) {
            for (let i = this.list.length - 1; i >= 0; i--) {
                const p = this.list[i];
                p.life -= dt;
                if (p.life <= 0) { this.list.splice(i, 1); continue; }
                p.x += p.vx; p.y += p.vy;
                if (p.kind === 'ember') {
                    p.wob += 0.15;
                    p.vx = p.vx * 0.97 + Math.sin(p.wob) * 0.08;
                    p.vy = p.vy * 0.97 - 0.06;          // sobe (calor)
                } else if (p.kind === 'fire') {
                    p.vx *= 0.92; p.vy = p.vy * 0.92 - 0.12;
                } else {
                    p.vx *= 0.95; p.vy *= 0.95;
                    p.z = Math.max(0, p.z + p.vz); p.vz -= 0.45;
                    p.rot += p.vr;
                }
            }
        }
    }

    draw(ctx) {
        if (!this.list.length) return;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        // Pedaços (normais) primeiro, depois fogo/brasas (aditivos).
        for (const p of this.list) {
            if (p.kind !== 'chunk' || !p.ts?.ready) continue;
            const k = p.life / p.max;
            ctx.save();
            ctx.globalAlpha = Math.min(1, k * 2.5);
            ctx.translate(p.x, p.y - p.z);
            ctx.rotate(p.rot);
            p.ts.draw(ctx, p.index, -p.size / 2, -p.size / 2, p.size, p.size);
            ctx.restore();
        }
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.list) {
            const k = p.life / p.max;
            if (p.kind === 'fire') {
                const r = p.r * (1 + (p.grow - 1) * (1 - k));
                const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
                g.addColorStop(0, `rgba(255, 236, 190, ${0.85 * k})`);
                g.addColorStop(0.35, `rgba(255, 140, 50, ${0.6 * k})`);
                g.addColorStop(0.75, `rgba(200, 40, 20, ${0.28 * k})`);
                g.addColorStop(1, 'rgba(120, 10, 10, 0)');
                ctx.fillStyle = g;
                ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
            } else if (p.kind === 'ember') {
                const s = Math.max(1, Math.round(p.size * (0.5 + 0.5 * k)));
                ctx.fillStyle = `rgba(${p.color}, ${Math.min(1, k * 1.6)})`;
                ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
            }
        }
        ctx.restore();
    }
}
