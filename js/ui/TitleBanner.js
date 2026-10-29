import { drawText, measureText } from './PixelFont.js';
import { pixelScale } from './PixelButton.js';

// Título grande no centro da tela (ex.: "SERRA" ao pegar a arma). Tempo de parede: segue animando na pausa.
export class TitleBanner {
    constructor({ color = "#ffd166", now = () => performance.now() } = {}) {
        Object.assign(this, { color, now });
        this.text = null;
        this._canvas = null;
    }

    show(text, seconds = 1.8) {
        this.text = text;
        this.start = this.now();
        this.duration = seconds * 1000;
        const w = measureText(text) + 2, h = 7;
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const g = c.getContext("2d");
        drawText(g, text, 1, 2, "#0b0910");
        drawText(g, text, 0, 1, this.color);
        this._canvas = c;
    }

    clear() {
        this.text = null;
    }

    draw(ctx, canvas) {
        if (!this.text || !this._canvas) return;
        const k = (this.now() - this.start) / this.duration;
        if (k >= 1) { this.text = null; return; }
        const pop = k < 0.12 ? 1 + (1 - k / 0.12) * 0.6 : 1;
        const alpha = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1;
        const s = Math.max(4, Math.round(pixelScale() * 2.5 * pop));
        const dw = this._canvas.width * s, dh = this._canvas.height * s;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this._canvas, Math.round((canvas.width - dw) / 2), Math.round(canvas.height * 0.3 - dh / 2), dw, dh);
        ctx.restore();
    }
}
