/** Item de cura deixado por inimigos derrotados. */
export class HeartPickup {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 24;
        this.age = 0;
    }

    update() {
        this.age++;
    }

    draw(ctx) {
        const bob = Math.sin(this.age * 0.08) * 2;
        ctx.save();
        ctx.translate(Math.round(this.x), Math.round(this.y + bob));

        // Coração pixelado, com brilho discreto para destacar o item do chão.
        ctx.shadowColor = "#ff4d6d";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#ff4d6d";
        ctx.beginPath();
        ctx.moveTo(0, 14);
        ctx.lineTo(-16, -1);
        ctx.lineTo(-16, -8);
        ctx.lineTo(-10, -14);
        ctx.lineTo(-4, -14);
        ctx.lineTo(0, -9);
        ctx.lineTo(4, -14);
        ctx.lineTo(10, -14);
        ctx.lineTo(16, -8);
        ctx.lineTo(16, -1);
        ctx.closePath();
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = "#ffd6de";
        ctx.fillRect(-9, -9, 4, 4);
        ctx.fillRect(-13, -5, 4, 4);
        ctx.restore();
    }
}
