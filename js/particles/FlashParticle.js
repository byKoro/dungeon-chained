/**
 * FlashParticle — estilhaço de FLASH branco (ruptura da corrente/serra).
 *
 * Bloco branco/claro lançado a partir do ponto de ruptura. Voa, desacelera e
 * some em poucos quadros, com fade ease-out e um GLOW aditivo SUTIL. Versão
 * contida (pouco exagero). Puramente visual (não deixa marca).
 */
export class FlashParticle {
    constructor(x, y, power = 1) {
        this.x = x;
        this.y = y;

        const angle = Math.random() * Math.PI * 2;
        // Velocidade moderada (menos intensa que o burst exagerado anterior).
        const speed = (1.5 + Math.random() * 3) * power;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.friction = 0.87;

        // Blocos pequenos (2..4 px de arte).
        this.size = 2 + ((Math.random() * 3) | 0);

        this.life = 7 + ((Math.random() * 6) | 0);
        this.maxLife = this.life;

        // Branco / branco-azulado claro.
        const tones = ["#ffffff", "#fdfdff", "#eaf2ff"];
        this.color = tones[(Math.random() * tones.length) | 0];
    }

    get done() {
        return this.life <= 0;
    }

    update() {
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }

    draw(ctx) {
        const t = this.life / this.maxLife; // 1 -> 0
        const s = Math.max(1, Math.round(this.size * (0.5 + t * 0.5)));
        const px = Math.round(this.x - s / 2);
        const py = Math.round(this.y - s / 2);

        ctx.save();
        // Glow aditivo SUTIL (brilho leve, sem estourar).
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.max(0, t) * 0.9;
        ctx.shadowColor = "#eaf2ff";
        ctx.shadowBlur = 5 * t;
        ctx.fillStyle = this.color;
        ctx.fillRect(px, py, s, s);
        ctx.restore();
    }
}
