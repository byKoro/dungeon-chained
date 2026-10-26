export class LensSplatter {
    constructor(canvas) {
        this.canvas = canvas;
        this.splats = [];
    }

    clear() { this.splats = []; }

    trigger(sx, sy, power = 1) {
        const { width: W, height: H } = this.canvas;
        const cell = Math.max(4, Math.round(Math.min(W, H) / 110));
        const n = 1 + Math.round(Math.random() * 2 * power);
        for (let i = 0; i < n; i++) {
            let x, y;
            if (Math.random() < 0.7) {
                x = sx + (Math.random() - 0.5) * W * 0.35;
                y = sy + (Math.random() - 0.5) * H * 0.3;
            } else {
                const left = Math.random() < 0.5;
                x = left ? Math.random() * W * 0.15 : W * (0.85 + Math.random() * 0.15);
                y = Math.random() * H;
            }
            const r = (2.4 + Math.random() * 2.4) * (0.7 + 0.3 * power);
            this.splats.push(this._make(x, y, r, cell));
        }
        while (this.splats.length > 24) this.splats.shift();
    }

    _make(x, y, r, cell) {
        const cells = [];
        const R = Math.ceil(r);
        const ph = Math.random() * Math.PI * 2;
        for (let j = -R - 1; j <= R + 1; j++) {
            for (let i = -R - 1; i <= R + 1; i++) {
                const wob = r * (0.88 + 0.14 * Math.sin(Math.atan2(j, i) * 3 + ph));
                if (i * i + j * j <= wob * wob) cells.push([i, j]);
            }
        }
        for (let k = 0; k < 3; k++) {
            const a = Math.random() * Math.PI * 2, d = r + 1.5 + Math.random() * 2;
            cells.push([Math.round(Math.cos(a) * d), Math.round(Math.sin(a) * d)]);
        }
        const set = new Set(cells.map(c => c.join(',')));
        return {
            x, y, cell, cells, set,
            life: 1, decay: 0.45 + Math.random() * 0.25,
            drip: 0, dripLen: 2 + Math.random() * 5,
            dripCol: Math.round((Math.random() - 0.5) * r)
        };
    }

    update(dt) {
        for (let i = this.splats.length - 1; i >= 0; i--) {
            const s = this.splats[i];
            s.life -= dt * s.decay;
            if (s.drip < s.dripLen) s.drip += dt * 4;
            if (s.life <= 0) this.splats.splice(i, 1);
        }
    }

    draw(ctx) {
        if (!this.splats.length) return;
        ctx.save();
        for (const s of this.splats) {
            const a = Math.min(1, s.life * 1.6) * 0.5;
            const c = s.cell;
            const ox = Math.round(s.x / c) * c, oy = Math.round(s.y / c) * c;
            for (const [i, j] of s.cells) {
                const top = !s.set.has(`${i},${j - 1}`);
                ctx.fillStyle = top ? `rgba(190, 46, 58, ${a})` : `rgba(110, 15, 28, ${a})`;
                ctx.fillRect(ox + i * c, oy + j * c, c, c);
            }
            const base = Math.max(...s.cells.filter(([i]) => i === s.dripCol).map(([, j]) => j), 0);
            ctx.fillStyle = `rgba(96, 11, 24, ${a})`;
            ctx.fillRect(ox + s.dripCol * c, oy + (base + 1) * c, c, Math.floor(s.drip) * c);
        }
        ctx.restore();
    }
}
