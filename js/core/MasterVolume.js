const KEY = 'dungeonChained.masterVolume';
const STEP = 0.05;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function load() {
    try {
        const raw = globalThis.localStorage?.getItem(KEY);
        const v = raw === null || raw === undefined ? NaN : parseFloat(raw);
        return Number.isFinite(v) ? clamp01(v) : 0.8;
    } catch { return 0.8; }
}

let value = load();
const listeners = new Set();

export const MasterVolume = {

    get value() { return value; },

    gain(v = value) { return v * v; },

    set(v) {
        v = Math.round(clamp01(v) / STEP) * STEP;
        v = Math.round(v * 100) / 100;
        if (v === value) return value;
        value = v;
        try { globalThis.localStorage?.setItem(KEY, String(v)); } catch {   }
        for (const fn of listeners) { try { fn(v); } catch {   } }
        return value;
    },

    subscribe(fn) {
        listeners.add(fn);
        fn(value);
        return () => listeners.delete(fn);
    },

    STEP
};
