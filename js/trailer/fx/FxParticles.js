const PALETTE = [
    [58, 9, 8], [97, 64, 58], [92, 19, 34], [125, 24, 24],
    [159, 50, 50], [190, 81, 47], [221, 144, 74], [242, 213, 213]
];
const EMBER_COLORS = ['242, 213, 213', '221, 144, 74', '190, 81, 47', '159, 50, 50'];
const MAX_SPAN = 6000;

const EXP_CELL = 32, EXP_FRAMES = 10, EXP_VARIANTS = 3;

export class FxParticles {
    constructor(explosion = null, { pixel = 0 } = {}) {
        this.list = [];
        this.rays = [];
        this.explosion = explosion;
        this.pixel = pixel;
        this._buf = null;
    }
    clear() { this.list.length = 0; this.rays = []; this._last = null; }

    ember(x, y, vx, vy, { size = 4, life = 1.2, color = null, heat = 1, float = true, drag = 0.97 } = {}) {
        this.list.push({
            kind: 'ember', x, y, vx, vy, size, life, max: life, heat, float, drag,
            color: color ?? EMBER_COLORS[(Math.random() * EMBER_COLORS.length) | 0],
            wob: Math.random() * 10
        });
    }

    fire(x, y, vx, vy, { r = 60, grow = 1.8, life = 0.7, delay = 0 } = {}) {
        this.list.push({
            kind: 'fire', x, y, vx, vy, r, grow, life, max: life, delay,
            variant: (Math.random() * EXP_VARIANTS) | 0, flip: Math.random() < 0.5
        });
    }

    chunk(x, y, vx, vy, tileset, index, { size = 26, life = 1.4 } = {}) {
        this.list.push({
            kind: 'chunk', x, y, vx, vy, z: 0, vz: 3 + Math.random() * 6,
            size, life, max: life, ts: tileset, index,
            rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5
        });
    }

