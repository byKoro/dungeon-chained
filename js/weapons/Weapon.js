export class Weapon {
    constructor(name, hitThreshold = 22) {
        this.name = name;
        this.hitThreshold = hitThreshold;
    }

    update() {}

    draw(ctx, p1, p2) {}

    hitsTarget(target, p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const lengthSquared = dx * dx + dy * dy;
        const t = lengthSquared === 0
            ? 0
            : Math.max(0, Math.min(1, ((target.x - p1.x) * dx + (target.y - p1.y) * dy) / lengthSquared));
        const closestX = p1.x + t * dx;
        const closestY = p1.y + t * dy;

        return Math.hypot(target.x - closestX, target.y - closestY)
            < this.hitThreshold + (target.hitRadius ?? 0);
    }
}