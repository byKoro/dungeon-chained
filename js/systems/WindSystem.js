import { WIND } from '../config/GameConfig.js';

export class WindSystem {
    constructor(cfg = WIND) {
        this.cfg = cfg;
        this.particles = [];
        this._gustPhase = 0;
        this._anglePhase = 0;
        this._bounds = null;
    }

    _rand(a, b) { return a + Math.random() * (b - a); }

    _seed(area) {
        const c = this.cfg;
        this.particles.length = 0;
        for (let i = 0; i < c.count; i++) {
            this.particles.push(this._spawn(area, true));
        }
    }

    _spawn(area, anywhere) {
        const c = this.cfg;
        const p = {
            size: this._rand(c.sizeMin, c.sizeMax),
            alpha: this._rand(c.alphaMin, c.alphaMax),
            speedMul: this._rand(1 - c.speedVariation, 1 + c.speedVariation),
            swayPhase: Math.random() * Math.PI * 2,
            swayAmp: this._rand(0, c.sway)
        };
        if (anywhere) {
            p.x = this._rand(area.minX, area.maxX);
            p.y = this._rand(area.minY, area.maxY);
        } else {
            this._placeOnInflowEdge(p, area);
        }
        return p;
    }

    _placeOnInflowEdge(p, area) {
        const dirX = Math.cos(this._angle), dirY = Math.sin(this._angle);

        if (Math.abs(dirX) >= Math.abs(dirY)) {
            p.x = dirX >= 0 ? area.minX : area.maxX;
            p.y = this._rand(area.minY, area.maxY);
        } else {
            p.y = dirY >= 0 ? area.minY : area.maxY;
            p.x = this._rand(area.minX, area.maxX);
        }
    }

    _computeArea(bounds) {
        const m = this.cfg.margin;
        return {
            minX: bounds.minX - m, maxX: bounds.maxX + m,
            minY: bounds.minY - m, maxY: bounds.maxY + m
        };
    }

    update(bounds) {
        if (!this.cfg.enabled || !bounds) return;
        const c = this.cfg;
        const area = this._computeArea(bounds);

        if (!this._bounds || this._areaChanged(area)) {
            this._bounds = area;
            this._seed(area);
        }

        this._gustPhase += c.gustSpeed;
        const gust01 = (Math.sin(this._gustPhase) + 1) / 2;
        const gust = c.gustMin + (c.gustMax - c.gustMin) * gust01;

        this._anglePhase += c.angleDrift;
        this._angle = c.angle + Math.sin(this._anglePhase) * c.angleDriftRange;

        const dirX = Math.cos(this._angle), dirY = Math.sin(this._angle);

        const perpX = -dirY, perpY = dirX;

        for (const p of this.particles) {
            const spd = c.speed * gust * p.speedMul;
            p.swayPhase += c.swaySpeed;
            const sway = Math.sin(p.swayPhase) * p.swayAmp;

            p.x += dirX * spd + perpX * sway;
            p.y += dirY * spd + perpY * sway;

            if (p.x < area.minX || p.x > area.maxX || p.y < area.minY || p.y > area.maxY) {
                const np = this._spawn(area, false);
                Object.assign(p, np);
            }
        }
        this._area = area;
    }

    _areaChanged(area) {
        const b = this._bounds;
        return Math.abs(b.minX - area.minX) > 1 || Math.abs(b.minY - area.minY) > 1
            || Math.abs(b.maxX - area.maxX) > 1 || Math.abs(b.maxY - area.maxY) > 1;
    }

    draw(ctx) {
        if (!this.cfg.enabled || !this.particles.length) return;
        const c = this.cfg;
        const dirX = Math.cos(this._angle || c.angle), dirY = Math.sin(this._angle || c.angle);

        ctx.save();
        for (const p of this.particles) {
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = `rgb(${c.color})`;
            const len = p.size * c.streak;
            if (c.streak > 1) {

                const steps = Math.max(1, Math.round(len / p.size));
                for (let s = 0; s < steps; s++) {
                    const t = s / steps;
                    const x = p.x - dirX * len * t;
                    const y = p.y - dirY * len * t;

                    ctx.globalAlpha = p.alpha * (1 - t * 0.7);
                    ctx.fillRect(x, y, p.size, p.size);
                }
            } else {
                ctx.fillRect(p.x, p.y, p.size, p.size);
            }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    drawScreen(ctx, worldToScreen) {
        if (!this.cfg.enabled || !this.particles.length) return;
        const c = this.cfg;
        const dirX = Math.cos(this._angle || c.angle), dirY = Math.sin(this._angle || c.angle);

        ctx.save();
        for (const p of this.particles) {
            const s = worldToScreen(p.x, p.y);
            const size = Math.max(1, p.size * s.zoom);
            ctx.fillStyle = `rgb(${c.color})`;
            const len = size * c.streak;
            if (c.streak > 1) {
                const steps = Math.max(1, Math.round(len / size));
                for (let st = 0; st < steps; st++) {
                    const t = st / steps;
                    ctx.globalAlpha = p.alpha * (1 - t * 0.7);
                    ctx.fillRect(s.x - dirX * len * t, s.y - dirY * len * t, size, size);
                }
            } else {
                ctx.globalAlpha = p.alpha;
                ctx.fillRect(s.x, s.y, size, size);
            }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}
