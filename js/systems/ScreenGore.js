/**
 * ScreenGore — feedback de "kill" em espaço de TELA (overlay sobre tudo).
 *
 * Dois efeitos independentes, moderados:
 *   1) FLASH vermelho leve na tela inteira, em PULSO (sobe e desce suave).
 *      Disparado SÓ quando um jogador recebe dano (triggerFlash).
 *   2) RESPINGOS de sangue (gotas pixeladas) voando pela tela, que escorrem
 *      um pouco e somem, ao abater um inimigo (trigger). São puramente
 *      visuais e vivem em px de TELA, então não interferem no mundo nem no
 *      sangue de chão.
 *
 * Uso:
 *   const gore = new ScreenGore(canvas);
 *   // ao matar: gore.trigger();
 *   // ao levar dano: gore.triggerFlash();
 *   // no loop:  gore.update();   // (pode chamar junto do render)
 *   // no draw:  gore.draw(ctx);  // por cima de tudo, antes da UI
 */
export class ScreenGore {
    constructor(canvas) {
        this.canvas = canvas;
        // Pulso do flash vermelho: fase 0..1 ao longo de `pulseDur` frames.
        // O alpha segue um envelope senoidal (sobe suave, atinge o pico no
        // meio, desce suave) — um PULSO, não um corte seco que decai.
        this.pulseT = 1;        // 1 = terminado (sem pulso ativo)
        this.pulseDur = 20;     // duração do pulso em passos (~0,7 s a 60Hz)
        this.pulsePeak = 0;     // intensidade do pico do pulso atual
        this.drops = [];        // respingos em espaço de tela
    }

    clear() {
        this.pulseT = 1;
        this.pulsePeak = 0;
        this.drops = [];
    }

    // Intensidade atual do flash (0..1), derivada do envelope do pulso.
    get flash() {
        if (this.pulseT >= 1) return 0;
        return this.pulsePeak * Math.sin(Math.PI * this.pulseT); // 0 -> pico -> 0
    }

    /**
     * Flash vermelho de DANO (jogador perdeu vida). `intensity` 0..1 escala a
     * força; golpes seguidos acumulam o pico, com teto.
     */
    triggerFlash(intensity = 1) {
        // (Re)inicia o PULSO do flash. O pico empilha com golpes seguidos, mas
        // é limitado para não "lavar" a tela. Reiniciar a fase reacende o pulso.
        this.pulsePeak = Math.min(0.3, this.pulsePeak + 0.16 * intensity);
        this.pulseT = 0;
    }

    /**
     * Feedback de um ABATE: só os respingos de sangue na tela (sem flash
     * vermelho — ele fica reservado para o dano no jogador).
     */
    trigger() {
        // Poucos respingos (dá pra ver, sem exagero). Nascem nas BORDAS da tela
        // e voam para dentro, como sangue salpicado na "câmera".
        const w = this.canvas.width, h = this.canvas.height;
        const n = 4 + ((Math.random() * 4) | 0);
        for (let i = 0; i < n; i++) {
            // origem perto de uma borda aleatória
            const edge = (Math.random() * 4) | 0;
            let x, y, vx, vy;
            const sp = 2 + Math.random() * 4;
            if (edge === 0) { x = Math.random() * w; y = -8; vx = (Math.random() - 0.5) * 3; vy = sp; }
            else if (edge === 1) { x = Math.random() * w; y = h + 8; vx = (Math.random() - 0.5) * 3; vy = -sp; }
            else if (edge === 2) { x = -8; y = Math.random() * h; vx = sp; vy = (Math.random() - 0.5) * 3; }
            else { x = w + 8; y = Math.random() * h; vx = -sp; vy = (Math.random() - 0.5) * 3; }

            this.drops.push({
                x, y, vx, vy,
                size: (3 + ((Math.random() * 4) | 0)) * 1, // bloco pixelado
                life: 26 + ((Math.random() * 22) | 0),
                maxLife: 0,
                color: ["#6e0f1c", "#5c0a18", "#7d1420", "#4a0612"][(Math.random() * 4) | 0]
            });
            const d = this.drops[this.drops.length - 1];
            d.maxLife = d.life;
        }
        // Teto de respingos na tela.
        while (this.drops.length > 60) this.drops.shift();
    }

    update() {
        // Avança a fase do pulso; ao terminar, zera o pico acumulado.
        if (this.pulseT < 1) {
            this.pulseT = Math.min(1, this.pulseT + 1 / this.pulseDur);
            if (this.pulseT >= 1) this.pulsePeak = 0;
        }
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            d.vx *= 0.96;
            d.vy = d.vy * 0.96 + 0.12; // leve gravidade (escorre para baixo)
            d.x += d.vx;
            d.y += d.vy;
            d.life--;
            if (d.life <= 0) this.drops.splice(i, 1);
        }
    }

    draw(ctx) {
        const w = this.canvas.width, h = this.canvas.height;

        // 1) Flash vermelho leve (tela inteira).
        if (this.flash > 0.001) {
            ctx.save();
            ctx.globalAlpha = this.flash;
            ctx.fillStyle = "#8a0f1a";
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }

        // 2) Respingos pixelados.
        if (this.drops.length) {
            const prevSmoothing = ctx.imageSmoothingEnabled;
            ctx.imageSmoothingEnabled = false;
            for (let i = 0; i < this.drops.length; i++) {
                const d = this.drops[i];
                const t = d.life / d.maxLife; // 1 -> 0
                ctx.globalAlpha = Math.max(0, Math.min(1, t * 1.2));
                ctx.fillStyle = d.color;
                const s = Math.max(2, Math.round(d.size));
                ctx.fillRect(Math.round(d.x), Math.round(d.y), s, s);
            }
            ctx.globalAlpha = 1;
            ctx.imageSmoothingEnabled = prevSmoothing;
        }
    }
}
