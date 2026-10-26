import { clamp01, easeIn, hash01 } from '../anim.js';

const ROWS = 15;

export class ArrowWipe {
    constructor(img, { cover = 0.42, hold = 0.12, reveal = 0.5 } = {}) {
        this.img = img;
        this.cover = cover; this.hold = hold; this.reveal = reveal;
        this.t = 0;
        this.shake = 0;
    }
    get covered() { return this.t >= this.cover; }
    get done() { return this.t >= this.cover + this.hold + this.reveal; }
    update(dt) { this.t += dt; }

    draw(ctx) {
        const W = ctx.canvas.width, H = ctx.canvas.height;
        const t = this.t;
        const lead = W * 1.05 - W * 1.45 * easeIn(clamp01(t / this.cover)) ** 0.7;
        const kr = clamp01((t - this.cover - this.hold) / this.reveal);
        const trail = W * 1.35 - W * 1.95 * easeIn(kr) ** 0.75;
        const rowsN = Math.max(ROWS, Math.round(ROWS * H / Math.min(W, H)));
        const rowH = H / rowsN;
        const L = rowH * 1.9;
        const img = this.img;
        const ready = img && img.complete && img.naturalWidth > 0;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        for (let i = 0; i < rowsN; i++) {
            const y0 = i * rowH;
            const a = lead + hash01(i * 3.7) * W * 0.16;
            const b = trail + hash01(i * 9.1 + 4) * W * 0.22;
            if (b <= a || b < 0 || a > W) continue;
            ctx.fillStyle = '#14080c';
            ctx.fillRect(Math.max(0, a + L * 0.35), y0 - 1, Math.min(W, b) - Math.max(0, a + L * 0.35) + 2, rowH + 2);
            for (let lane = 0; lane < 2; lane++) {
                const ly = y0 + rowH * (0.3 + lane * 0.42) + (hash01(i * 5 + lane) - 0.5) * rowH * 0.2;
                const gap = L * (0.78 + 0.25 * hash01(i + lane * 17));
                const off = (t * W * 2.6 + hash01(i * 2 + lane) * gap) % gap;
                for (let x = a + (lane ? gap * 0.45 : 0) - off * 0.15; x < Math.min(W + L, b); x += gap) {
                    ctx.fillStyle = 'rgba(255, 228, 200, 0.16)';
                    ctx.fillRect(x + L * 0.45, ly - 1, L * 0.9, 2);
                    if (ready) {
                        ctx.save();
                        ctx.translate(x + L / 2, ly);
                        ctx.rotate(Math.PI - Math.PI / 2);
                        ctx.drawImage(img, -L / 2, -L / 2, L, L);
                        ctx.restore();
                    } else {
                        ctx.fillStyle = '#d9c9a3';
                        ctx.fillRect(x, ly - 2, L, 4);
                    }
                }
            }
        }
        const flash = Math.max(0, 1 - Math.abs(t - this.cover) / 0.12);
        if (flash > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(160, 20, 24, ${0.35 * flash})`;
            ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();
    }
}
