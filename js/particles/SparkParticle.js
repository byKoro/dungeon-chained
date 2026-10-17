/**
 * SparkParticle — faísca PROCEDURAL de metal raspando o chão.
 *
 * Pequeno bloco quente (amarelo/laranja/branco) que a serra cospe pelas BORDAS
 * ao girar enquanto os jogadores andam. Nasce num ponto da circunferência do
 * disco e é arremessada TANGENCIALMENTE (no sentido do giro) + um empurrão para
 * fora, imitando a centelha jogada pela rotação. Voa rápido, cai com gravidade
 * leve, encurta e desvanece em poucos quadros. Desenhada em blocos (pixel art).
 */
export class SparkParticle {
    /**
     * @param {number} cx centro do disco (x)
     * @param {number} cy centro do disco (y)
     * @param {number} radius raio do disco (ponto de emissão fica na borda)
     * @param {number} spinDir sentido do giro: +1 horário, -1 anti-horário
     */
    constructor(cx, cy, radius = 24, spinDir = 1) {
        // Ângulo aleatório na borda do disco.
        const a = Math.random() * Math.PI * 2;
        const nx = Math.cos(a);   // normal (radial) para fora
        const ny = Math.sin(a);
        // Tangente ao círculo (sentido do giro).
        const tx = -ny * spinDir;
        const ty = nx * spinDir;

        // Nasce na borda (não no centro).
        this.x = cx + nx * radius;
        this.y = cy + ny * radius;

        // Velocidade: forte na TANGENTE (giro arremessa) + leve componente
        // radial para fora, mais um empurrão para cima para "pular" do chão.
        const tangential = 3.5 + Math.random() * 3;
        const radial = 0.5 + Math.random() * 1.5;
        this.vx = tx * tangential + nx * radial;
        this.vy = ty * tangential + ny * radial - (1 + Math.random() * 1.5);
        this.gravity = 0.35;
        this.friction = 0.9;

        // Bloco de 1-2 pixels de arte (coerente com o resto).
        this.size = 2 + (Math.random() < 0.4 ? 2 : 0);

        // Vida curta.
        this.life = 8 + ((Math.random() * 8) | 0);
        this.maxLife = this.life;

        // Cores quentes de centelha.
        const tones = ["#fff7d6", "#ffd34d", "#ff9f1c", "#ffe08a"];
        this.color = tones[(Math.random() * tones.length) | 0];
    }

    get done() {
        return this.life <= 0;
    }

    update() {
        this.vx *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
    }

    draw(ctx) {
        const t = this.life / this.maxLife; // 1 -> 0
        ctx.globalAlpha = Math.max(0, t);
        ctx.fillStyle = this.color;
        // Encurta ao longo da vida e alinha à grade de pixels.
        const s = Math.max(1, Math.round(this.size * (0.4 + t * 0.6)));
        ctx.fillRect(Math.round(this.x - s / 2), Math.round(this.y - s / 2), s, s);
        ctx.globalAlpha = 1;
    }
}
