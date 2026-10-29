import { ARAUTO_FX } from '../config/ArautoEffectsConfig.js';

export class LavaFragment {
    constructor(x, y, { lava = false, groundY = y + 18, dirX = 0, dirY = 0 } = {}) {
        const cfg = ARAUTO_FX;
        this.x = x;
        this.y = y;
        this.groundY = groundY;
        this.lava = lava;
        this.life = cfg.fragmentLife;
        this.age = 0;
        this.settled = false;
        this.vx = (Math.random() - 0.5) * cfg.fragmentSpeed * 2 + dirX * cfg.fragmentSpeed;
        this.vy = -cfg.fragmentLift * (0.5 + Math.random()) + dirY;
        this.size = cfg.pixel * (lava ? 1 : 1 + Math.floor(Math.random() * 2));
        this.color = cfg.stoneColors[Math.floor(Math.random() * cfg.stoneColors.length)];
    }

    get done() { return this.life <= 0; }

    update() {
        this.life--;
        this.age++;
        if (this.settled) return;
        this.vx *= ARAUTO_FX.drag;
        this.vy += ARAUTO_FX.gravity;
        this.x += this.vx;
        this.y += this.vy;
        if (this.y >= this.groundY) { this.y = this.groundY; this.settled = true; }
    }

    draw(ctx) {
        const cfg = ARAUTO_FX;
        ctx.save();
        ctx.globalAlpha = Math.min(1, this.life / cfg.fragmentFade);
        const heat = Math.max(0, 1 - this.age / cfg.fragmentGlow);
        ctx.fillStyle = this.lava && heat > 0 ? cfg.lavaColors[Math.min(2, Math.floor((1 - heat) * 3))] : this.color;
        const x = Math.round(this.x / cfg.pixel) * cfg.pixel;
        const y = Math.round(this.y / cfg.pixel) * cfg.pixel;
        ctx.fillRect(x, y, this.size, this.size);
        if (heat > 0 && this.lava) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha *= heat * 0.25;
            ctx.fillRect(x - cfg.pixel, y - cfg.pixel, this.size + cfg.pixel * 2, this.size + cfg.pixel * 2);
        }
        ctx.restore();
    }
}
