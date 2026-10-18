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
    constructor(cx, cy, radius = 24, spinDir = 1, opts = {}) {
        const burst = !!opts.burst;      // modo RUPTURA: radial e exagerado
        const power = opts.power ?? 1;
        // Sem glow borrado (pixel art nítido): bloco sólido com fade.

        // Ângulo aleatório na borda do disco.
        const a = Math.random() * Math.PI * 2;
        const nx = Math.cos(a);   // normal (radial) para fora
        const ny = Math.sin(a);

        // Nasce na borda (não no centro).
        this.x = cx + nx * radius;
        this.y = cy + ny * radius;

        if (burst) {
            // RUPTURA: explode RADIALMENTE para fora, rápido e exagerado.
            const speed = (5 + Math.random() * 7) * power;
            this.vx = nx * speed + (Math.random() - 0.5) * 2;
            this.vy = ny * speed - (1 + Math.random() * 2);
            this.gravity = 0.28;
            this.friction = 0.88;
            this.size = (3 + ((Math.random() * 4) | 0)) * (0.8 + power * 0.3);
            this.life = 12 + ((Math.random() * 12) | 0);
        } else {
            // RASPAR: tangencial (giro arremessa) + leve componente radial.
            const tx = -ny * spinDir;
            const ty = nx * spinDir;
            const tangential = 3.5 + Math.random() * 3;
            const radial = 0.5 + Math.random() * 1.5;
            this.vx = tx * tangential + nx * radial;
            this.vy = ty * tangential + ny * radial - (1 + Math.random() * 1.5);
            this.gravity = 0.35;
            this.friction = 0.9;
            this.size = 2 + (Math.random() < 0.4 ? 2 : 0);
            this.life = 8 + ((Math.random() * 8) | 0);
        }
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

    // O CHAMADOR (ParticleSystem) salva/restaura o estado do ctx uma vez para
    // a camada inteira; aqui só se ajusta globalAlpha/fillStyle.
    draw(ctx) {
        const t = this.life / this.maxLife; // 1 -> 0
        const s = Math.max(1, Math.round(this.size * (0.4 + t * 0.6)));
        const px = Math.round(this.x - s / 2);
        const py = Math.round(this.y - s / 2);
        ctx.globalAlpha = Math.max(0, t);
        ctx.fillStyle = this.color;
        ctx.fillRect(px, py, s, s);
    }
}
