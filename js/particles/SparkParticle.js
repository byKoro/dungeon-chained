export class SparkParticle {

    constructor(cx, cy, radius = 24, spinDir = 1, opts = {}) {
        const burst = !!opts.burst;
        const power = opts.power ?? 1;
        const dir = opts.dir || null;

        // Com `dir`, as faíscas saem do ponto (cx, cy) dentro de um cone ao redor da direção do golpe.
        const a = dir
            ? Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * 2 * (opts.cone ?? 0.9)
            : Math.random() * Math.PI * 2;
        const nx = Math.cos(a);
        const ny = Math.sin(a);

        this.x = cx + (dir ? 0 : nx * radius);
        this.y = cy + (dir ? 0 : ny * radius);

        if (dir) {
            const speed = (4 + Math.random() * 7) * power;
            this.vx = nx * speed;
            this.vy = ny * speed - (0.5 + Math.random() * 1.5);
            this.gravity = 0.3;
            this.friction = 0.88;
            this.size = 2 + ((Math.random() * 3) | 0);
            this.life = 10 + ((Math.random() * 10) | 0);
        } else if (burst) {

            const speed = (5 + Math.random() * 7) * power;
            this.vx = nx * speed + (Math.random() - 0.5) * 2;
            this.vy = ny * speed - (1 + Math.random() * 2);
            this.gravity = 0.28;
            this.friction = 0.88;
            this.size = (3 + ((Math.random() * 4) | 0)) * (0.8 + power * 0.3);
            this.life = 12 + ((Math.random() * 12) | 0);
        } else {

            const tx = -ny * spinDir;
            const ty = nx * spinDir;
            const tangential = 3.5 + Math.random() * 3;
            const radial = 0.5 + Math.random() * 1.5;
            this.vx = tx * tangential + nx * radial;
            this.vy = ty * tangential + ny * radial - (1 + Math.random() * 1.5);
            this.gravity = 0.35;
            this.friction = 0.9;
            this.size = 2 + (Math.random() < 0.4 ? 2 : 0);
            this.life = 8 + ((Math.random() * 8) | 0);
        }
        this.maxLife = this.life;

        const tones = ["#fff7d6", "#ffd34d", "#ff9f1c", "#ffe08a"];
        this.color = tones[(Math.random() * tones.length) | 0];
    }

    get done() {
        return this.life <= 0;
    }

    update() {
        this.vx *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }

    draw(ctx) {
        const t = this.life / this.maxLife;
        const s = Math.max(1, Math.round(this.size * (0.4 + t * 0.6)));
        const px = Math.round(this.x - s / 2);
        const py = Math.round(this.y - s / 2);
        ctx.globalAlpha = Math.max(0, t);
        ctx.fillStyle = this.color;
        ctx.fillRect(px, py, s, s);
    }
}
