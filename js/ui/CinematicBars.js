import { CINEMATIC_BARS } from '../config/CinematicConfig.js';

export class CinematicBars {
    constructor({ config = CINEMATIC_BARS } = {}) {
        this.config = config;
        this.reset();
    }

    reset() {
        this.amount = 0;
        this._target = 0;
        this._from = 0;
        this._elapsed = 0;
    }

    get hidden() { return this.amount === 0 && this._target === 0; }

    show() { this._moveTo(1, this.config.enterSeconds); }
    hide() { this._moveTo(0, this.config.exitSeconds); }

    _moveTo(target, duration) {
        if (this._target === target) return;
        this._from = this.amount;
        this._target = target;
        this._elapsed = 0;
        this._duration = duration;
    }

    update(dt) {
        if (this.amount === this._target) return;
        this._elapsed += Math.max(0, dt);
        const t = Math.min(1, this._elapsed / this._duration);
        const eased = 1 - (1 - t) ** 3;
        this.amount = this._from + (this._target - this._from) * eased;
    }

    inset(height) { return Math.round(height * this.config.heightRatio); }

    draw(ctx, width, height) {
        const barH = Math.round(this.inset(height) * this.amount);
        if (!barH) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, barH);
        ctx.fillRect(0, height - barH, width, barH);
        ctx.restore();
    }
}
