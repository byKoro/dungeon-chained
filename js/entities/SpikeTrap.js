import { HAZARDS } from '../config/GameConfig.js';

export class SpikeTrap {

    constructor(x, y, peaks = null, opts = {}) {
        this.x = x;
        this.y = y;
        this.hitRadius = 0;
        this.peaks = peaks;
        this.cfg = opts.cfg || HAZARDS.spike;

        const timingProfiles = { fast: [0.5, 0.1, 0.1, 0.8], normal: [1, 0.15, 0.15, 2], slow: [2, 0.3, 0.3, 3] };
        this.durations = Array.isArray(opts.durations) && opts.durations.length === 4
            ? opts.durations.map(value => Math.max(0.01, Number(value) || 0.01))
            : [...(timingProfiles[opts.timing] || timingProfiles.normal)];
        this.cycle = this.durations.reduce((sum, seconds) => sum + seconds, 0);

        this.elapsed = ((opts.phaseOffset || 0) * this.cycle) % this.cycle;
        this.initialDelay = Math.max(0, Number(opts.delay) || 0);

        this.state = "hidden";
        this.extend = 0;
        this.frameIndex = 3;
    }

    _advance(deltaSeconds) {
        this.elapsed = (this.elapsed + deltaSeconds) % this.cycle;
        if (this.elapsed < this.durations[0]) {
            this.frameIndex = 3;
            this.state = "hidden";
            this.extend = 0;
        } else if (this.elapsed < this.durations[0] + this.durations[1]) {
            this.frameIndex = 0;
            this.state = "warn";
            this.extend = 0.25;
        } else if (this.elapsed < this.durations[0] + this.durations[1] + this.durations[2]) {
            this.frameIndex = 1;
            this.state = "warn";
            this.extend = 0.5;
        } else {
            this.frameIndex = 2;
            this.state = "exposed";
            this.extend = 1;
        }
    }

    get isDangerous() {
        return this.frameIndex === 2;
    }

    update(players, deltaSeconds = 1 / 60) {
        let dt = Math.max(0, deltaSeconds);
        if (this.initialDelay > 0) {
            if (dt < this.initialDelay) {
                this.initialDelay -= dt;
                return;
            }
            dt -= this.initialDelay;
            this.initialDelay = 0;
        }
        this._advance(dt);
        if (!this.isDangerous) return;

        const r = this.cfg.damageRadius;
        for (const p of players) {
            if (Math.hypot(p.x - this.x, p.y - this.y) < r + p.hitRadius * 0.4) {

                p.takeDamage(this.x, this.y);
            }
        }
    }

    draw(ctx) {
        const size = this.cfg.drawSize;
        const half = size / 2;

        const frames = this.peaks;
        const img = frames && frames[this.frameIndex];
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, this.x - half, this.y - half, size, size);
            return;
        }

        ctx.save();
        ctx.fillStyle = "#1b1620";
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + half * 0.4, half * 0.8, half * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.extend > 0.02) {
            const h = size * 0.8 * this.extend;
            const danger = this.isDangerous;
            ctx.fillStyle = danger ? "#d9d4e0" : "#7a7488";
            ctx.strokeStyle = "#2a2330";
            ctx.lineWidth = 2;
            const spikes = 3;
            const w = size * 0.72;
            const x0 = this.x - w / 2;
            const step = w / spikes;
            for (let i = 0; i < spikes; i++) {
                const bx = x0 + i * step;
                ctx.beginPath();
                ctx.moveTo(bx, this.y + half * 0.4);
                ctx.lineTo(bx + step / 2, this.y + half * 0.4 - h);
                ctx.lineTo(bx + step, this.y + half * 0.4);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}
