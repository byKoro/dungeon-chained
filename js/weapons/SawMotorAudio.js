/**
 * SawMotorAudio — o som contínuo do motor da serra, dirigido pelo giro.
 *
 * O loop (`saw-motor-loop.wav`, regime constante do circular-saw.mp3) toca
 * sempre; quem dá vida é o mapeamento do estado da arma a cada quadro:
 *
 *   giro (spin 0..1, já com inércia na SawWeapon)
 *     -> NÍVEL   spin^1.5      (curva perceptual: some suave ao parar)
 *     -> TOM     0.5x .. 1.0x  (motor "sobe" ao acelerar, "morre" ao parar)
 *     -> BRILHO  700 Hz .. 18 kHz (passa-baixa exponencial: girando devagar
 *                soa abafado; a toda, o chiado agudo dos dentes aparece)
 *
 * Eventos transitórios (LoopVoice.pulse):
 *   - onHit:  a lâmina "engasga" ao morder o inimigo — o tom cai e volta
 *             oscilando, com um leve reforço de volume (proporcional ao giro).
 *   - onSnap: engasgo maior quando a corrente arrebenta; depois o giro
 *             residual da lâmina largada faz o spin-down natural.
 * Slow-motion de abate também derruba o tom (o tempo "pesa" no som).
 */

// Abaixo disto o motor é considerado parado (nível 0).
const SILENCE_SPIN = 0.02;
const RATE_MIN = 0.5;          // tom com a serra quase parada
const RATE_MAX = 1.0;          // tom a toda (gravação original)
const CUTOFF_MIN = 700;        // Hz, girando devagar (abafado)
const CUTOFF_MAX = 18000;      // Hz, a toda (aberto)
const DROPPED_LEVEL = 0.8;     // lâmina largada no chão soa um pouco mais distante
const SLOWMO_RATE_DEPTH = 0.2; // no pico do slow-motion o tom cai ~20%
const HIT_MERGE_MS = 40;       // acertos no mesmo instante = um pulso só

/**
 * Mapeamento puro estado -> parâmetros do loop (testável sem áudio).
 * @param {number} spin 0..1
 * @param {{connected?: boolean, active?: boolean, timeScale?: number}} [state]
 * @returns {{level: number, rate: number, cutoff: number}}
 */
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
    /** @param {import('../core/LoopVoice.js').LoopVoice|null} voice */
    constructor(voice) {
        this.voice = voice;
        this.spin = 0;
        this._lastHitAt = -Infinity;
    }

    _now() {
        return globalThis.performance?.now?.() ?? Date.now();
    }

    /**
     * Chamar uma vez por quadro (inclusive pausas/game over, para o som
     * acompanhar e silenciar — nunca "congela" no último valor).
     */
    update(spin, state = {}) {
        if (!this.voice) return;
        this.spin = spin || 0;
        const t = motorTargets(this.spin, state);
        // Fora de jogo (morte/transição) some mais devagar; em jogo segue o
        // giro rápido (o spin já é suavizado pela inércia da SawWeapon).
        this.voice.set(t, state.active === false ? 0.25 : 0.04);
    }

    /** A lâmina mordeu um inimigo: engasgo curto proporcional ao giro. */
    onHit() {
        if (!this.voice || this.spin < 0.15) return;
        const now = this._now();
        if (now - this._lastHitAt < HIT_MERGE_MS) return;
        this._lastHitAt = now;
        const v = 0.85 + Math.random() * 0.3; // variação orgânica ±15%
        this.voice.pulse({
            cents: -240 * this.spin * v,
            gainDb: 2.5 * this.spin,
            hz: 10 * v,
            decay: 0.08,
            duration: 0.32
        });
    }

    /** Corrente arrebentou: engasgo forte antes do spin-down. */
    onSnap() {
        if (!this.voice || this.spin < 0.05) return;
        this.voice.pulse({ cents: -520 * this.spin, gainDb: 3.5, hz: 6, decay: 0.15, duration: 0.5 });
    }

    stop(fadeMs) {
        this.voice?.stop(fadeMs);
        this.voice = null;
    }
}
