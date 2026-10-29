import { SCRAP } from '../config/ScrapConfig.js';

const canCollect = p => p && !p.falling && p.lives > 0;

export class ScrapPickup {
    constructor(x, y, { vx = 0, vy = 0, vz = 0, z = 0, value = 1, cfg = SCRAP } = {}) {
        Object.assign(this, { x, y, z, vx, vy, vz, value, cfg });
        this.landed = z <= 0 && vz <= 0;
        this.restTimer = cfg.restSteps;
        this.vacuum = false;
        this.target = null;
        this.animT = Math.floor(Math.random() * cfg.frameSteps * 4);
    }

    get resting() {
        return !this.vacuum && (!this.landed || this.restTimer > 0);
    }

    nearestPlayer(players, maxDist = Infinity) {
        let best = null, bestD = maxDist;
        for (const p of players) {
            if (!canCollect(p)) continue;
            const d = Math.hypot(p.x - this.x, p.y - this.y);
            if (d <= bestD) { best = p; bestD = d; }
        }
        return best;
    }

    // Devolve o jogador que coletou neste step, ou null.
    update(players, bounds = null) {
        const c = this.cfg;
        this.animT++;
        let rested = false;
        if (!this.landed) {
            this.vz -= c.gravity;
            this.z += this.vz;
            this.vx *= c.airDrag;
            this.vy *= c.airDrag;
            if (this.z <= 0) {
                this.z = 0;
                if (-this.vz > c.minBounceVz) {
                    this.vz = -this.vz * c.bounce;
                    this.vx *= 0.6;
                    this.vy *= 0.6;
                } else {
                    this.vz = 0;
                    this.landed = true;
                }
            }
        } else if (this.restTimer > 0 && !this.vacuum) {
            this.restTimer--;
            rested = true;
        }

        this.target = this.resting || rested ? null : this.nearestPlayer(players, this.vacuum ? Infinity : c.magnetRadius);
        if (this.target) {
            const dx = this.target.x - this.x, dy = this.target.y - this.y;
            const d = Math.hypot(dx, dy) || 1;
            const accel = this.vacuum ? c.vacuumAccel : c.magnetAccel;
            const max = this.vacuum ? c.vacuumMaxSpeed : c.magnetMaxSpeed;
            this.vx += (dx / d) * accel;
            this.vy += (dy / d) * accel;
            const sp = Math.hypot(this.vx, this.vy);
            if (sp > max) { this.vx *= max / sp; this.vy *= max / sp; }
            this.z = Math.max(0, this.z - 1);
        } else if (this.landed) {
            this.vx *= c.groundFriction;
            this.vy *= c.groundFriction;
        }

        this.x += this.vx;
        this.y += this.vy;
        if (bounds) {
            this.x = Math.max(bounds.minX, Math.min(bounds.maxX, this.x));
            this.y = Math.max(bounds.minY, Math.min(bounds.maxY, this.y));
        }

        if (this.resting || rested) return null;
        for (const p of players) {
            if (!canCollect(p)) continue;
            if (Math.hypot(p.x - this.x, p.y - this.y) <= c.collectRadius + (p.hitRadius ?? 16)) return p;
        }
        return null;
    }

    drawShadow(ctx) {
        const r = Math.max(3, this.cfg.shadowRadius - this.z * 0.12);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(Math.round(this.x), Math.round(this.y + 8), r, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    draw(ctx, frames) {
        const img = frames?.[Math.floor(this.animT / this.cfg.frameSteps) % frames.length];
        const s = this.cfg.drawSize;
        const x = Math.round(this.x - s / 2), y = Math.round(this.y - s / 2 - this.z);
        if (img?.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, x, y, s, s);
            return;
        }
        ctx.fillStyle = '#b8b2a4';
        ctx.fillRect(x + s / 4, y + s / 4, s / 2, s / 2);
    }
}
