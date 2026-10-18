/**
 * TrailerPlayer — toca as cenas do trailer em sequência.
 *
 * Cada cena (js/trailer/scenes/*) expõe { start(), update(dt), render(),
 * isDone }. Quando uma termina, a próxima começa NO MESMO quadro (as cenas são
 * escritas para que o último quadro de uma seja o primeiro da outra, então
 * não há corte seco). Por cima de qualquer cena o player desenha a camada de
 * sangue em tela (stage.bloodScreen) e as barras de cinema.
 *
 * Para ADICIONAR UMA CENA: crie o arquivo em scenes/, importe aqui e inclua
 * em SCENES na posição desejada.
 */
import { TrailerStage } from './TrailerStage.js';
import { IntroScene } from './scenes/IntroScene.js';
import { TitleBloodScene } from './scenes/TitleBloodScene.js';
import { FrenzyScene } from './scenes/frenzy/FrenzyScene.js';

const SCENES = [IntroScene, TitleBloodScene, FrenzyScene];

export class TrailerPlayer {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {AssetLoader} assets  loader compartilhado (aguarde whenReady()
     *   DEPOIS de criar o player: o stage registra imagens próprias nele).
     * @param {object} [opts]
     * @param {() => void} [opts.onEnd]  chamado UMA vez quando o trailer chega
     *   ao fim (a última cena segue em loop por baixo).
     */
    constructor(canvas, assets, opts = {}) {
        this.stage = new TrailerStage(canvas, assets);
        this.scenes = SCENES.map(Scene => new Scene(this.stage));
        this.onEnd = opts.onEnd || null;
        this.index = 0;
        this.running = false;
        this.ended = false;
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
        this.current.update(dt);
        // Troca de cena sem corte: a próxima começa no mesmo quadro.
        if (this.current.isDone && this.index < this.scenes.length - 1) {
            this.index++;
            this.current.start();
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
        this.current.render();
        this.stage.bloodScreen.draw(this.stage.ctx);
        this.stage.drawLetterbox();
    }
}
