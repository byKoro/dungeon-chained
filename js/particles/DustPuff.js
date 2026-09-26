/**
 * DustPuff — poeira de corrida PROCEDURAL (sem sprite).
 *
 * Um "arranque" gera um conjunto destas partículas, cada uma um bloco pixelado
 * cinza que é lançado no sentido CONTRÁRIO à corrida, cresce um pouco, perde
 * velocidade e desvanece. Desenhadas em blocos para combinar com o pixel art.
 */
export class DustPuff {
    /**
     * @param {number} x origem
     * @param {number} y origem
     * @param {number} dirX direção da CORRIDA (normalizada)
     * @param {number} dirY direção da CORRIDA (normalizada)
     */
    constructor(x, y, dirX, dirY) {
        this.x = x;
        this.y = y;

        // Lança para TRÁS (contra a corrida), com leque de ângulo e um empurrão
        // extra para os lados/baixo para a poeira "abrir" perto do chão.
        const baseAng = Math.atan2(-dirY, -dirX);
        const ang = baseAng + (Math.random() - 0.5) * 1.1;
        const speed = 0.6 + Math.random() * 1.6;
        this.vx = Math.cos(ang) * speed;
        this.vy = Math.sin(ang) * speed * 0.6 - 0.2; // leve subida
        this.friction = 0.90;

        // Tamanho em blocos (pixel art), cresce ao longo da vida
        this.size = 2 + ((Math.random() * 3) | 0);
        this.grow = 0.05 + Math.random() * 0.06;

        // Vida / fade
        this.life = 16 + ((Math.random() * 12) | 0);
        this.maxLife = this.life;

        // Tom de cinza/poeira (claro para destacar do chão escuro)
        const tones = ["#cfc6b8", "#b8ae9e", "#9c9384", "#e0d8ca"];
        this.color = tones[(Math.random() * tones.length) | 0];
    }

    get done() {
        return this.life <= 0;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.size += this.grow;
        this.life--;
    }

    draw(ctx) {
        const t = this.life / this.maxLife; // 1 -> 0
        // Fade: opacidade cai ao longo da vida
        ctx.globalAlpha = Math.max(0, t) * 0.75;
        ctx.fillStyle = this.color;
        const s = Math.round(this.size);
        ctx.fillRect(Math.round(this.x - s / 2), Math.round(this.y - s / 2), s, s);
        ctx.globalAlpha = 1;
    }
}