    blast(x, y, power = 1, tileset = null, tiles = null) {
        this.fire(x, y, 0, -0.3, { r: 80 * power, life: 0.95, grow: 1 });
        for (let i = 0; i < 3 * power; i++) {
            const a = Math.random() * Math.PI * 2, d = (35 + Math.random() * 45) * power;
            const s = Math.random() * 2.2 * power;
            this.fire(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, Math.cos(a) * s, Math.sin(a) * s,
                { r: (45 + Math.random() * 30) * power, grow: 1, life: 0.65 + Math.random() * 0.45, delay: Math.random() * 0.18 });
        }
        for (let i = 0; i < 12 * power; i++) {
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
        if (steps > 0) this._ver = (this._ver ?? 0) + 1;
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
                    p.vx = p.vx * p.drag + (p.float ? Math.sin(p.wob) * 0.08 : 0);
                    p.vy = p.vy * p.drag - (p.float ? 0.06 : 0);
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
        if (!this.list.length && !this.rays.length) return;
        ctx.save();
        ctx.imageSmoothingEnabled = false;

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
        const sprite = !!(sheet && sheet.complete && sheet.naturalWidth > 0);
        const fires = this.list.filter(p => p.kind === 'fire' && !(p.delay > 0));

        ctx.globalCompositeOperation = 'lighter';
        for (const p of fires) {
            const k = p.life / p.max;
            const r = p.r * (sprite ? 1.6 : 1 + (p.grow - 1) * (1 - k));
            const a = sprite ? 0.5 * k * k : 0.85 * k;
            const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
            g.addColorStop(0, `rgba(255, 220, 160, ${a})`);
            g.addColorStop(0.35, `rgba(255, 120, 50, ${a * 0.6})`);
            g.addColorStop(0.75, `rgba(190, 40, 20, ${a * 0.25})`);
            g.addColorStop(1, 'rgba(120, 10, 10, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        }
        ctx.globalCompositeOperation = 'source-over';

        if (this.pixel > 0) this._drawPixel(ctx, fires);
        else this._drawRaw(ctx, fires, sprite);
        ctx.restore();
    }

    _drawPixel(ctx, fires) {
        const P = this.pixel;
        const embers = this.list.filter(p => p.kind === 'ember' && !(p.delay > 0));
        const rays = this.rays;
        if (!fires.length && !embers.length && !rays.length) return;
        const L = this._last;
        if (L && L.ver === this._ver && L.P === P) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(this._buf, 0, 0, L.w, L.h, L.bx, L.by, L.w * P, L.h * P);
            return;
        }
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of fires) {
            const h = p.r * 1.1;
            x0 = Math.min(x0, p.x - h); y0 = Math.min(y0, p.y - h);
            x1 = Math.max(x1, p.x + h); y1 = Math.max(y1, p.y + h);
        }
        for (const p of embers) {
            x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
            x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
        }
        for (const r of rays) {
            const ex = r.x + Math.cos(r.ang) * r.len, ey = r.y + Math.sin(r.ang) * r.len, hw = r.wid / 2;
            x0 = Math.min(x0, r.x - hw, ex - hw); y0 = Math.min(y0, r.y - hw, ey - hw);
            x1 = Math.max(x1, r.x + hw, ex + hw); y1 = Math.max(y1, r.y + hw, ey + hw);
        }
        if (x1 - x0 > MAX_SPAN) { const c = (x0 + x1) / 2; x0 = c - MAX_SPAN / 2; x1 = c + MAX_SPAN / 2; }
        if (y1 - y0 > MAX_SPAN) { const c = (y0 + y1) / 2; y0 = c - MAX_SPAN / 2; y1 = c + MAX_SPAN / 2; }
        const bx = Math.floor(x0 / P) * P, by = Math.floor(y0 / P) * P;
        const w = Math.ceil((x1 - bx) / P) + 2, h = Math.ceil((y1 - by) / P) + 2;

        if (!this._buf) {
            this._buf = document.createElement('canvas');
            this._bctx = this._buf.getContext('2d', { willReadFrequently: true });
        }
        const buf = this._buf, b = this._bctx;
        if (buf.width < w || buf.height < h) { buf.width = Math.max(buf.width, w); buf.height = Math.max(buf.height, h); }
        b.setTransform(1, 0, 0, 1, 0, 0);
        b.globalCompositeOperation = 'source-over';
        b.globalAlpha = 1;
        b.clearRect(0, 0, w, h);

        const N = w * h;
        if (!this._heat || this._heat.length < N) { this._heat = new Float32Array(N); this._cov = new Uint8Array(N); }
        const heat = this._heat, cov = this._cov;
        heat.fill(0, 0, N); cov.fill(0, 0, N);
        const gx0 = bx / P, gy0 = by / P;
        for (const p of fires) {
            const age = 1 - p.life / p.max;
            const R = Math.max(2, (p.r * 1.07) / P) * (0.4 + 0.6 * easeOut(Math.min(1, age * 1.7)));
            const hot = 1.3 - 1.25 * Math.pow(age, 1.25);
            const hollow = Math.max(0, (age - 0.5) / 0.5);
            const cx = (p.x - bx) / P, cy = (p.y - by) / P;
            const ix0 = Math.max(0, Math.floor(cx - R - 2)), ix1 = Math.min(w - 1, Math.ceil(cx + R + 2));
            const iy0 = Math.max(0, Math.floor(cy - R - 2)), iy1 = Math.min(h - 1, Math.ceil(cy + R + 2));
            const seed = p.variant * 37.1 + (p.flip ? 11 : 0);
            for (let y = iy0; y <= iy1; y++) {
                for (let x = ix0; x <= ix1; x++) {
                    const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
                    const nz = vnoise((gx0 + x) * 0.2 + seed, (gy0 + y) * 0.2 + age * 1.2);
                    const d = Math.hypot(dx, dy) / R + (nz - 0.5) * 0.45;
                    if (d >= 1) continue;
                    if (age > 0.72 && nz < (age - 0.72) * 2.6) continue;
                    let hv = (1 - d) * hot + (nz - 0.5) * 0.05;
                    if (hollow > 0 && d < hollow * 0.7) hv *= 0.25;
                    const i = y * w + x;
                    cov[i] = 1;
                    heat[i] = Math.max(heat[i], hv) + Math.max(0, hv) * 0.12;
                }
            }
        }
        for (const r of rays) {
            const ox = (r.x - bx) / P, oy = (r.y - by) / P;
            const L = r.len / P, half0 = r.wid / (2 * P);
            const c = Math.cos(r.ang), s = Math.sin(r.ang);
            const ex = ox + c * L, ey = oy + s * L;
            const ix0 = Math.max(0, Math.floor(Math.min(ox, ex) - half0 - 1)), ix1 = Math.min(w - 1, Math.ceil(Math.max(ox, ex) + half0 + 1));
            const iy0 = Math.max(0, Math.floor(Math.min(oy, ey) - half0 - 1)), iy1 = Math.min(h - 1, Math.ceil(Math.max(oy, ey) + half0 + 1));
            for (let y = iy0; y <= iy1; y++) {
                for (let x = ix0; x <= ix1; x++) {
                    const dx = x + 0.5 - ox, dy = y + 0.5 - oy;
                    const along = dx * c + dy * s;
                    if (along < 0 || along > L) continue;
                    const f = along / L;
                    const half = half0 * Math.pow(1 - f, 0.85) + 0.35;
                    const q = Math.abs(-dx * s + dy * c);
                    if (q > half) continue;
                    const hv = (1.4 - 0.45 * f - 0.6 * (q / half)) * (0.75 + 0.25 * r.heat);
                    if (hv <= 0.1) continue;
                    const i = y * w + x;
                    cov[i] = 1;
                    heat[i] = Math.max(heat[i], hv);
                }
            }
        }
        for (const p of embers) {
            const k = p.life / p.max;
            const s = Math.max(1, Math.round(p.size * (0.5 + 0.5 * k) / P));
            const x = Math.round((p.x - bx) / P - s / 2), y = Math.round((p.y - by) / P - s / 2);
            const hv = (p.heat ?? 1) * (0.25 + 0.75 * k);
            for (let yy = y; yy < y + s; yy++) for (let xx = x; xx < x + s; xx++) {
                if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
                const i = yy * w + xx;
                cov[i] = 1; heat[i] = Math.max(heat[i], hv);
            }
        }

        let img;
        try { img = b.createImageData(w, h); } catch { return; }
        const d = img.data;
        for (let i = 0; i < N; i++) {
            if (!cov[i]) continue;
            const c = heatColor(heat[i]);
            const o = i * 4;
            d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
        }
        b.putImageData(img, 0, 0);
        this._last = { ver: this._ver, P, bx, by, w, h };
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buf, 0, 0, w, h, bx, by, w * P, h * P);
    }

