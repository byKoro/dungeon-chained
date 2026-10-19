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

    reset() { this.t = 0; this.done = false; this._strobe = -1; this._sfx = {}; }
    start() {
        this.reset();
        // Cartela: golpe do título (a música volta abafada por baixo).
        const au = this.stage.audio;
        au?.play('sting', { vol: 1, noSlow: true });
        au?.duck(-12, 0.3, 1.4);
        const bs = this.stage.bloodScreen;
        // Cada gota que bate na lente: respingo (volume pelo tamanho).
        bs.onSplat = (x, y, r) => au?.play('splat', {
            vol: Math.min(0.7, 0.18 + r / 140), rate: 1.25 - Math.min(0.5, r / 200),
            pan: au.panX(x, this.stage.canvas.width), cool: 0.045
        });
    }
    get isDone() { return this.done; }
    // Sem câmera, serra ou passos nesta cartela; ambiente bem baixo.
    audioState() { return { cam: null, saw: null, players: null, amb: 0.3, shake: 0 }; }

    update(dt) {
        const T = TITLE_TIMING;
        const bs = this.stage.bloodScreen;
        const au = this.stage.audio;
        const once = (k, fn) => { if (!this._sfx[k]) { this._sfx[k] = true; fn(); } };
        this.t += dt;
        // Som do estroboscópio: mesmo sorteio do render, zap a cada piscada.
        const amt = easeInOut(clamp01((this.t - T.flickerStart) / (T.sprayFull - T.flickerStart)));
        if (amt > 0) {
            const k = Math.floor(this.t * 14);
            if (k !== this._strobe) {
                this._strobe = k;
                if (hash01(k) < 0.3 + 0.45 * amt) au?.play('zap', { vol: 0.2 + 0.35 * amt, rate: 0.9 + amt * 0.4, cool: 0.05 });
            }
        }
        if (this.t >= T.flickerStart) once('flicker', () => au?.mood(-10, 2600, 1.4));
        if (this.t >= T.sprayStart - 1.3) once('riser', () => au?.play('riser', { vol: 0.75 }));
        if (this.t >= T.sprayStart) once('spray', () => { au?.mood(-4, 9000, 2); au?.play('impact', { vol: 0.6 }); });
        if (this.t >= T.sprayStart && bs.mode === 'idle') bs.startSpray();
        if (bs.mode === 'spray') {
            bs.update(dt, clamp01((this.t - T.sprayStart) / (T.sprayFull - T.sprayStart)));
            if (this.t >= T.sprayFull) {
                bs.flood();
                once('flood', () => { au?.play('boom', { vol: 0.7 }); au?.play('splat', { vol: 0.9, rate: 0.6, cool: 0 }); au?.excite(0.6); });
            }
        }
        if (this.t >= T.drainStart && !this.done) {
            bs.startDrain();
            bs.onSplat = null;
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
