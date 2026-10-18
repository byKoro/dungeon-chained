/**
 * TrailerPlayer — toca as cenas do trailer em sequência.
 *
 * Cada cena (js/trailer/scenes/*) expõe { start(), update(dt), render(),
 * isDone } e, opcionalmente, `cutIn = 'impact'` (entra em CORTE SECO com
 * quadro de impacto: imagem invertida + clarão + tremor). Sem cutIn, a
 * próxima cena começa no mesmo quadro em que a anterior termina (sem corte).
 * Por cima de tudo: camada de sangue em tela, barras de cinema e, se
 * `showTimer`, um cronômetro discreto (para pedir ajustes com precisão).
 *
 * Para ADICIONAR UMA CENA: crie o arquivo em scenes/, importe aqui e inclua
 * em SCENES na posição desejada.
 */
import { TrailerStage } from './TrailerStage.js';
import { IntroScene } from './scenes/IntroScene.js';
import { TitleBloodScene } from './scenes/TitleBloodScene.js';
import { FrenzyScene } from './scenes/frenzy/FrenzyScene.js';
import { ZigZagShot } from './scenes/montage/ZigZagShot.js';
import { SnapShot } from './scenes/montage/SnapShot.js';
import { SplitShot } from './scenes/montage/SplitShot.js';

const SCENES = [IntroScene, TitleBloodScene, FrenzyScene, ZigZagShot, SnapShot, SplitShot];

const IMPACT_INVERT = 0.06;   // s de imagem invertida (quadro de impacto)
const IMPACT_FLASH = 0.22;    // s até o clarão branco sumir

export class TrailerPlayer {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {AssetLoader} assets  loader compartilhado (aguarde whenReady()
     *   DEPOIS de criar o player: o stage registra imagens próprias nele).
     * @param {object} [opts]
     * @param {() => void} [opts.onEnd]  chamado UMA vez quando o trailer chega
     *   ao fim (a última cena segue em loop por baixo).
     * @param {boolean} [opts.showTimer] mostra o cronômetro discreto.
     */
    constructor(canvas, assets, opts = {}) {
        this.stage = new TrailerStage(canvas, assets);
        this.scenes = SCENES.map(Scene => new Scene(this.stage));
        this.onEnd = opts.onEnd || null;
        this.showTimer = !!opts.showTimer;
        this.index = 0;
        this.running = false;
        this.ended = false;
        this.time = 0;
        this.sceneTime = 0;
        this.impactT = -1;
        this._raf = 0;
        this._last = 0;
        this._frame = (now) => this._tick(now);
    }

    get current() { return this.scenes[this.index]; }

    /** Começa (ou recomeça) a partir da cena `from` (índice). */
    play(from = 0) {
        this.stage.attach();
        this.stage.resetActors();
        this.scenes.forEach(s => s.reset?.());
        this.index = Math.max(0, Math.min(from, this.scenes.length - 1));
        this.ended = false;
        this.time = 0;
        this.sceneTime = 0;
        this.impactT = -1;
        this.current.start();
        if (!this.running) {
            this.running = true;
            this._last = performance.now();
            this._raf = requestAnimationFrame(this._frame);
        }
    }

    /** Para o loop e solta os listeners (antes de o jogo assumir o canvas). */
    stop() {
        this.running = false;
        cancelAnimationFrame(this._raf);
        this.stage.detach();
        const ctx = this.stage.ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
    }

    _tick(now) {
        if (!this.running) return;
        const dt = Math.min(0.05, (now - this._last) / 1000); // dt limitado
        this._last = now;
        this.update(dt);
        this.render();
        this._raf = requestAnimationFrame(this._frame);
    }

    update(dt) {
        const st = this.stage;
        this.time += dt;
        this.sceneTime += dt;
        this.current.update(dt);
        if (this.current.isDone && this.index < this.scenes.length - 1) {
            this.index++;
            this.sceneTime = 0;
            this.current.start();
            if (this.current.cutIn === 'impact') this.impactT = 0;
        }
        if (this.impactT >= 0) {
            this.impactT += dt;
            if (this.impactT > IMPACT_FLASH) this.impactT = -1;
        }
        st._tickExpressions(dt);
        st.tickSpeech(dt);
        if (st.bloodScreen.mode === 'drain') st.bloodScreen.update(dt);

        if (!this.ended && this.index === this.scenes.length - 1 && this.current.reachedEnd) {
            this.ended = true;
            this.onEnd?.();
        }
    }

    render() {
        const { ctx, canvas } = this.stage;
        this.current.render();
        this.stage.bloodScreen.draw(ctx);
        this._drawImpact(ctx, canvas);
        this.stage.drawLetterbox();
        if (this.showTimer) this._drawTimer(ctx, canvas);
    }

    // Quadro de impacto do corte seco: inverte as cores por ~3 quadros e
    // depois um clarão branco que some rápido.
    _drawImpact(ctx, canvas) {
        const t = this.impactT;
        if (t < 0) return;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        if (t < IMPACT_INVERT) {
            ctx.globalCompositeOperation = 'difference';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            const k = 1 - (t - IMPACT_INVERT) / (IMPACT_FLASH - IMPACT_INVERT);
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * k * k})`;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.restore();
    }

    // Cronômetro discreto na barra de cinema inferior:
    // "12.4s · cena 3 ZigZagShot +1.2s".
    _drawTimer(ctx, canvas) {
        const name = this.current.constructor.name;
        const txt = `${this.time.toFixed(1)}s · cena ${this.index} ${name} +${this.sceneTime.toFixed(1)}s`;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.font = '11px monospace';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(167, 169, 190, 0.45)';
        ctx.fillText(txt, 10, canvas.height - 8);
        ctx.restore();
    }
}
