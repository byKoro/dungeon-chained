const SILENCE_SPIN = 0.02;
const RATE_MIN = 0.5;
const RATE_MAX = 1.0;
const CUTOFF_MIN = 700;
const CUTOFF_MAX = 18000;
const DROPPED_LEVEL = 0.8;
const SLOWMO_RATE_DEPTH = 0.2;
const HIT_MERGE_MS = 40;

export function motorTargets(spin, { connected = true, active = true, timeScale = 1 } = {}) {
    const s = Math.max(0, Math.min(1, spin || 0));
    let level = s <= SILENCE_SPIN ? 0 : Math.pow(s, 1.5);
    if (!connected) level *= DROPPED_LEVEL;
    if (!active) level = 0;
    const ts = Math.max(0, Math.min(1, timeScale));
    const rate = (RATE_MIN + (RATE_MAX - RATE_MIN) * s) * (1 - SLOWMO_RATE_DEPTH * (1 - ts));
    const cutoff = CUTOFF_MIN * Math.pow(CUTOFF_MAX / CUTOFF_MIN, Math.pow(s, 1.2));
    return { level, rate, cutoff };
}

export class SawMotorAudio {

    constructor(voice) {
        this.voice = voice;
        this.spin = 0;
        this._lastHitAt = -Infinity;
    }

    _now() {
        return globalThis.performance?.now?.() ?? Date.now();
    }

    update(spin, state = {}) {
        if (!this.voice) return;
        this.spin = spin || 0;
        const t = motorTargets(this.spin, state);

        this.voice.set(t, state.active === false ? 0.25 : 0.04);
    }

    onHit() {
        if (!this.voice || this.spin < 0.15) return;
        const now = this._now();
        if (now - this._lastHitAt < HIT_MERGE_MS) return;
        this._lastHitAt = now;
        const v = 0.85 + Math.random() * 0.3;
        this.voice.pulse({
            cents: -240 * this.spin * v,
            gainDb: 2.5 * this.spin,
            hz: 10 * v,
            decay: 0.08,
            duration: 0.32
        });
    }

    onSnap() {
        if (!this.voice || this.spin < 0.05) return;
        this.voice.pulse({ cents: -520 * this.spin, gainDb: 3.5, hz: 6, decay: 0.15, duration: 0.5 });
    }

    stop(fadeMs) {
        this.voice?.stop(fadeMs);
        this.voice = null;
    }
}
