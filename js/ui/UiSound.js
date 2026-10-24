import { AudioManager } from '../core/AudioManager.js';
import { AUDIO_CONFIG } from '../config/AudioConfig.js';
import { MasterVolume } from '../core/MasterVolume.js';

const UI_CUES = ['uiMove', 'uiConfirm', 'uiOpen', 'uiClose'];

let shared = null;
let fallback = null;

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

        const ui = fallback;
        MasterVolume.subscribe(() => ui.setMasterVolume(mix * MasterVolume.gain()));
    }
    return fallback;
}

export function setUiAudio(audioManager) {
    shared = audioManager;
}

export function playUi(cue, opts) {
    try {
        return (shared || standalone())?.play(cue, opts) ?? null;
    } catch (_) {
        return null;
    }
}

export function preloadUi() {
    if (!shared) standalone();
}
