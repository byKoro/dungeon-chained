/**
 * Footprint — pegada normal (script) que fica um tempo no chão e some (fade).
 *
 * É uma pequena marca pixelada, orientada pela direção do passo. Usada para o
 * rastro comum dos jogadores. (As pegadas de SANGUE são fixas e carimbadas
 * direto no BloodCanvas — ver stampFootprint.)
 */
export class Footprint {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.life = 150;       // ~2.5s
        this.maxLife = this.life;
        this.color = "#000000"; // sombra escura sutil no chão
    }

    get done() {
        return this.life <= 0;
    }

    update() {
        this.life--;
    }

    draw(ctx) {
        const t = this.life / this.maxLife; // 1 -> 0
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        // Bem sutil e some com o tempo
        ctx.globalAlpha = 0.22 * t;
        ctx.fillStyle = this.color;

        // Marca oval pixelada (sola do pé)
        const px = 2, len = 5, wid = 3;
        for (let yy = -wid; yy <= wid; yy += px) {
            for (let xx = -len; xx <= len; xx += px) {
                const nx = xx / len, ny = yy / wid;
                if (nx * nx + ny * ny <= 1) {
                    ctx.fillRect(Math.round(xx), Math.round(yy), px, px);
                }
            }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
    }
}
