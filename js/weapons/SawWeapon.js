import { Weapon } from './Weapon.js';

export class SawWeapon extends Weapon {
    constructor() {
        super("SERRAS", 14);
        this.angle = 0;
    }

    update() {
        this.angle += 0.2;
    }

    getSawPositions(p1, p2) {
        const numSaws = 5;
        return Array.from({ length: numSaws }, (_, index) => {
            const i = index + 1;
            const t = i / (numSaws + 1);
            return {
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t,
                radius: i % 2 === 0 ? 14 : 11
            };
        });
    }

    hitsTarget(target, p1, p2) {
        return this.getSawPositions(p1, p2).some(saw =>
            Math.hypot(target.x - saw.x, target.y - saw.y) < saw.radius + (target.hitRadius ?? 0)
        );
    }

    draw(ctx, p1, p2) {
        ctx.save();
        ctx.strokeStyle = "#8d99ae";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        this.getSawPositions(p1, p2).forEach(({ x, y, radius }, index) => {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(this.angle * (index % 2 === 1 ? 1 : -1));

            ctx.fillStyle = "#ff5470";
            ctx.beginPath();
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
                ctx.lineTo(Math.cos(a + 0.3) * (radius * 0.5), Math.sin(a + 0.3) * (radius * 0.5));
            }
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.restore();
        });
        ctx.restore();
    }
}