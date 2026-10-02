import { HAZARDS } from '../config/GameConfig.js';

/**
 * PressureButton — botão de piso que fica "pressionado" enquanto um player
 * estiver em cima. Usado no desafio co-op: os DOIS botões precisam estar
 * pressionados ao mesmo tempo para abrir a saída. Forma geométrica por
 * enquanto (sprite virá depois).
 */
export class PressureButton {
    constructor(x, y, opts = {}) {
        this.x = x;
        this.y = y;
        this.hitRadius = 0;
        this.cfg = opts.cfg || HAZARDS.button;
        this.pressed = false;
        this.press = 0;   // 0..1 animação de afundar
        this.pulse = 0;
    }

    // Atualiza o estado a partir das posições dos players.
    update(players) {
        const r = this.cfg.pressRadius;
        this.pressed = players.some(
            p => Math.hypot(p.x - this.x, p.y - this.y) < r
        );
        const target = this.pressed ? 1 : 0;
        this.press += (target - this.press) * 0.3;
        this.pulse += this.cfg.pulseSpeed;
    }

    draw(ctx) {
        const cfg = this.cfg;
        const R = cfg.radius;

        ctx.save();
        // Sombra/encaixe no chão.
        ctx.fillStyle = cfg.baseColor;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, R, R * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Anel externo.
        ctx.strokeStyle = cfg.ringColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, R, R * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Topo do botão (sobe quando solto, afunda quando pressionado).
        const lift = (1 - this.press) * 6;
        const topR = R * 0.62;
        const color = this.pressed ? cfg.pressedColor : cfg.idleColor;
        // leve brilho pulsante quando solto (chama a atenção)
        const glow = this.pressed ? 1 : 0.75 + 0.25 * Math.abs(Math.sin(this.pulse));
        ctx.globalAlpha = glow;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - lift, topR, topR * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#1b1620";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - lift, topR, topR * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}
