export class BloodCanvas {
    constructor(width, height, palette = null, pixel = 4) {
        this.width = width;
        this.height = height;

        this.px = pixel;

        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext("2d");
        this.ctx.imageSmoothingEnabled = false;

        this.palette = (palette && palette.length)
            ? palette
            : ["#4a0612", "#5c0a18", "#6e0f1c", "#480810", "#3a0510"];

        this.blendMode = "multiply";

        this.drawAlpha = 0.9;

        this.zones = [];
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.zones = [];
    }

    addZone(x, y, radius) {
        this.zones.push({ x, y, r: radius });

        if (this.zones.length > 200) this.zones.shift();
    }

    _color() {
        return this.palette[(Math.random() * this.palette.length) | 0];
    }

    isBloodZone(x, y) {
        for (let i = 0; i < this.zones.length; i++) {
            const z = this.zones[i];
            const dx = x - z.x, dy = y - z.y;
            if (dx * dx + dy * dy <= z.r * z.r) return true;
        }
        return false;
    }

    _snap(v) { return Math.round(v / this.px) * this.px; }

    stampFootprint(x, y, angle, intensity = 1) {
        const ctx = this.ctx;
        const px = this.px;
        const len = px * (2 + Math.round(2 * intensity));
        const wid = px * (1 + Math.round(1 * intensity));

        const cos = Math.cos(angle), sin = Math.sin(angle);

        const reach = Math.max(len, wid);
        const cx = this._snap(x), cy = this._snap(y);

        ctx.save();
        ctx.globalAlpha = 0.5 + 0.5 * intensity;
        for (let gy = -reach; gy <= reach; gy += px) {
            for (let gx = -reach; gx <= reach; gx += px) {

                const lx = gx * cos + gy * sin;
                const ly = -gx * sin + gy * cos;
                const nx = lx / len, ny = ly / wid;
                if (nx * nx + ny * ny <= 1 && Math.random() < 0.85) {
                    ctx.fillStyle = this._color();

                    ctx.fillRect(cx + this._snap(gx), cy + this._snap(gy), px, px);
                }
            }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    stampBlob(cx, cy, rx, ry, px = this.px, density = 0.92) {
        const ctx = this.ctx;

        const x0 = Math.floor((cx - rx) / px) * px;
        const y0 = Math.floor((cy - ry) / px) * px;
        const x1 = Math.ceil((cx + rx) / px) * px;
        const y1 = Math.ceil((cy + ry) / px) * px;

        for (let y = y0; y <= y1; y += px) {
            for (let x = x0; x <= x1; x += px) {

                const bx = x + px / 2;
                const by = y + px / 2;
                const nx = (bx - cx) / rx;
                const ny = (by - cy) / ry;
                const d = nx * nx + ny * ny;

                const edgeNoise = (Math.random() - 0.5) * 0.35;
                if (d + edgeNoise <= 1) {
                    if (Math.random() <= density) {
                        ctx.fillStyle = this._color();
                        ctx.fillRect(x, y, px, px);
                    }
                }
            }
        }
    }

    stampSpecks(cx, cy, spread, count, px = this.px) {
        const ctx = this.ctx;
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * spread;
            const bx = Math.round((cx + Math.cos(a) * r) / px) * px;
            const by = Math.round((cy + Math.sin(a) * r) / px) * px;

            ctx.fillStyle = this._color();
            ctx.fillRect(bx, by, px, px);
        }
    }

    stampSplat(x, y, scale = 1) {
        const rx = (6 + Math.random() * 6) * scale;
        const ry = (4 + Math.random() * 5) * scale;
        this.stampBlob(x, y, rx, ry, this.px, 0.9);
        this.stampSpecks(x, y, (18 + Math.random() * 14) * scale, 8 + ((Math.random() * 8) | 0), this.px);

        this.addZone(x, y, Math.max(rx, ry) + 3);
    }

    stampPool(x, y, scale = 1) {
        const blobs = 4 + ((Math.random() * 4) | 0);
        for (let i = 0; i < blobs; i++) {
            const ox = (Math.random() - 0.5) * 22 * scale;
            const oy = (Math.random() - 0.5) * 14 * scale;
            const rx = (10 + Math.random() * 12) * scale;
            const ry = (7 + Math.random() * 8) * scale;
            this.stampBlob(x + ox, y + oy, rx, ry, this.px, 0.94);
        }

        this.stampSpecks(x, y, 40 * scale, 20 + ((Math.random() * 16) | 0), this.px);

        this.addZone(x, y, 26 * scale);
    }

    draw(ctx) {

        const prevOp = ctx.globalCompositeOperation;
        const prevAlpha = ctx.globalAlpha;
        ctx.globalCompositeOperation = this.blendMode;
        ctx.globalAlpha = this.drawAlpha;
        ctx.drawImage(this.canvas, 0, 0);
        ctx.globalCompositeOperation = prevOp;
        ctx.globalAlpha = prevAlpha;
    }
}
