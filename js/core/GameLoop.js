import { SIM_STEP, MAX_SIM_STEPS_PER_FRAME, HIT_SLOWMO, HIT_STOP } from '../config/GameConfig.js';

const RESUME_RAMP = 0.25;

export class GameLoop {

    constructor({ onStep, onRender, onFrameStart = () => {} }) {
        this._onStep = onStep;
        this._onRender = onRender;
        this._onFrameStart = onFrameStart;

        this._lastFrameTimestamp = null;
        this._simAccumulator = 0;
        this._slowmoT = 0;
        this._paused = false;
        this._resumeT = 0;
        this._hitStopT = 0;
        this._hitStopGap = 0;
        this._running = false;

        this._tick = this._tick.bind(this);
    }

    start() {
        if (this._running) return;
        this._running = true;
        this._lastFrameTimestamp = null;
        requestAnimationFrame(this._tick);
    }

    triggerHitSlowmo() {
        this._slowmoT = HIT_SLOWMO.duration;
    }

    // Congela só a simulação por `seconds` de tempo real (limitado a HIT_STOP.min..max); o render segue.
    // Pedidos durante outro hit stop só estendem até o maior valor (não somam); retorna se foi aceito.
    triggerHitStop(seconds) {
        if (this._paused || this._hitStopGap > 0 || !(seconds > 0)) return false;
        const t = Math.min(HIT_STOP.max, Math.max(HIT_STOP.min, seconds));
        this._hitStopT = Math.max(this._hitStopT, t);
        return true;
    }

    get hitStopActive() {
        return this._hitStopT > 0;
    }

    setPaused(paused) {
        paused = !!paused;
        if (paused === this._paused) return;
        this._paused = paused;
        this._simAccumulator = 0;
        if (paused) { this._hitStopT = 0; this._hitStopGap = 0; }
        this._resumeT = paused ? 0 : RESUME_RAMP;
    }

    get paused() {
        return this._paused;
    }

    get timeScale() {
        return this._timeScale();
    }

    _timeScale() {
        if (this._paused) return 0;

        let ramp = 1;
        if (this._resumeT > 0) {
            const k = 1 - this._resumeT / RESUME_RAMP;
            ramp = k * k * (3 - 2 * k);
        }
        if (this._slowmoT <= 0) return ramp;
        const duration = HIT_SLOWMO.duration || 1;
        const progress = 1 - this._slowmoT / duration;
        const eased = 1 - (1 - progress) ** 3;
        return ramp * (HIT_SLOWMO.minScale + (1 - HIT_SLOWMO.minScale) * eased);
    }

    _tick(timestamp) {
        const frameSeconds = this._lastFrameTimestamp === null
            ? 0
            : Math.min(Math.max((timestamp - this._lastFrameTimestamp) / 1000, 0), 0.25);
        this._lastFrameTimestamp = timestamp;

        this._onFrameStart();

        // Hit stop: a simulação não avança e os timers de slow-mo/retomada ficam parados, então o
        // slow-mo de abate toca depois do congelamento. Render e polling de entrada continuam.
        if (this._hitStopT > 0 && !this._paused) {
            this._hitStopT = Math.max(0, this._hitStopT - frameSeconds);
            if (this._hitStopT === 0) this._hitStopGap = HIT_STOP.minGap;
            this._onRender();
            requestAnimationFrame(this._tick);
            return;
        }
        if (this._hitStopGap > 0) this._hitStopGap = Math.max(0, this._hitStopGap - frameSeconds);

        const timeScale = this._timeScale();

        if (!this._paused) {
            if (this._slowmoT > 0) this._slowmoT = Math.max(0, this._slowmoT - frameSeconds);
            if (this._resumeT > 0) this._resumeT = Math.max(0, this._resumeT - frameSeconds);
        }

        this._simAccumulator += frameSeconds * timeScale;

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
