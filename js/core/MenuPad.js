import { MENU_PAD } from '../config/GameConfig.js';

const DIRECTIONS = ['up', 'down', 'left', 'right'];
const KEYS = ['start', 'a', 'b', ...DIRECTIONS];

const isPressed = (btn) => !!btn && (typeof btn === 'object' ? btn.pressed : btn > 0.5);

export class MenuPad {

    constructor({ getPads = defaultPads, config = MENU_PAD } = {}) {
        this.getPads = getPads;
        this.config = config;
        this._prev = null;
        this._prevAny = null;
        this._heldSince = {};
        this._nextRepeat = {};
    }

    _readState() {
        const { buttons: B, axisThreshold: T } = this.config;
        const state = Object.fromEntries(KEYS.map(k => [k, false]));
        const any = new Set();
        for (const pad of this.getPads() || []) {
            if (!pad) continue;
            const btn = (i) => isPressed(pad.buttons?.[i]);
            const ax = pad.axes?.[0] || 0, ay = pad.axes?.[1] || 0;
            state.start ||= btn(B.start);
            state.a ||= btn(B.a);
            state.b ||= btn(B.b);
            state.up ||= btn(B.up) || ay < -T;
            state.down ||= btn(B.down) || ay > T;
            state.left ||= btn(B.left) || ax < -T;
            state.right ||= btn(B.right) || ax > T;
            (pad.buttons || []).forEach((b, i) => { if (isPressed(b)) any.add(`${pad.index ?? 0}:${i}`); });
        }
        return { state, any };
    }

    // Botões já segurados no 1º poll não disparam: o Start que fechou o trailer não pausa o jogo.
    poll(nowMs = performance.now()) {
        const { state, any } = this._readState();
        const hits = Object.fromEntries(KEYS.map(k => [k, false]));
        hits.any = false;
        if (!this._prev) {
            this._prev = state;
            this._prevAny = any;
            for (const d of DIRECTIONS) if (state[d]) this._heldSince[d] = Infinity;
            return hits;
        }
        for (const k of KEYS) hits[k] = state[k] && !this._prev[k];
        for (const id of any) if (!this._prevAny.has(id)) hits.any = true;

        const { repeatDelayMs, repeatMs } = this.config;
        for (const d of DIRECTIONS) {
            if (!state[d]) { delete this._heldSince[d]; continue; }
            if (hits[d]) { this._heldSince[d] = nowMs; this._nextRepeat[d] = nowMs + repeatDelayMs; continue; }
            if (this._heldSince[d] === Infinity) continue;
            if (nowMs >= this._nextRepeat[d]) {
                hits[d] = true;
                this._nextRepeat[d] = nowMs + repeatMs;
            }
        }
        this._prev = state;
        this._prevAny = any;
        return hits;
    }
}

function defaultPads() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
    return navigator.getGamepads() || [];
}
