/**
 * UiSound — ponto único para os sons de interface (botões pixel art, menus).
 *
 * Os botões existem ANTES do jogo (SKIP/START do trailer), quando ainda não
 * há o AudioManager do Game. Por isso:
 *   - antes do jogo: um AudioManager mínimo só com os cues de UI;
 *   - depois: o Game chama setUiAudio(this.audio) e a UI passa a usar o
 *     mesmo gerenciador (respeita master e mudo do jogo).
 */
import { AudioManager } from '../core/AudioManager.js';
import { AUDIO_CONFIG } from '../config/AudioConfig.js';
import { MasterVolume } from '../core/MasterVolume.js';

const UI_CUES = ['uiMove', 'uiConfirm', 'uiOpen', 'uiClose'];

let shared = null;   // AudioManager do Game
let fallback = null; // criado sob demanda (trailer/carregamento)

function standalone() {
    if (!fallback && typeof Audio !== 'undefined') {
        const cues = Object.fromEntries(
            UI_CUES.filter(n => AUDIO_CONFIG.cues[n]).map(n => [n, AUDIO_CONFIG.cues[n]])
        );
        const mix = AUDIO_CONFIG.masterVolume;
        fallback = new AudioManager({
            masterVolume: mix,
            muted: AUDIO_CONFIG.muted,
            cues
        });
        // Volume geral do jogador (slider das pausas) também na UI do trailer.
        const ui = fallback;
        MasterVolume.subscribe(() => ui.setMasterVolume(mix * MasterVolume.gain()));
    }
    return fallback;
}

/** Liga a UI ao AudioManager do jogo. */
export function setUiAudio(audioManager) {
    shared = audioManager;
}

/**
 * Toca um cue de UI ('uiMove' | 'uiConfirm' | 'uiOpen' | 'uiClose').
 * Nunca lança: som de interface é cosmético.
 */
export function playUi(cue, opts) {
    try {
        return (shared || standalone())?.play(cue, opts) ?? null;
    } catch (_) {
        return null;
    }
}

// Pré-carrega os sons de UI cedo (o primeiro hover já sai sem atraso).
export function preloadUi() {
    if (!shared) standalone();
}
