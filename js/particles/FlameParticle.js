/**
 * FlameParticle — língua de CHAMA que SOBE (aparição dos inimigos na intro).
 *
 * Bloco pixelado lançado para CIMA a partir do ponto de spawn, com leve
 * oscilação lateral (a chama "lambe" para os lados enquanto sobe). A cor começa
 * quente/clara (quase branca/amarela) e vai esfriando para o âmbar da tocha e,
 * no fim da vida, para um vermelho escuro — igual ao fogo das tochas do cenário.
 * Desenhada com glow aditivo ("lighter") para o brilho somar como fogo real.
 * Puramente visual: não deixa marca no chão.
 */
export class FlameParticle {
    /**
     * @param {number} x origem
     * @param {number} y origem
     * @param {[number,number,number]} baseColor cor-base (RGB) da chama (tocha)
     * @param {number} power escala de velocidade/tamanho
     */
    constructor(x, y, baseColor = [255, 190, 110], power = 1) {
        // Dispersão da origem para o fogo nascer num "tufo", não num ponto.
        this.x = x + (Math.random() - 0.5) * 10;
        this.y = y + (Math.random() - 0.5) * 6;

        // Sobe: velocidade predominante para cima + leve deriva lateral.
        this.vx = (Math.random() - 0.5) * 1.1;
        this.vy = -(1.6 + Math.random() * 2.4) * power;

        // Oscilação lateral (lambida da chama): fase e amplitude próprias.
        this.swayPhase = Math.random() * Math.PI * 2;
        this.swaySpeed = 0.18 + Math.random() * 0.14;
        this.swayAmp = 0.25 + Math.random() * 0.4;

        // Blocos pixelados (2..5 px de arte); encolhem ao subir/esfriar.
        this.size = 3 + ((Math.random() * 3) | 0);

        this.life = 16 + ((Math.random() * 12) | 0);
        this.maxLife = this.life;

        this.base = baseColor;
    }

    get done() {
        return this.life <= 0;
    }

    update() {
        this.swayPhase += this.swaySpeed;
        this.x += this.vx + Math.sin(this.swayPhase) * this.swayAmp;
        this.y += this.vy;
        // Desacelera a subida (a chama perde força no topo).
        this.vy *= 0.9;
        this.vx *= 0.92;
        this.life--;
    }

    // Cor conforme a "temperatura" (t: 1 = recém-nascida/quente, 0 = fria).
    // Quente -> clareia para o branco-amarelo; fria -> escurece para vermelho.
    _colorFor(t) {
        const [r, g, b] = this.base;
        if (t > 0.6) {
            // Núcleo quente: clareia em direção ao branco.
            const k = (t - 0.6) / 0.4; // 0..1
            const rr = Math.round(r + (255 - r) * k);
            const gg = Math.round(g + (255 - g) * k);
            const bb = Math.round(b + (235 - b) * k);
            return `rgb(${rr}, ${gg}, ${bb})`;
        }
        // Esfriando: desce de âmbar para vermelho escuro.
        const k = t / 0.6; // 1 no âmbar -> 0 no vermelho frio
        const rr = Math.round(120 + (r - 120) * k);
        const gg = Math.round(30 + (g - 30) * k);
        const bb = Math.round(20 + (b - 20) * k);
        return `rgb(${rr}, ${gg}, ${bb})`;
    }

    draw(ctx) {
        const t = this.life / this.maxLife; // 1 -> 0
        const s = Math.max(1, Math.round(this.size * (0.35 + t * 0.65)));
        const px = Math.round(this.x - s / 2);
        const py = Math.round(this.y - s / 2);

        ctx.save();
        // Glow aditivo: o fogo soma luz (brilha de verdade sobre a cena escura).
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = Math.max(0, t) * 0.85;
        const [r, g, b] = this.base;
        ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.9)`;
        ctx.shadowBlur = 6 * t;
        ctx.fillStyle = this._colorFor(t);
        ctx.fillRect(px, py, s, s);
        ctx.restore();
    }
}
