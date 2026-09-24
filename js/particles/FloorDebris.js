export class FloorDebris {
    constructor(x, y, w, h, color, isBlood) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.color = color;
        this.isBlood = isBlood;
        this.vx = 0;
        this.vy = 0;
        this.friction = isBlood ? 0.82 : 0.88;
    }

    update(players, bounds) {
        players.forEach(p => {
            const pSpeed = Math.hypot(p.vx, p.vy);
            if (pSpeed > 0.4) {
                const dx = this.x - p.x;
                const dy = this.y - p.y;
                const dist = Math.hypot(dx, dy);
                const kickRadius = p.hitRadius + 6;

                if (dist < kickRadius && dist > 0) {
                    const kickStrength = pSpeed * (this.isBlood ? 0.45 : 0.85);
                    const kickAngle = Math.atan2(p.vy, p.vx) + (Math.random() - 0.5) * 0.9;

                    this.vx += Math.cos(kickAngle) * kickStrength;
                    this.vy += Math.sin(kickAngle) * kickStrength;

                    this.x += (dx / dist) * 2;
                    this.y += (dy / dist) * 2;
                }
            }
        });

        if (Math.abs(this.vx) > 0.05 || Math.abs(this.vy) > 0.05) {
            this.x += this.vx;
            this.y += this.vy;
            this.vx *= this.friction;
            this.vy *= this.friction;
        } else {
            this.vx = 0;
            this.vy = 0;
        }

        // Limites
        if (this.x < bounds.minX) { this.x = bounds.minX; this.vx = 0; }
        if (this.x > bounds.maxX) { this.x = bounds.maxX; this.vx = 0; }
        if (this.y < bounds.minY) { this.y = bounds.minY; this.vy = 0; }
        if (this.y > bounds.maxY) { this.y = bounds.maxY; this.vy = 0; }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(Math.floor(this.x - this.w / 2), Math.floor(this.y - this.h / 2), this.w, this.h);
    }
}