import { ANIMATED_PROPS, propFrameIndex } from '../config/PropConfig.js';
import { propArtRect } from './PropBodies.js';

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
        return def ? this.frameAt(type, propFrameIndex(def, ms)) : null;
    }

    frameAt(type, index) {
        const frames = this.images[type];
        if (!frames) return null;
        const img = frames[Math.max(0, Math.min(frames.length - 1, index))];
        return img && img.complete && img.naturalWidth > 0 ? img : null;
    }

    // Desenha o prop ocupando w×h tiles a partir de (dx, dy); com `art`, no tamanho nativo e centrado.
    draw(ctx, type, dx, dy, tilePx, ms, flip = false) {
        const def = this.defs[type];
        if (!def) return false;
        return this.drawFrame(ctx, type, propFrameIndex(def, ms), dx, dy, tilePx, flip);
    }

    // `sx`/`sy` escalam a arte a partir do meio da borda de baixo (squash/stretch).
    drawFrame(ctx, type, index, dx, dy, tilePx, flip = false, sx = 1, sy = 1) {
        const def = this.defs[type];
        const img = this.frameAt(type, index);
        if (!def || !img) return false;
        const r = propArtRect(def, dx, dy, tilePx);
        const plain = sx === 1 && sy === 1 && !flip;
        if (plain) {
            ctx.drawImage(img, r.x, r.y, r.w, r.h);
            return true;
        }
        ctx.save();
        ctx.translate(r.x + r.w / 2, r.y + r.h);
        ctx.scale(flip ? -sx : sx, sy);
        ctx.drawImage(img, -r.w / 2, -r.h, r.w, r.h);
        ctx.restore();
        return true;
    }
}
