import { AUDIO_CONFIG } from '../config/AudioConfig.js';
import { LoopVoice } from './LoopVoice.js';

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
 *  - Anti-"metralhadora": `cooldownMs` (intervalo mínimo entre disparos do
 *    mesmo cue) e `maxVoices` (polifonia por cue, rouba a voz mais antiga).
 *  - Multiplicadores por disparo (`rateMultiplier`, `volumeMultiplier`) para
 *    combos/sequências (tom sobe a cada acerto ou coleta seguida).
 *  - LOOPS (cues com `loop: true`, ex.: ambiente) via Web Audio: emenda
 *    sample-accurate, fade-in/out e nível em dB (setLoopLevel).
 *  - DUCKING: `duck(db)` abaixa os loops por um instante sob impactos e
 *    recupera suave (attack curto, release longo — sem "bombear").
 */
const dbToLin = (db) => Math.pow(10, db / 20);

export class AudioManager {
    /**
     * @param {Object} [config=AUDIO_CONFIG] Configuração (AUDIO_CONFIG ou mapa simples legado)
     */
    constructor(config = AUDIO_CONFIG) {
        this.active = new Set();
        this.config = this._normalizeConfig(config);
        this.clips = {};
        // Vozes ativas por cue (para maxVoices) e último disparo (cooldownMs).
        this._voices = new Map();
        this._lastPlayed = new Map();
        // Web Audio (só para loops): criado sob demanda, após gesto do usuário.
        this._ctx = null;
        this._masterNode = null;   // master + mudo
        this._duckNode = null;     // ducking dos loops
        this._duckState = { lin: 1, until: 0 };
        this._loops = new Map();   // name -> { gain, source?, html?, stopped }
        this._buffers = new Map(); // path -> Promise<AudioBuffer|null>
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
            // Loops são decodificados pelo Web Audio em playLoop (não duplica
            // o download de um arquivo longo como template de HTMLAudio).
            if (cue?.loop) continue;
            if (cue?.files) {
                this._loadCue(name, cue.files);
            }
        }
    }

    /**
     * Resolve quando os clipes estiverem prontos para tocar (canplaythrough)
     * ou falharem — com um teto de tempo, para nunca prender o carregamento.
     * @param {number} [timeoutMs=4000]
     * @param {(done:number, total:number) => void} [onProgress]
     */
    whenReady(timeoutMs = 4000, onProgress = null) {
        const clips = Object.values(this.clips).flat();
        const total = clips.length;
        let done = 0;
        onProgress?.(0, total);
        const each = clips.map(a => new Promise(res => {
            const fin = () => { done++; onProgress?.(done, total); res(); };
            if (a.readyState >= 4) return fin();
            a.addEventListener('canplaythrough', fin, { once: true });
            a.addEventListener('error', fin, { once: true });
        }));
        const timeout = new Promise(res => setTimeout(res, timeoutMs));
        return Promise.race([Promise.all(each), timeout]);
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
        this._syncMaster();
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
        // Loops seguem rodando em silêncio e voltam ao desmutar.
        this._syncMaster();
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
        this._voices.clear();
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
        if (cue?.loop) return null; // loops usam playLoop()

        const variants = this.clips[name];
        if (!variants?.length) return null;

        // Cooldown: o mesmo cue não redispara antes de `cooldownMs` (ex.: dois
        // inimigos cortados no mesmo quadro soam como UM golpe, não um eco).
        const now = this._now();
        const cooldown = cue?.cooldownMs ?? 0;
        if (cooldown > 0 && now - (this._lastPlayed.get(name) ?? -Infinity) < cooldown) {
            return null;
        }
        this._lastPlayed.set(name, now);

        // Polifonia por cue: acima de `maxVoices`, corta a voz mais ANTIGA (o
        // impacto novo importa mais que a cauda do anterior).
        let voices = this._voices.get(name);
        if (!voices) this._voices.set(name, voices = []);
        const maxVoices = cue?.maxVoices ?? Infinity;
        while (voices.length >= maxVoices) {
            const old = voices.shift();
            try { old.pause(); } catch (_) {}
            this.active.delete(old);
        }

        // Evita repetir a MESMA variante duas vezes seguidas quando há opções.
        let idx = Math.floor(Math.random() * variants.length);
        if (variants.length > 1 && idx === this._lastVariant?.[name]) {
            idx = (idx + 1 + Math.floor(Math.random() * (variants.length - 1))) % variants.length;
        }
        (this._lastVariant ??= {})[name] = idx;
        const template = variants[idx];
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
            rate = baseRate + offset;
        }
        rate = Math.max(0.2, Math.min(4.0, rate * (opts.rateMultiplier ?? 1.0)));
        audio.playbackRate = rate;
        // Por padrão o navegador preserva o tom ao mudar o rate (só acelera).
        // Cues com `pitchShift: true` mudam o TOM junto (ex.: clique agudo).
        if (cue?.pitchShift) audio.preservesPitch = false;
        audio.currentTime = 0;

        this.active.add(audio);
        voices.push(audio);
        const release = () => {
            this.active.delete(audio);
            const i = voices.indexOf(audio);
            if (i >= 0) voices.splice(i, 1);
        };
        audio.addEventListener("ended", release, { once: true });
        audio.play().catch(release);
        return audio;
    }

    // ------------------------------------------------------------------
    // Loops (ambiente) e ducking — Web Audio
    // ------------------------------------------------------------------

    _now() {
        return globalThis.performance?.now?.() ?? Date.now();
    }

    /**
     * Cria o AudioContext e o grafo dos loops (loop -> duck -> master -> saída).
     * Devolve null quando o ambiente não tem Web Audio (testes no Node,
     * navegador antigo): os loops caem no fallback de HTMLAudio.
     */
    _ensureContext() {
        if (this._ctx) return this._ctx;
        const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Ctx) return null;
        try {
            this._ctx = new Ctx();
        } catch (_) {
            return null;
        }
        this._masterNode = this._ctx.createGain();
        this._duckNode = this._ctx.createGain();
        this._duckNode.connect(this._masterNode);
        this._masterNode.connect(this._ctx.destination);
        this._syncMaster();
        this._unlockOnGesture();
        return this._ctx;
    }

    // Política de autoplay: se o contexto nasceu suspenso (ex.: ?skipTrailer
    // sem clique), retoma no primeiro gesto do jogador.
    _unlockOnGesture() {
        const ctx = this._ctx;
        if (!ctx || ctx.state !== "suspended" || typeof window === "undefined") return;
        const resume = () => {
            ctx.resume?.().catch(() => {});
            for (const ev of ["pointerdown", "keydown", "touchstart"]) {
                window.removeEventListener(ev, resume, true);
            }
        };
        for (const ev of ["pointerdown", "keydown", "touchstart"]) {
            window.addEventListener(ev, resume, true);
        }
        ctx.resume?.().catch(() => {});
    }

    // Master e mudo também valem para os loops (nó master do grafo).
    _syncMaster() {
        if (!this._masterNode || !this._ctx) return;
        const target = this.config.muted ? 0 : (this.config.masterVolume ?? 1.0);
        this._masterNode.gain.setTargetAtTime(target, this._ctx.currentTime, 0.05);
        for (const loop of this._loops.values()) {
            if (loop.html) loop.html.volume = this._htmlLoopVolume(loop);
        }
    }

    _loadBuffer(path) {
        if (!this._buffers.has(path)) {
            const ctx = this._ctx;
            const p = fetch(path)
                .then(r => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
                .then(data => new Promise((res, rej) => {
                    // Forma de callback: compatível com Safari antigo.
                    const out = ctx.decodeAudioData(data, res, rej);
                    out?.then?.(res, rej);
                }))
                .catch(() => null);
            this._buffers.set(path, p);
        }
        return this._buffers.get(path);
    }

    _loopTargetLin(name, loop) {
        const cue = this.config.cues[name];
        return (cue?.volume ?? 0.5) * dbToLin(loop.levelDb ?? 0);
    }

    _htmlLoopVolume(loop) {
        if (this.config.muted) return 0;
        const v = this._loopTargetLin(loop.name, loop) * (this.config.masterVolume ?? 1.0);
        return Math.max(0, Math.min(1, v));
    }

    /**
     * Toca um cue `loop: true` continuamente, com fade-in. Idempotente: se já
     * está tocando, não reinicia (trocar de sala não "pula" o ambiente).
     * @param {string} name
     * @param {{fadeMs?: number}} [opts]
     */
    playLoop(name, { fadeMs = 2000 } = {}) {
        const cue = this.config.cues[name];
        if (!cue || cue.enabled === false || !cue.files?.length) return;
        const existing = this._loops.get(name);
        if (existing && !existing.stopped) return;

        const loop = { name, levelDb: 0, stopped: false, gain: null, source: null, html: null };
        this._loops.set(name, loop);
        const path = cue.files[0];

        const ctx = this._ensureContext();
        if (!ctx) return this._playLoopHtml(loop, path);
        ctx.resume?.().catch(() => {});

        loop.gain = ctx.createGain();
        loop.gain.gain.value = 0;
        loop.gain.connect(this._duckNode);
        this._loadBuffer(path).then(buffer => {
            if (loop.stopped) return;
            if (!buffer) return this._playLoopHtml(loop, path); // ex.: file://
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.loop = true; // emenda sample-accurate (o arquivo é periódico)
            src.connect(loop.gain);
            src.start();
            loop.source = src;
            loop.gain.gain.setTargetAtTime(this._loopTargetLin(name, loop), ctx.currentTime, fadeMs / 3000);
        });
    }

    // Fallback sem Web Audio: HTMLAudio com loop (pode ter um respiro na emenda).
    _playLoopHtml(loop, path) {
        if (typeof Audio === "undefined") return;
        const a = new Audio(path);
        a.loop = true;
        loop.html = a;
        a.volume = this._htmlLoopVolume(loop);
        a.play().catch(() => {});
    }

    /**
     * Encerra um loop com fade-out.
     * @param {string} name
     * @param {{fadeMs?: number}} [opts]
     */
    stopLoop(name, { fadeMs = 800 } = {}) {
        const loop = this._loops.get(name);
        if (!loop || loop.stopped) return;
        loop.stopped = true;
        this._loops.delete(name);
        if (loop.html) {
            try { loop.html.pause(); } catch (_) {}
            return;
        }
        if (!this._ctx || !loop.gain) return;
        const t = this._ctx.currentTime;
        loop.gain.gain.cancelScheduledValues(t);
        loop.gain.gain.setValueAtTime(loop.gain.gain.value, t); // parte do valor atual (sem degrau)
        loop.gain.gain.setTargetAtTime(0, t, fadeMs / 3000);
        try { loop.source?.stop(t + fadeMs / 1000 + 0.05); } catch (_) {}
    }

    /**
     * Cria um loop CONTROLÁVEL (LoopVoice) para um cue `loop: true` — o jogo
     * dirige nível, tom, filtro e pulsos a cada quadro (ex.: motor da serra).
     * Vai direto ao master (não sofre o ducking do ambiente: é o som da
     * própria arma). Começa em silêncio. Devolve null se o cue não existe.
     * @param {string} name
     * @returns {LoopVoice|null}
     */
    createLoopVoice(name) {
        const cue = this.config.cues[name];
        if (!cue || cue.enabled === false || !cue.files?.length) return null;
        const path = cue.files[0];
        const ctx = this._ensureContext();
        ctx?.resume?.().catch(() => {});
        return new LoopVoice({
            ctx,
            output: this._masterNode,
            buffer: ctx ? this._loadBuffer(path) : null,
            path,
            volume: cue.volume ?? 0.5,
            masterGain: () => (this.config.muted ? 0 : (this.config.masterVolume ?? 1.0))
        });
    }

    isLoopPlaying(name) {
        const loop = this._loops.get(name);
        return !!loop && !loop.stopped;
    }

    /**
     * Ajusta o nível PERSISTENTE de um loop em dB relativo ao volume do cue
     * (0 dB = volume configurado). Ex.: -9 dB na tela de morte.
     * @param {string} name
     * @param {number} levelDb
     * @param {number} [fadeMs=600]
     */
    setLoopLevel(name, levelDb, fadeMs = 600) {
        const loop = this._loops.get(name);
        if (!loop) return;
        loop.levelDb = levelDb;
        if (loop.html) {
            loop.html.volume = this._htmlLoopVolume(loop);
        } else if (this._ctx && loop.gain && loop.source) {
            const t = this._ctx.currentTime;
            loop.gain.gain.cancelScheduledValues(t);
            loop.gain.gain.setValueAtTime(loop.gain.gain.value, t); // parte do valor atual (sem degrau)
            loop.gain.gain.setTargetAtTime(this._loopTargetLin(name, loop), t, fadeMs / 3000);
        }
    }

    /**
     * Ducking TRANSITÓRIO dos loops (sidechain manual): abaixa `amountDb`
     * rápido e recupera devagar. Ducks sobrepostos não se somam: vale o mais
     * fundo e a janela é estendida (evita "bombear").
     * @param {number} amountDb negativo, ex.: -6
     * @param {{attackMs?: number, holdMs?: number, releaseMs?: number}} [opts]
     */
    duck(amountDb, { attackMs = 15, holdMs = 120, releaseMs = 600 } = {}) {
        if (!this._ctx || !this._duckNode) return;
        const now = this._now();
        const st = this._duckState;
        let lin = dbToLin(Math.min(0, amountDb));
        if (now < st.until) lin = Math.min(lin, st.lin);
        st.lin = lin;
        st.until = Math.max(st.until, now + attackMs + holdMs);

        const g = this._duckNode.gain;
        const t = this._ctx.currentTime;
        const releaseAt = t + (st.until - now) / 1000;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t); // parte do valor atual (sem degrau)
        g.setTargetAtTime(lin, t, attackMs / 3000);
        g.setTargetAtTime(1, releaseAt, releaseMs / 3000);
    }
}
