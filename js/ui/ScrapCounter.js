import { drawText, measureText } from './PixelFont.js';
import { FRAME } from './PixelButton.js';

const REDUCED_MOTION = typeof window !== 'undefined' && !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICON = { sx: 3, sy: 3, w: 10, h: 10 };
const PAD = 3;
const H = 16;
const ROLL_RATE = 9;
const MIN_DIGITS = 2;

// Contador de sucata no topo da tela: número rolando até o saldo e um pulinho a cada ganho.
export class ScrapCounter {
    constructor({ getAmount, frames = [] }) {
        this.getAmount = getAmount;
        this.frames = frames;
        this._canvas = document.createElement('canvas');
        this._ctx = this._canvas.getContext('2d');
        this.reset();
    }

    reset() {
        this.shown = this.getAmount?.() ?? 0;
        this.target = this.shown;
        this.hop = 0;
        this.hopV = 0;
        this.flash = 0;
        this._key = null;
        this._last = null;
    }

    _update(dt) {
        const amount = this.getAmount?.() ?? 0;
        if (amount > this.target) {
            this.hopV -= REDUCED_MOTION ? 40 : 110;
            this.flash = 1;
        }
        this.target = amount;
        const diff = this.target - this.shown;
        if (Math.abs(diff) < 0.5) this.shown = this.target;
        else this.shown += Math.sign(diff) * Math.max(1, Math.abs(diff)) * Math.min(1, dt * ROLL_RATE);

        this.hopV += (-500 * this.hop - 18 * this.hopV) * dt;
        this.hop = Math.min(0, this.hop + this.hopV * dt);
        if (this.hop === 0 && this.hopV > 0) this.hopV = 0;
        this.flash = Math.max(0, this.flash - dt * 4);
    }

    _render(value, lit) {
        const text = String(value).padStart(MIN_DIGITS, '0');
        const key = `${text}|${lit}`;
        if (key === this._key) return this._canvas;
        this._key = key;

        const textW = measureText(text);
        const W = PAD + ICON.w + 3 + textW + PAD + 1;
        const c = this._canvas, g = this._ctx;
        c.width = W + 1; c.height = H + 1;
        g.clearRect(0, 0, c.width, c.height);
        const rect = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
        const chamfer = (x, y, w, h, col) => { rect(x + 1, y, w - 2, h, col); rect(x, y + 1, w, h - 2, col); };

        g.globalAlpha = 0.45; chamfer(1, 1, W, H, '#000'); g.globalAlpha = 1;
        chamfer(0, 0, W, H, FRAME.outline);
        chamfer(1, 1, W - 2, H - 2, FRAME.stone);
        rect(2, 1, W - 4, 1, FRAME.stoneLight);
        rect(2, H - 2, W - 4, 1, FRAME.stoneDark);
        rect(2, 2, W - 4, H - 4, FRAME.well);

        const img = this.frames[0];
        if (img?.complete && img.naturalWidth > 0) {
            g.drawImage(img, ICON.sx, ICON.sy, ICON.w, ICON.h, PAD, (H - ICON.h) >> 1, ICON.w, ICON.h);
        }
        const tx = PAD + ICON.w + 3, ty = (H - 5) >> 1;
        drawText(g, text, tx, ty + 1, '#000');
        drawText(g, text, tx, ty, lit ? '#fff4c8' : '#efe3c2');
        return c;
    }

    draw(ctx, W, Hs, scale) {
        const now = performance.now();
        const dt = this._last === null ? 0 : Math.min(0.05, (now - this._last) / 1000);
        this._last = now;
        this._update(dt);

        const art = this._render(Math.round(this.shown), this.flash > 0.5);
        const s = Math.max(2, scale | 0);
        const dw = art.width * s, dh = art.height * s;
        const x = Math.round((W - dw) / 2);
        const y = Math.round(Math.max(8, s * 3) + this.hop * s / 4);

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(art, x, y, dw, dh);
        ctx.restore();
    }
}
