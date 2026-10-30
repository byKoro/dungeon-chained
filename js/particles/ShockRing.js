// Anel de pixels que cresce até `radius` (ease-out) e some: a onda do Estalo. Desenhado no passe dos flashes (aditivo).
export class ShockRing {
    constructor(x, y, radius, { life = 16, pixel = 4, color = "#ffe9b0", start = 0.25 } = {}) {
        Object.assign(this, { x, y, radius, pixel, color, start });
        this.life = life;
        this.maxLife = life;
    }

    get done() {
        return this.life <= 0;
    }

    update() {
        this.life--;
    }

    draw(ctx) {
        const k = 1 - this.life / this.maxLife;
        const ease = 1 - (1 - k) * (1 - k);
        const r = this.radius * (this.start + (1 - this.start) * ease);
        const alpha = Math.max(0, 1 - k) * 0.9;
        if (alpha <= 0 || r <= 0) return;
        const P = this.pixel, n = Math.max(12, Math.round((2 * Math.PI * r) / P));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            ctx.fillRect(Math.round((this.x + Math.cos(a) * r) / P) * P - P / 2, Math.round((this.y + Math.sin(a) * r) / P) * P - P / 2, P, P);
        }
    }
}
