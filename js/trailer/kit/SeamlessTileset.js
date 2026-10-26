import { Tileset } from '../../core/Tileset.js';

const INSET = 0.02;

export class SeamlessTileset extends Tileset {
    draw(ctx, index, dx, dy, dw, dh) {
        if (!this.ready) return;
        const t = this.tileSize;
        const sx = (index % this.cols) * t;
        const sy = ((index / this.cols) | 0) * t;
        const m = ctx.getTransform();
        const scale = Math.hypot(m.a, m.b) || 1;
        const ov = 1.25 / scale;
        ctx.drawImage(this.img, sx + INSET, sy + INSET, t - INSET * 2, t - INSET * 2,
            dx, dy, dw + ov, dh + ov);
    }
}
