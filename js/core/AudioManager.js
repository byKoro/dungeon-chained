import { AUDIO_CONFIG } from '../config/AudioConfig.js';
import { LoopVoice } from './LoopVoice.js';

const dbToLin = (db) => Math.pow(10, db / 20);

export class AudioManager {

    constructor(config = AUDIO_CONFIG) {
        this.active = new Set();
        this.config = this._normalizeConfig(config);
        this.clips = {};

        this._voices = new Map();
        this._lastPlayed = new Map();

        this._ctx = null;
        this._masterNode = null;
        this._duckNode = null;
        this._duckState = { lin: 1, until: 0 };
        this._loops = new Map();
        this._buffers = new Map();
        this._loadAllClips();
    }

    _normalizeConfig(cfg) {
        if (!cfg) return { masterVolume: 1.0, muted: false, cues: {} };

        if (cfg.cues && typeof cfg.cues === "object") {
            return cfg;
        }

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

            if (cue?.loop) continue;
            if (cue?.files) {
                this._loadCue(name, cue.files);
            }
        }
    }

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

    setVolume(cueName, volume) {
        const cue = this.config.cues[cueName];
        if (!cue) return;
        cue.volume = Math.max(0, Math.min(1, volume));
    }

    getVolume(cueName) {
        return this.config.cues[cueName]?.volume ?? 0;
    }

    setMasterVolume(volume) {
        this.config.masterVolume = Math.max(0, Math.min(1, volume));
        this._syncMaster();
    }

    getMasterVolume() {
        return this.config.masterVolume ?? 1.0;
    }

    toggleMute(muted = undefined) {
        this.config.muted = muted !== undefined ? !!muted : !this.config.muted;
        if (this.config.muted) {
            this.stopAll();
        }

        this._syncMaster();
        return this.config.muted;
    }

    setEnabled(cueName, enabled) {
        const cue = this.config.cues[cueName];
        if (cue) cue.enabled = !!enabled;
    }

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

    play(name, opts = {}) {
        if (this.config.muted) return null;

        const cue = this.config.cues[name];
        if (cue && cue.enabled === false) return null;
        if (cue?.loop) return null;

        const variants = this.clips[name];
        if (!variants?.length) return null;

        const now = this._now();
        const cooldown = cue?.cooldownMs ?? 0;
        if (cooldown > 0 && now - (this._lastPlayed.get(name) ?? -Infinity) < cooldown) {
            return null;
        }
        this._lastPlayed.set(name, now);

        let voices = this._voices.get(name);
        if (!voices) this._voices.set(name, voices = []);
        const maxVoices = cue?.maxVoices ?? Infinity;
        while (voices.length >= maxVoices) {
            const old = voices.shift();
            try { old.pause(); } catch (_) {}
            this.active.delete(old);
        }

        let idx = Math.floor(Math.random() * variants.length);
        if (variants.length > 1 && idx === this._lastVariant?.[name]) {
            idx = (idx + 1 + Math.floor(Math.random() * (variants.length - 1))) % variants.length;
        }
        (this._lastVariant ??= {})[name] = idx;
        const template = variants[idx];
        const audio = template.cloneNode();

        const baseVolume = opts.volume !== undefined ? opts.volume : (cue?.volume ?? 0.7);
        const volumeMultiplier = opts.volumeMultiplier ?? 1.0;
        const master = this.config.masterVolume ?? 1.0;
        audio.volume = Math.max(0, Math.min(1, baseVolume * volumeMultiplier * master));

        let rate = opts.rate;
        if (rate === undefined) {
            const baseRate = cue?.rate ?? 1.0;
            const variance = cue?.rateVariance ?? 0.0;
            const offset = variance > 0 ? (Math.random() * 2 - 1) * variance : 0;
            rate = baseRate + offset;
        }
        rate = Math.max(0.2, Math.min(4.0, rate * (opts.rateMultiplier ?? 1.0)));
        audio.playbackRate = rate;

        if (cue?.pitchShift) audio.preservesPitch = false;
        audio.currentTime = 0;

        if (this._sfxBus) this._routeToGraph(audio, baseVolume * volumeMultiplier);

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

    _now() {
        return globalThis.performance?.now?.() ?? Date.now();
    }

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

        this._preNode = this._ctx.createGain();
        this._preNode.connect(this._masterNode);
        this._duckNode = this._ctx.createGain();
        this._duckNode.connect(this._preNode);
        this._masterNode.connect(this._ctx.destination);
        this._syncMaster();
        this._unlockOnGesture();
        return this._ctx;
    }

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

    createStreamTap(gain = 1) {
        const ctx = this._ensureContext();
        if (!ctx || typeof ctx.createMediaStreamDestination !== "function") return null;
        if (!this._tapDest) {
            this._tapDest = ctx.createMediaStreamDestination();
            this._tapGain = ctx.createGain();
            this._tapGain.connect(this._tapDest);
            this._preNode.connect(this._tapGain);
            this._sfxBus = ctx.createGain();
            this._sfxBus.connect(this._preNode);
        }
        this._tapGain.gain.value = gain;
        return this._tapDest.stream;
    }

    _routeToGraph(audio, volume) {
        const before = audio.volume;
        try {
            const src = this._ctx.createMediaElementSource(audio);
            const g = this._ctx.createGain();
            g.gain.value = Math.max(0, Math.min(1, volume));
            src.connect(g);
            g.connect(this._sfxBus);
            audio.volume = 1;
        } catch (_) {
            audio.volume = before;
        }
    }

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
            if (!buffer) return this._playLoopHtml(loop, path);
            const src = ctx.createBufferSource();
            src.buffer = buffer;
            src.loop = true;
            src.connect(loop.gain);
            src.start();
            loop.source = src;
            loop.gain.gain.setTargetAtTime(this._loopTargetLin(name, loop), ctx.currentTime, fadeMs / 3000);
        });
    }

    _playLoopHtml(loop, path) {
        if (typeof Audio === "undefined") return;
        const a = new Audio(path);
        a.loop = true;
        loop.html = a;
        a.volume = this._htmlLoopVolume(loop);
        a.play().catch(() => {});
    }

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
        loop.gain.gain.setValueAtTime(loop.gain.gain.value, t);
        loop.gain.gain.setTargetAtTime(0, t, fadeMs / 3000);
        try { loop.source?.stop(t + fadeMs / 1000 + 0.05); } catch (_) {}
    }

    createLoopVoice(name) {
        const cue = this.config.cues[name];
        if (!cue || cue.enabled === false || !cue.files?.length) return null;
        const path = cue.files[0];
        const ctx = this._ensureContext();
        ctx?.resume?.().catch(() => {});
        return new LoopVoice({
            ctx,
            output: this._preNode,
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

    setLoopLevel(name, levelDb, fadeMs = 600) {
        const loop = this._loops.get(name);
        if (!loop) return;
        loop.levelDb = levelDb;
        if (loop.html) {
            loop.html.volume = this._htmlLoopVolume(loop);
        } else if (this._ctx && loop.gain && loop.source) {
            const t = this._ctx.currentTime;
            loop.gain.gain.cancelScheduledValues(t);
            loop.gain.gain.setValueAtTime(loop.gain.gain.value, t);
            loop.gain.gain.setTargetAtTime(this._loopTargetLin(name, loop), t, fadeMs / 3000);
        }
    }

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
        g.setValueAtTime(g.value, t);
        g.setTargetAtTime(lin, t, attackMs / 3000);
        g.setTargetAtTime(1, releaseAt, releaseMs / 3000);
    }
}
