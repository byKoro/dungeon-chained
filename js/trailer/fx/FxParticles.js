/**
 * FxParticles — partículas de FOGO do trailer (cena do boss): brasas,
 * bolas de fogo de explosão e pedaços de pedra (tiles do cenário) voando.
 * Desenhadas por quem as possui, no espaço que estiver no ctx (mundo ou tela),
 * normalmente DEPOIS da iluminação (são emissivas).
 *
 * update(steps) avança em passos de 60 Hz (respeita a câmera lenta de quem chama).
 */

const EMBER_COLORS = ['255, 214, 120', '255, 150, 60', '255, 96, 40', '220, 50, 40'];

// Folha de explosão (tools/gen_explosion.py): células 32x32, 10 frames x 3 variações.
const EXP_CELL = 32, EXP_FRAMES = 10, EXP_VARIANTS = 3;

export class FxParticles {
    /** @param {HTMLImageElement} [explosion] folha assets/fx/explosion.png */
    constructor(explosion = null) { this.list = []; this.explosion = explosion; }
    clear() { this.list.length = 0; }

    /** Brasa: quadradinho aditivo que sobe/deriva e apaga. */
    ember(x, y, vx, vy, { size = 4, life = 1.2, color = null } = {}) {
        this.list.push({
            kind: 'ember', x, y, vx, vy, size, life, max: life,
            color: color ?? EMBER_COLORS[(Math.random() * EMBER_COLORS.length) | 0],
            wob: Math.random() * 10
        });
    }

    /**
     * Bola de fogo: explosão em PIXEL ART (folha na paleta do fogo do boss)
     * por cima de um brilho suave. `r` = raio final aproximado (px de mundo);
     * `delay` = segundos antes de aparecer (cascatas).
     */
    fire(x, y, vx, vy, { r = 60, grow = 1.8, life = 0.7, delay = 0 } = {}) {
        this.list.push({
            kind: 'fire', x, y, vx, vy, r, grow, life, max: life, delay,
            variant: (Math.random() * EXP_VARIANTS) | 0, flip: Math.random() < 0.5
        });
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
        // Bola principal + bolas menores em volta, nascendo em cascata.
        this.fire(x, y, 0, -0.3, { r: 70 * power, life: 0.9, grow: 1 });
        for (let i = 0; i < 5 * power; i++) {
            const a = Math.random() * Math.PI * 2, d = (25 + Math.random() * 45) * power;
            const s = Math.random() * 2.5 * power;
            this.fire(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, Math.cos(a) * s, Math.sin(a) * s,
                { r: (26 + Math.random() * 30) * power, grow: 1, life: 0.6 + Math.random() * 0.5, delay: Math.random() * 0.18 });
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
                if (p.delay > 0) { p.delay -= dt; continue; }
                p.life -= dt;
                if (p.life <= 0) { this.list.splice(i, 1); continue; }
                p.x += p.vx; p.y += p.vy;
                if (p.kind === 'ember') {
                    p.wob += 0.15;
                    p.vx = p.vx * 0.97 + Math.sin(p.wob) * 0.08;
                    p.vy = p.vy * 0.97 - 0.06;          // sobe (calor)
                } else if (p.kind === 'fire') {
                    p.vx *= 0.92; p.vy = p.vy * 0.92 - 0.05;
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
        const sheet = this.explosion;
        const sprite = sheet && sheet.complete && sheet.naturalWidth > 0;
        const fires = this.list.filter(p => p.kind === 'fire' && !(p.delay > 0));

        // 1) Luz: brilho suave atrás de cada bola (aditivo), mais forte no início.
        ctx.globalCompositeOperation = 'lighter';
        for (const p of fires) {
            const k = p.life / p.max, age = 1 - k;
            const r = p.r * (sprite ? 1.6 : 1 + (p.grow - 1) * age);
            const a = sprite ? 0.5 * k * k : 0.85 * k;
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            g.addColorStop(0, `rgba(255, 220, 160, ${a})`);
            g.addColorStop(0.35, `rgba(255, 120, 50, ${a * 0.6})`);
            g.addColorStop(0.75, `rgba(190, 40, 20, ${a * 0.25})`);
            g.addColorStop(1, 'rgba(120, 10, 10, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        }

        // 2) Pixels: a explosão da folha, na grade de pixel (sem suavizar).
        if (sprite) {
            for (const p of fires) {
                const k = p.life / p.max, age = 1 - k;
                const f = Math.min(EXP_FRAMES - 1, Math.floor(age * EXP_FRAMES));
                const px = Math.max(2, Math.round((p.r * 2.15) / EXP_CELL));
                const D = px * EXP_CELL;
                const x0 = Math.round((p.x - D / 2) / px) * px, y0 = Math.round((p.y - D / 2) / px) * px;
                const sx = f * EXP_CELL, sy = p.variant * EXP_CELL;
                ctx.save();
                if (p.flip) { ctx.translate(x0 * 2 + D, 0); ctx.scale(-1, 1); }
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
                ctx.drawImage(sheet, sx, sy, EXP_CELL, EXP_CELL, x0, y0, D, D);
                // Quentura: a mesma arte somada por cima nos primeiros frames.
                const hot = Math.max(0, 1 - age * 2.2);
                if (hot > 0) {
                    ctx.globalCompositeOperation = 'lighter';
                    ctx.globalAlpha = 0.55 * hot;
                    ctx.drawImage(sheet, sx, sy, EXP_CELL, EXP_CELL, x0, y0, D, D);
                }
                ctx.restore();
            }
        }

        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 1;
        for (const p of this.list) {
            const k = p.life / p.max;
            if (p.kind === 'ember') {
                const s = Math.max(1, Math.round(p.size * (0.5 + 0.5 * k)));
                ctx.fillStyle = `rgba(${p.color}, ${Math.min(1, k * 1.6)})`;
                ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
            }
        }
        ctx.restore();
    }
}
