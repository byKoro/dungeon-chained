/**
 * TitleBloodScene — cartela "DUNGEON CHAINED" que começa a piscar em
 * vermelho, gotas GRANDES de sangue voam e enchem a tela; com a tela coberta
 * o sangue começa a ESCORRER (BloodScreen.startDrain) e a cena termina — a
 * próxima é revelada por baixo do sangue escorrendo (sem corte).
 */
import { clamp01, easeInOut, hash01 } from '../anim.js';

// Linha do tempo (segundos a partir da cartela preta).
export const TITLE_TIMING = {
    flickerStart: 2.0,  // cartela parada antes de começar a piscar
    sprayStart: 2.6,    // primeiras gotas
    sprayFull: 4.6,     // tela totalmente coberta
    drainStart: 5.0     // começa a escorrer -> próxima cena
};

export class TitleBloodScene {
    constructor(stage) {
        this.stage = stage;
        this.reset();
    }

    reset() { this.t = 0; this.done = false; }
    start() { this.reset(); }
    get isDone() { return this.done; }

    update(dt) {
        const T = TITLE_TIMING;
        const bs = this.stage.bloodScreen;
        this.t += dt;
        if (this.t >= T.sprayStart && bs.mode === 'idle') bs.startSpray();
        if (bs.mode === 'spray') {
            bs.update(dt, clamp01((this.t - T.sprayStart) / (T.sprayFull - T.sprayStart)));
            if (this.t >= T.sprayFull) bs.flood();
        }
        if (this.t >= T.drainStart && !this.done) {
            bs.startDrain();
            this.done = true;
        }
    }

    render() {
        const { ctx, canvas } = this.stage;
        const T = TITLE_TIMING;
        const W = canvas.width, H = canvas.height;
        const t = this.t;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#030208';
        ctx.fillRect(0, 0, W, H);

        // Pisca vermelho: estroboscópio irregular cada vez mais forte/frequente.
        const amt = easeInOut(clamp01((t - T.flickerStart) / (T.sprayFull - T.flickerStart)));
        let red = 0;
        if (amt > 0) {
            const on = hash01(Math.floor(t * 14)) < 0.3 + 0.45 * amt;
            ctx.fillStyle = on
                ? `rgba(150, 0, 18, ${0.25 + 0.5 * amt})`
                : `rgba(55, 0, 8, ${0.35 * amt})`;
            ctx.fillRect(0, 0, W, H);
            red = on ? Math.max(0.6, amt) : amt * 0.4;
        }
        ctx.restore();
        this.stage.drawTitleText(red);
    }
}
