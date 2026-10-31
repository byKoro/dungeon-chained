import { DAMAGE_NUMBER } from '../config/CombatFeelConfig.js';
import { drawText, measureText } from '../ui/PixelFont.js';

// Número de dano em espaço de mundo: sobe, perde velocidade e some. Movimento e vida em passos de simulação.
export class DamageNumber {
    constructor(x, y, amount, opts = {}) {
        const c = DAMAGE_NUMBER;
        this.text = opts.text ?? String(Math.max(0, Math.round(amount)));
        this.x = x + (Math.random() - 0.5) * c.scatterX;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 2 * c.driftX;
        this.vy = -c.riseSpeed;
        this.color = opts.color || c.color;
        this.age = 0;
        this.life = c.lifeSteps;
    }

    get done() {
        return this.age >= this.life;
    }

    update() {
        this.age++;
        this.x += this.vx;
        this.y += this.vy;
        this.vy *= DAMAGE_NUMBER.riseDamping;
    }

    draw(ctx) {
        const c = DAMAGE_NUMBER;
        const remaining = this.life - this.age;
        const alpha = remaining >= c.fadeSteps ? 1 : Math.max(0, remaining / c.fadeSteps);
        const pop = this.age < c.popSteps ? 1 + (c.popScale - 1) * (1 - this.age / c.popSteps) : 1;
        const px = c.pixel * pop;
        const w = measureText(this.text);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(Math.round(this.x), Math.round(this.y));
        ctx.scale(px, px);
        const x = -Math.floor(w / 2);
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) drawText(ctx, this.text, x + ox, oy, c.outline);
        drawText(ctx, this.text, x, 0, this.color);
        ctx.restore();
    }
}
