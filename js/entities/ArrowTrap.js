import { HAZARDS, TILE } from '../config/GameConfig.js';
import { firstWallImpact } from '../core/ProjectileCollision.js';

export class Arrow {
    constructor(x, y, dirX, dirY, sprite = null) {
        this.x = x;
        this.y = y;
        const cfg = HAZARDS.arrow;
        const len = Math.hypot(dirX, dirY) || 1;
        this.dx = (dirX / len) * cfg.speed;
        this.dy = (dirY / len) * cfg.speed;
        this.angle = Math.atan2(this.dy, this.dx);
        this.hitRadius = cfg.hitRadius;
        this.life = cfg.maxLifeFrames;
        this.dead = false;
        this.wallImpact = null;
        this.sprite = sprite;
        this.lifeSeconds = cfg.maxLifeFrames / 60;
    }

    update(players, bounds, deltaSeconds = 1 / 60, walls = []) {
        this.wallImpact = null;
        if (this.dead) return null;
        const frameScale = Math.max(0, deltaSeconds) * 60;
        const nextX = this.x + this.dx * frameScale, nextY = this.y + this.dy * frameScale;
        const impact = firstWallImpact(this.x, this.y, nextX, nextY, walls, this.hitRadius);
        if (impact) {
            this.x = impact.x;
            this.y = impact.y;
            this.wallImpact = { x: impact.surfaceX, y: impact.surfaceY };
            this.dead = true;
            return null;
        }
        this.x = nextX;
        this.y = nextY;
        this.lifeSeconds -= Math.max(0, deltaSeconds);
        if (this.lifeSeconds <= 0) { this.dead = true; return null; }

        const m = TILE;
        if (this.x < bounds.minX - m || this.x > bounds.maxX + m ||
            this.y < bounds.minY - m || this.y > bounds.maxY + m) {
            this.dead = true;
            return null;
        }

        for (const p of players) {
            if (Math.hypot(p.x - this.x, p.y - this.y) < this.hitRadius + p.hitRadius) {
                this.dead = true;
                if (p.takeDamage(this.x, this.y)) return p;
                return null;
            }
        }
        return null;
    }

    draw(ctx) {
        const cfg = HAZARDS.arrow;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        if (this.sprite && this.sprite.complete && this.sprite.naturalWidth > 0) {
            const length = cfg.length + 12;

            ctx.rotate(-Math.PI / 2);
            ctx.drawImage(this.sprite, -length / 2, -length / 2, length, length);
            ctx.restore();
            return;
        }

        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = cfg.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-cfg.length / 2, 0);
        ctx.lineTo(cfg.length / 2, 0);
        ctx.stroke();

        ctx.fillStyle = cfg.headColor;
        ctx.beginPath();
        ctx.moveTo(cfg.length / 2 + 6, 0);
        ctx.lineTo(cfg.length / 2 - 3, -5);
        ctx.lineTo(cfg.length / 2 - 3, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

export class ArrowTrap {

    constructor(x, y, dir, opts = {}) {
        this.x = x;
        this.y = y;
        this.hitRadius = 0;
        const len = Math.hypot(dir.x, dir.y) || 1;
        this.dirX = dir.x / len;
        this.dirY = dir.y / len;

        this.cfg = HAZARDS.arrowTrap;
        this.sprites = opts.sprites || null;
        this.arrowSprite = opts.arrowSprite || null;
        this.intervalSeconds = this.cfg.intervalFrames / 60;
        this.warnSeconds = this.cfg.warnFrames / 60;
        this.elapsed = ((opts.phaseOffset || 0) % 1) * this.intervalSeconds;
        this.hasFiredThisCycle = false;
        this.pulse = 0;

        this.justFired = false;
    }

    get isWarning() {
        return (this.elapsed % this.intervalSeconds) >= this.intervalSeconds - this.warnSeconds;
    }

    update(onFire, deltaSeconds = 1 / 60) {
        const dt = Math.max(0, deltaSeconds);
        this.elapsed += dt;
        this.pulse += dt * 3;
        this.justFired = false;

        const launchAt = this.intervalSeconds - this.warnSeconds * 0.25;
        if (!this.hasFiredThisCycle && this.elapsed >= launchAt) {
            const sx = this.x + this.dirX * 14;
            const sy = this.y + this.dirY * 14;
            onFire(new Arrow(sx, sy, this.dirX, this.dirY, this.arrowSprite));
            this.hasFiredThisCycle = true;
            this.justFired = true;
        }

        if (this.elapsed >= this.intervalSeconds) {
            this.elapsed %= this.intervalSeconds;
            this.hasFiredThisCycle = false;
        }
    }

    draw(ctx) {
        const cfg = this.cfg;
        const warn = this.isWarning;
        const s = cfg.indicatorSize;

        const pulse = warn ? (0.6 + 0.4 * Math.abs(Math.sin(this.pulse * 1.6))) : 0.75;

        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.rotate(Math.atan2(this.dirY, this.dirX) - Math.PI / 2);

        const warnProgress = this.warnSeconds > 0
            ? Math.max(0, Math.min(0.999, (this.elapsed - (this.intervalSeconds - this.warnSeconds)) / this.warnSeconds))
            : 0;

        const firingFrames = [1, 2, 3, 0];
        const spriteIndex = warn ? firingFrames[Math.floor(warnProgress * firingFrames.length)] : 1;
        const sprite = this.sprites && this.sprites[spriteIndex];
        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            const width = cfg.indicatorSize * 1.6;
            const height = width * (sprite.naturalHeight / sprite.naturalWidth);
            ctx.globalAlpha = pulse;
            ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
            ctx.restore();
            return;
        }

        ctx.fillStyle = "#2a2330";
        ctx.strokeStyle = "#4a4055";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, 0);
        ctx.lineTo(0, -s * 0.5);
        ctx.lineTo(s * 0.5, 0);
        ctx.lineTo(0, s * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.globalAlpha = pulse;
        ctx.fillStyle = warn ? cfg.indicatorWarnColor : cfg.indicatorColor;
        ctx.beginPath();
        ctx.moveTo(s * 0.1, -s * 0.28);
        ctx.lineTo(s * 0.55, 0);
        ctx.lineTo(s * 0.1, s * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}