    _drawRaw(ctx, fires, sprite) {
        if (sprite) {
            for (const p of fires) {
                const k = p.life / p.max, age = 1 - k;
                const f = Math.min(EXP_FRAMES - 1, Math.floor(age * EXP_FRAMES));
                const px = Math.max(2, Math.round((p.r * 2.15) / EXP_CELL));
                const D = px * EXP_CELL;
                const x0 = Math.round((p.x - D / 2) / px) * px, y0 = Math.round((p.y - D / 2) / px) * px;
                ctx.save();
                if (p.flip) { ctx.translate(x0 * 2 + D, 0); ctx.scale(-1, 1); }
                ctx.drawImage(this.explosion, f * EXP_CELL, p.variant * EXP_CELL, EXP_CELL, EXP_CELL, x0, y0, D, D);
                ctx.restore();
            }
        }
        ctx.globalCompositeOperation = 'lighter';
        for (const p of this.list) {
            if (p.kind !== 'ember' || p.delay > 0) continue;
            const k = p.life / p.max;
            const s = Math.max(1, Math.round(p.size * (0.5 + 0.5 * k)));
            ctx.fillStyle = `rgba(${p.color}, ${Math.min(1, k * 1.6)})`;
            ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
        }
    }
}

function heatColor(hv) {
    if (hv > 0.9) return PALETTE[7];
    if (hv > 0.72) return PALETTE[6];
    if (hv > 0.54) return PALETTE[5];
    if (hv > 0.38) return PALETTE[4];
    if (hv > 0.24) return PALETTE[3];
    if (hv > 0.1) return PALETTE[2];
    if (hv > -0.05) return PALETTE[0];
    return PALETTE[1];
}

function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
    return a + (b - a) * sx + (c - a + (d - c - b + a) * sx) * sy;
}
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
