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

    // Faixa de brilho que atravessa a arte na diagonal (mesma ideia do brilho da serra largada).
    // `shine` 0..1 = posição da faixa; a máscara é o próprio quadro, então só a arte acende.
    _shineCanvas(img, shine) {
        const W = img.naturalWidth, H = img.naturalHeight;
        const c = this._shine ??= document.createElement("canvas");
        if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = false;
        g.globalCompositeOperation = "source-over";
        g.clearRect(0, 0, W, H);
        const S = Math.max(W, H);
        const travel = -S + shine * 2.2 * S;
        const grad = g.createLinearGradient(travel - S * 0.5, travel - S * 0.5, travel + S * 0.5, travel + S * 0.5);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(0.42, "rgba(255,255,255,0)");
        grad.addColorStop(0.5, "rgba(255,255,255,0.85)");
        grad.addColorStop(0.58, "rgba(255,255,255,0)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = grad;
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = "destination-in";
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = "source-over";
        return c;
    }

    // Borda de 1 pixel de arte em volta da silhueta: a arte deslocada nos 4 lados, pintada, menos a própria arte.
    // Só composição (sem getImageData), então funciona mesmo com a imagem vinda de outra origem.
    _outlineCanvas(img, color) {
        const cache = this._outlines ??= new WeakMap();
        const hit = cache.get(img);
        if (hit?.color === color) return hit.canvas;
        const W = img.naturalWidth, H = img.naturalHeight;
        const c = document.createElement("canvas");
        c.width = W + 2; c.height = H + 2;
        const g = c.getContext("2d");
        g.imageSmoothingEnabled = false;
        for (const [ox, oy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) g.drawImage(img, ox, oy);
        g.globalCompositeOperation = "source-in";
        g.fillStyle = color;
        g.fillRect(0, 0, c.width, c.height);
        g.globalCompositeOperation = "destination-out";
        g.drawImage(img, 1, 1);
        cache.set(img, { color, canvas: c });
        return c;
    }

    // `sx`/`sy` escalam a arte a partir do meio da borda de baixo (squash/stretch).
    // `outline` = { alpha, color }: borda em volta da arte (objeto interagível no alcance).
    drawFrame(ctx, type, index, dx, dy, tilePx, flip = false, sx = 1, sy = 1, shine = null, outline = null) {
        const def = this.defs[type];
        const img = this.frameAt(type, index);
        if (!def || !img) return false;
        const r = propArtRect(def, dx, dy, tilePx);
        if (outline?.alpha > 0 && typeof document !== "undefined") {
            const p = r.w / img.naturalWidth;
            ctx.save();
            ctx.globalAlpha *= outline.alpha;
            this._drawImage(ctx, this._outlineCanvas(img, outline.color), { x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p }, flip, sx, sy);
            ctx.restore();
        }
        if (shine !== null && typeof document !== "undefined") {
            const plain = this._drawImage(ctx, img, r, flip, sx, sy);
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            this._drawImage(ctx, this._shineCanvas(img, shine), r, flip, sx, sy);
            ctx.restore();
            return plain;
        }
        return this._drawImage(ctx, img, r, flip, sx, sy);
    }

    _drawImage(ctx, img, r, flip, sx, sy) {
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
