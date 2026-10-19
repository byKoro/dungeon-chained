import { SIM_STEP, MAX_SIM_STEPS_PER_FRAME, HIT_SLOWMO } from '../config/GameConfig.js';

// Duração (s) da rampa de tempo 0 -> 1 ao sair da pausa.
const RESUME_RAMP = 0.25;

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
        this._paused = false;     // pausa: a simulação não avança (render segue)
        this._resumeT = 0;        // segundos restantes da rampa de retomada
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

    // Pausa/retoma a simulação. Pausado, o render continua (HUD viva, cena
    // congelada). Ao retomar, o tempo sobe de 0 até 1 em RESUME_RAMP segundos
    // (sem tranco, sem contagem).
    setPaused(paused) {
        paused = !!paused;
        if (paused === this._paused) return;
        this._paused = paused;
        this._simAccumulator = 0;
        this._resumeT = paused ? 0 : RESUME_RAMP;
    }

    get paused() {
        return this._paused;
    }

    // Fator de velocidade atual da simulação (0..1). Em slow-motion começa em
    // HIT_SLOWMO.minScale (timer cheio) e sobe suavemente até 1 conforme o timer
    // esvazia (easeOutCubic). Sem efeito ativo, retorna 1.
    // Leitura pública do fator de tempo (ex.: o áudio baixa o tom no slow-mo).
    get timeScale() {
        return this._timeScale();
    }

    _timeScale() {
        if (this._paused) return 0;
        // Rampa de retomada (smoothstep 0 -> 1), multiplicada pelo slow-mo.
        let ramp = 1;
        if (this._resumeT > 0) {
            const k = 1 - this._resumeT / RESUME_RAMP;
            ramp = k * k * (3 - 2 * k);
        }
        if (this._slowmoT <= 0) return ramp;
        const duration = HIT_SLOWMO.duration || 1;
        const progress = 1 - this._slowmoT / duration; // 0 no pico -> 1 no fim
        const eased = 1 - (1 - progress) ** 3;          // easeOutCubic
        return ramp * (HIT_SLOWMO.minScale + (1 - HIT_SLOWMO.minScale) * eased);
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
        // Pausado, nenhum timer de tempo corre (slow-mo/rampa ficam congelados).
        if (!this._paused) {
            if (this._slowmoT > 0) this._slowmoT = Math.max(0, this._slowmoT - frameSeconds);
            if (this._resumeT > 0) this._resumeT = Math.max(0, this._resumeT - frameSeconds);
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
