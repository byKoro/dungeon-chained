import { Weapon } from './Weapon.js';

export class LaserWeapon extends Weapon {
    constructor() {
        super("LASER", 22);
    }

    draw(ctx, p1, p2) {
        ctx.save();
        ctx.lineWidth = 12;
        ctx.strokeStyle = "rgba(0, 235, 199, 0.4)";
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        ctx.lineWidth = 4;
        ctx.strokeStyle = "#ffffff";
        ctx.shadowColor = "#00ebc7";
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
        ctx.restore();
    }
}