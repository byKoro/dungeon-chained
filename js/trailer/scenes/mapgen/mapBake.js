import { floorPredicates, tileAt, MAP_W } from './mapLayout.js';

const T = 16;

export function drawTile16(ctx, img, t, dx, dy, dw = T, dh = T) {
    ctx.drawImage(img, (t % 10) * T, ((t / 10) | 0) * T, T, T, dx, dy, dw, dh);
}

function drawSpec(ctx, img, s, dx, dy) {
    drawTile16(ctx, img, s.t, dx, dy);
    if (s.ov) {
        const o = s.ov;
        ctx.drawImage(img, (o.t % 10) * T + o.sx, ((o.t / 10) | 0) * T, o.sw, T, dx + o.sx, dy, o.sw, T);
    }
}

function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w * T; c.height = h * T;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    return c;
}

function silhouette(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#fff6ec';
    ctx.fillRect(0, 0, c.width, c.height);
    return c;
}

export function bakeDungeon(D, img) {
    for (const R of D.rooms) {
        const pred = floorPredicates(D, R.id);
        const base = canvas(R.w, R.h), front = canvas(R.w, R.h);
        const bctx = base.getContext('2d'), fctx = front.getContext('2d');
        for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) {
            const gx = R.gx + x, gy = R.gy + y;
            const s = tileAt(pred, gx, gy);
            if (!s || s.bad) continue;
            drawSpec(bctx, img, s, x * T, y * T);
            if (s.front && D.cover[gy * MAP_W + gx] < 0) drawSpec(fctx, img, s, x * T, y * T);
        }
        for (const p of R.props) drawTile16(bctx, img, p.index, (p.gx - R.gx) * T, (p.gy - R.gy) * T);
        R.bake = { base, front, flash: silhouette(base) };
    }

    const glob = floorPredicates(D);
    for (const C of D.corridors) {
        const b = C.bbox;
        const base = canvas(b.w, b.h);
        const ctx = base.getContext('2d');
        for (const [x, y] of C.cover) {
            const s = tileAt(glob, x, y);
            if (!s || s.bad) continue;
            drawSpec(ctx, img, s, (x - b.x) * T, (y - b.y) * T);
        }
        C.bake = { base, flash: silhouette(base) };
    }
}
