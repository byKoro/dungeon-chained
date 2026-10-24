export class ScreenGore {
    constructor(canvas) {
        this.canvas = canvas;

        this.pulseT = 1;
        this.pulseDur = 20;
        this.pulsePeak = 0;
        this.drops = [];
    }

    clear() {
        this.pulseT = 1;
        this.pulsePeak = 0;
        this.drops = [];
    }

    get flash() {
        if (this.pulseT >= 1) return 0;
        return this.pulsePeak * Math.sin(Math.PI * this.pulseT);
    }

    triggerFlash(intensity = 1) {

        this.pulsePeak = Math.min(0.3, this.pulsePeak + 0.16 * intensity);
        this.pulseT = 0;
    }

    trigger() {

        const w = this.canvas.width, h = this.canvas.height;
        const n = 4 + ((Math.random() * 4) | 0);
        for (let i = 0; i < n; i++) {

            const edge = (Math.random() * 4) | 0;
            let x, y, vx, vy;
            const sp = 2 + Math.random() * 4;
            if (edge === 0) { x = Math.random() * w; y = -8; vx = (Math.random() - 0.5) * 3; vy = sp; }
            else if (edge === 1) { x = Math.random() * w; y = h + 8; vx = (Math.random() - 0.5) * 3; vy = -sp; }
            else if (edge === 2) { x = -8; y = Math.random() * h; vx = sp; vy = (Math.random() - 0.5) * 3; }
            else { x = w + 8; y = Math.random() * h; vx = -sp; vy = (Math.random() - 0.5) * 3; }

            this.drops.push({
                x, y, vx, vy,
                size: (3 + ((Math.random() * 4) | 0)) * 1,
                life: 26 + ((Math.random() * 22) | 0),
                maxLife: 0,
                color: ["#6e0f1c", "#5c0a18", "#7d1420", "#4a0612"][(Math.random() * 4) | 0]
            });
            const d = this.drops[this.drops.length - 1];
            d.maxLife = d.life;
        }

        while (this.drops.length > 60) this.drops.shift();
    }

    update() {

        if (this.pulseT < 1) {
            this.pulseT = Math.min(1, this.pulseT + 1 / this.pulseDur);
            if (this.pulseT >= 1) this.pulsePeak = 0;
        }
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            d.vx *= 0.96;
            d.vy = d.vy * 0.96 + 0.12;
            d.x += d.vx;
            d.y += d.vy;
            d.life--;
            if (d.life <= 0) this.drops.splice(i, 1);
        }
    }

    draw(ctx) {
        const w = this.canvas.width, h = this.canvas.height;

        if (this.flash > 0.001) {
            ctx.save();
            ctx.globalAlpha = this.flash;
            ctx.fillStyle = "#8a0f1a";
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        if (this.drops.length) {
            const prevSmoothing = ctx.imageSmoothingEnabled;
            ctx.imageSmoothingEnabled = false;
            for (let i = 0; i < this.drops.length; i++) {
                const d = this.drops[i];
                const t = d.life / d.maxLife;
                ctx.globalAlpha = Math.max(0, Math.min(1, t * 1.2));
                ctx.fillStyle = d.color;
                const s = Math.max(2, Math.round(d.size));
                ctx.fillRect(Math.round(d.x), Math.round(d.y), s, s);
            }
            ctx.globalAlpha = 1;
            ctx.imageSmoothingEnabled = prevSmoothing;
        }
    }
}
