import { SIM_STEP, MAX_SIM_STEPS_PER_FRAME, HIT_SLOWMO } from '../config/GameConfig.js';

/**
 * GameLoop — dono do laço principal e do tempo da simulação.
 *
 * Separa a *condução do tempo* da *lógica de jogo*: o render roda na taxa do
 * monitor (requestAnimationFrame), mas a SIMULAÇÃO avança em passos fixos de
 * SIM_STEP (1/60 s) via acumulador. Assim movimento, física e timers (contados
 * em "frames" de 60fps) ficam idênticos em qualquer taxa de tela (60/144/240Hz).
 *
 * Também encapsula o SLOW-MOTION de abate: um timer em tempo real que escala o
 * tempo alimentado ao acumulador, desacelerando o mundo sem perder a
 * independência de framerate.
 *
 * O GameLoop não conhece o jogo — recebe callbacks:
 *   - onFrameStart(): uma vez por quadro, antes dos passos (ex.: ler gamepads).
 *   - onStep(deltaSeconds): um passo fixo de simulação.
 *   - onRender(): desenha o quadro atual (uma vez por frame).
 */
export class GameLoop {
    /**
     * @param {object} opts
     * @param {(deltaSeconds: number) => void} opts.onStep
     * @param {() => void} opts.onRender
     * @param {() => void} [opts.onFrameStart]
     */
    constructor({ onStep, onRender, onFrameStart = () => {} }) {
        this._onStep = onStep;
        this._onRender = onRender;
        this._onFrameStart = onFrameStart;

        this._lastFrameTimestamp = null;
        this._simAccumulator = 0; // tempo acumulado do fixed timestep (s)
        this._slowmoT = 0;        // segundos restantes de slow-motion de abate
        this._running = false;

        this._tick = this._tick.bind(this);
    }

    // Começa o laço (idempotente: ignora chamadas repetidas).
    start() {
        if (this._running) return;
        this._running = true;
        this._lastFrameTimestamp = null;
        requestAnimationFrame(this._tick);
    }

    // Dispara o slow-motion de abate: a simulação desacelera e volta suave ao
    // normal. Reiniciar o timer renova (não encurta) o efeito em mortes seguidas.
    triggerHitSlowmo() {
        this._slowmoT = HIT_SLOWMO.duration;
    }

    // Fator de velocidade atual da simulação (0..1). Em slow-motion começa em
    // HIT_SLOWMO.minScale (timer cheio) e sobe suavemente até 1 conforme o timer
    // esvazia (easeOutCubic). Sem efeito ativo, retorna 1.
    // Leitura pública do fator de tempo (ex.: o áudio baixa o tom no slow-mo).
    get timeScale() {
        return this._timeScale();
    }

    _timeScale() {
        if (this._slowmoT <= 0) return 1;
        const duration = HIT_SLOWMO.duration || 1;
        const progress = 1 - this._slowmoT / duration; // 0 no pico -> 1 no fim
        const eased = 1 - (1 - progress) ** 3;          // easeOutCubic
        return HIT_SLOWMO.minScale + (1 - HIT_SLOWMO.minScale) * eased;
    }

    _tick(timestamp) {
        const frameSeconds = this._lastFrameTimestamp === null
            ? 0
            : Math.min(Math.max((timestamp - this._lastFrameTimestamp) / 1000, 0), 0.25);
        this._lastFrameTimestamp = timestamp;

        // Uma vez por quadro, antes de simular (ex.: ler controles), para valer
        // em todos os passos fixos do quadro.
        this._onFrameStart();

        // Slow-motion: o timer corre em tempo REAL; só o tempo ESCALADO alimenta
        // o acumulador, então o mundo desacelera sem perder a independência de
        // framerate.
        const timeScale = this._timeScale();
        if (this._slowmoT > 0) {
            this._slowmoT = Math.max(0, this._slowmoT - frameSeconds);
        }

        this._simAccumulator += frameSeconds * timeScale;

        // Teto de passos por quadro: se o quadro atrasou muito (aba em segundo
        // plano, stall de GC), descarta o excesso para não entrar numa "espiral
        // da morte" tentando recuperar dezenas de passos de uma vez.
        const maxAccumulated = SIM_STEP * MAX_SIM_STEPS_PER_FRAME;
        if (this._simAccumulator > maxAccumulated) {
            this._simAccumulator = maxAccumulated;
        }

        while (this._simAccumulator >= SIM_STEP) {
            this._onStep(SIM_STEP);
            this._simAccumulator -= SIM_STEP;
        }

        this._onRender();
        requestAnimationFrame(this._tick);
    }
}
