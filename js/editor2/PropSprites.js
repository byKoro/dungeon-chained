import { ANIMATED_PROPS, propFrameIndex } from '../config/PropConfig.js';

export class PropSprites {
    constructor(defs = ANIMATED_PROPS) {
        this.defs = defs;
        this.images = {};
        this._pending = [];
        for (const [type, def] of Object.entries(defs)) {
            this.images[type] = def.frames.map(src => {
                const img = new Image();
                this._pending.push(new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = () => {
                        console.warn(`Prop sem imagem: ${src}`);
                        resolve();
                    };
                }));
                img.src = src;
                return img;
            });
        }
    }

    whenReady() {
        return Promise.all(this._pending);
    }

    frame(type, ms) {
        const def = this.defs[type];
        const frames = this.images[type];
        if (!def || !frames) return null;
        const img = frames[propFrameIndex(def, ms)];
        return img && img.complete && img.naturalWidth > 0 ? img : null;
    }

    // Desenha o prop ocupando w×h tiles a partir de (dx, dy).
    draw(ctx, type, dx, dy, tilePx, ms, flip = false) {
        const def = this.defs[type];
        const img = this.frame(type, ms);
        if (!def || !img) return false;
        const w = def.w * tilePx, h = def.h * tilePx;
        if (flip) {
            ctx.save();
            ctx.translate(dx + w, dy);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, w, h);
            ctx.restore();
        } else {
            ctx.drawImage(img, dx, dy, w, h);
        }
        return true;
    }
}
