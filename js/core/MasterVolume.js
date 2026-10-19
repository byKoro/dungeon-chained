/**
 * MasterVolume — volume GERAL escolhido pelo jogador (slider dos menus de
 * pausa do trailer e do jogo). Um valor só, 0..1, salvo no navegador e
 * compartilhado por todos os sistemas de som:
 *   - AudioManager do jogo (Game) e o da UI antes do jogo (UiSound);
 *   - TrailerAudio (trilha + efeitos do trailer).
 *
 * `gain()` converte o valor do slider (linear, o que o jogador vê) em ganho
 * com curva quadrática (perto da percepção de volume: metade do slider soa
 * como "metade", não quase igual ao máximo).
 */
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
    /** Valor do slider (0..1). */
    get value() { return value; },

    /** Ganho perceptual para multiplicar no master de cada sistema. */
    gain(v = value) { return v * v; },

    /** Ajusta (arredonda em passos de 5%), salva e avisa quem ouve. */
    set(v) {
        v = Math.round(clamp01(v) / STEP) * STEP;
        v = Math.round(v * 100) / 100;
        if (v === value) return value;
        value = v;
        try { globalThis.localStorage?.setItem(KEY, String(v)); } catch { /* modo privado */ }
        for (const fn of listeners) { try { fn(v); } catch { /* um ouvinte não derruba os outros */ } }
        return value;
    },

    /** Avisa a cada mudança (e já chama uma vez com o valor atual). */
    subscribe(fn) {
        listeners.add(fn);
        fn(value);
        return () => listeners.delete(fn);
    },

    STEP
};
