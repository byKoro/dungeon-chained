import { AUDIO_CONFIG } from '../config/AudioConfig.js';

/**
 * AudioManager — Carrega e reproduz efeitos sonoros usando as configurações de AudioConfig.
 *
 * Suporta:
 *  - Controle individual de volume por caso de uso (setVolume/getVolume).
 *  - Controle de volume master e mudo (setMasterVolume/toggleMute).
 *  - Variação natural de pitch (rate + rateVariance configurados).
 *  - Ativação/desativação seletiva de sons (setEnabled).
 *  - Troca dinâmica de arquivos em tempo de execução (setFiles).
 *  - Interrupção de todos os sons ativos (stopAll).
 */
export class AudioManager {
    /**
     * @param {Object} [config=AUDIO_CONFIG] Configuração (AUDIO_CONFIG ou mapa simples legado)
     */
    constructor(config = AUDIO_CONFIG) {
        this.active = new Set();
        this.config = this._normalizeConfig(config);
        this.clips = {};
        this._loadAllClips();
    }

    _normalizeConfig(cfg) {
        if (!cfg) return { masterVolume: 1.0, muted: false, cues: {} };
        // Se já possui a estrutura completa com .cues, usa diretamente
        if (cfg.cues && typeof cfg.cues === "object") {
            return cfg;
        }
        // Compatibilidade reversa: se for um objeto simples { cueName: [paths] }
        const cues = {};
        for (const [name, paths] of Object.entries(cfg)) {
            cues[name] = {
                files: Array.isArray(paths) ? paths : [paths],
                volume: 0.7,
                rate: 1.0,
                rateVariance: 0.05,
                enabled: true
            };
        }
        return {
            masterVolume: 1.0,
            muted: false,
            cues
        };
    }

    _loadCue(name, files) {
        if (!Array.isArray(files)) return;
        this.clips[name] = files.map(path => {
            const audio = new Audio(path);
            audio.preload = "auto";
            return audio;
        });
    }

    _loadAllClips() {
        this.clips = {};
        for (const [name, cue] of Object.entries(this.config.cues)) {
            if (cue?.files) {
                this._loadCue(name, cue.files);
            }
        }
    }

    /**
     * Ajusta o volume de um caso de uso específico.
     * @param {string} cueName Nome do caso de uso (ex: "playerStep", "playerHurt")
     * @param {number} volume Valor entre 0.0 e 1.0
     */
    setVolume(cueName, volume) {
        const cue = this.config.cues[cueName];
        if (!cue) return;
        cue.volume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Obtém o volume base configurado para um caso de uso.
     * @param {string} cueName
     * @returns {number}
     */
    getVolume(cueName) {
        return this.config.cues[cueName]?.volume ?? 0;
    }

    /**
     * Ajusta o volume master geral do jogo.
     * @param {number} volume Valor entre 0.0 e 1.0
     */
    setMasterVolume(volume) {
        this.config.masterVolume = Math.max(0, Math.min(1, volume));
    }

    /**
     * Obtém o volume master geral.
     * @returns {number}
     */
    getMasterVolume() {
        return this.config.masterVolume ?? 1.0;
    }

    /**
     * Liga/desliga o mudo geral.
     * @param {boolean} [muted] Se omitido, alterna o estado atual
     * @returns {boolean} Novo estado de mudo
     */
    toggleMute(muted = undefined) {
        this.config.muted = muted !== undefined ? !!muted : !this.config.muted;
        if (this.config.muted) {
            this.stopAll();
        }
        return this.config.muted;
    }

    /**
     * Ativa ou desativa um caso de uso sonoro.
     * @param {string} cueName
     * @param {boolean} enabled
     */
    setEnabled(cueName, enabled) {
        const cue = this.config.cues[cueName];
        if (cue) cue.enabled = !!enabled;
    }

    /**
     * Altera a lista de arquivos de um caso de uso e recarrega os templates de áudio.
     * @param {string} cueName
     * @param {string[]} files
     */
    setFiles(cueName, files) {
        if (!this.config.cues[cueName]) {
            this.config.cues[cueName] = {
                volume: 0.7,
                rate: 1.0,
                rateVariance: 0.05,
                enabled: true
            };
        }
        this.config.cues[cueName].files = files;
        this._loadCue(cueName, files);
    }

    /**
     * Interrompe todos os sons que estão sendo reproduzidos no momento.
     */
    stopAll() {
        for (const audio of this.active) {
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (_) {}
        }
        this.active.clear();
    }

    /**
     * Reproduz um efeito sonoro correspondente a um caso de uso.
     * @param {string} name Nome do caso de uso (ex: "playerHurt", "pickup")
     * @param {Object} [opts={}] Opções de reprodução (override opcional de volume ou rate)
     * @returns {HTMLAudioElement|null}
     */
    play(name, opts = {}) {
        if (this.config.muted) return null;

        const cue = this.config.cues[name];
        if (cue && cue.enabled === false) return null;

        const variants = this.clips[name];
        if (!variants?.length) return null;

        const template = variants[Math.floor(Math.random() * variants.length)];
        const audio = template.cloneNode();

        // Volume: usa o volume do caso de uso ou o valor passado em opts, multiplicado por master
        const baseVolume = opts.volume !== undefined ? opts.volume : (cue?.volume ?? 0.7);
        const volumeMultiplier = opts.volumeMultiplier ?? 1.0;
        const master = this.config.masterVolume ?? 1.0;
        audio.volume = Math.max(0, Math.min(1, baseVolume * volumeMultiplier * master));

        // Pitch / Rate: taxa base + variação randômica configurada
        let rate = opts.rate;
        if (rate === undefined) {
            const baseRate = cue?.rate ?? 1.0;
            const variance = cue?.rateVariance ?? 0.0;
            const offset = variance > 0 ? (Math.random() * 2 - 1) * variance : 0;
            rate = Math.max(0.2, Math.min(4.0, baseRate + offset));
        }
        audio.playbackRate = rate;
        audio.currentTime = 0;

        this.active.add(audio);
        audio.addEventListener("ended", () => this.active.delete(audio), { once: true });
        audio.play().catch(() => this.active.delete(audio));
        return audio;
    }
}
