const FLAME_PX = 4;

export class FlameParticle {

    constructor(x, y, baseColor = [255, 190, 110], opts = {}) {
        const rise = opts.rise ?? 48;
        const width = opts.width ?? 28;
        const sizeScale = opts.sizeScale ?? 1;

        this.x = x + (Math.random() - 0.5) * width;
        this.y = y + (Math.random() - 0.5) * 4;

        const targetRise = rise * (0.55 + Math.random() * 0.6);

        this.vy = -(targetRise * 0.14);
        this.vx = (Math.random() - 0.5) * 0.9;

        this.swayPhase = Math.random() * Math.PI * 2;
        this.swaySpeed = 0.16 + Math.random() * 0.14;
        this.swayAmp = 0.5 + Math.random() * 0.9;

        this.sizeArt = Math.max(1, Math.round((2 + ((Math.random() * 3) | 0)) * sizeScale));

        this.life = 20 + ((Math.random() * 16) | 0);
        this.maxLife = this.life;

        this.base = baseColor;
    }

    get done() {
        return this.life <= 0;
    }

    update() {
        this.swayPhase += this.swaySpeed;
        this.x += this.vx + Math.sin(this.swayPhase) * this.swayAmp;
        this.y += this.vy;

        this.vy *= 0.9;
        this.vx *= 0.92;
        this.life--;
    }

    _colorFor(t) {
        const [r, g, b] = this.base;
        if (t > 0.6) {

            const k = (t - 0.6) / 0.4;
            const rr = Math.round(r + (255 - r) * k);
            const gg = Math.round(g + (255 - g) * k);
            const bb = Math.round(b + (235 - b) * k);
            return `rgb(${rr}, ${gg}, ${bb})`;
        }

        const k = t / 0.6;
        const rr = Math.round(120 + (r - 120) * k);
        const gg = Math.round(30 + (g - 30) * k);
        const bb = Math.round(20 + (b - 20) * k);
        return `rgb(${rr}, ${gg}, ${bb})`;
    }

    draw(ctx) {
        const t = this.life / this.maxLife;

        const sizeArt = Math.max(1, Math.round(this.sizeArt * (0.4 + t * 0.6)));
        const s = sizeArt * FLAME_PX;

        const px = Math.round(this.x / FLAME_PX) * FLAME_PX;
        const py = Math.round(this.y / FLAME_PX) * FLAME_PX;

        ctx.globalAlpha = Math.max(0, t) * 0.85;
        ctx.fillStyle = this._colorFor(t);
        ctx.fillRect(px - s / 2, py - s / 2, s, s);
    }
}
