import { Weapon } from './Weapon.js';

export class SawWeapon extends Weapon {
    constructor() {
        super("SERRAS", 30);
        this.angle = 0;
    }

    update() {
        this.angle += 0.2;
    }

    draw(ctx, p1, p2) {
        const numSaws = 5;
        ctx.save();
        ctx.strokeStyle = "#8d99ae";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        for (let i = 1; i <= numSaws; i++) {
            const t = i / (numSaws + 1);
            const sx = p1.x + (p2.x - p1.x) * t;
            const sy = p1.y + (p2.y - p1.y) * t;
            const radius = (i % 2 === 0) ? 14 : 11;

            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(this.angle * (i % 2 === 0 ? 1 : -1));

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
        }
        ctx.restore();
    }
}