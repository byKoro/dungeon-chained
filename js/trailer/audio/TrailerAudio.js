import { MasterVolume } from '../../core/MasterVolume.js';

const A = 'assets/audio/', T = 'assets/audio/trailer/';
const nums = (base, n, ext = 'wav') => Array.from({ length: n }, (_, i) => `${base}-0${i + 1}.${ext}`);

const SOUNDS = {
    whoosh: nums(T + 'whoosh', 3), impact: nums(T + 'impact', 3), boom: nums(T + 'boom', 3),
    splat: nums(T + 'splat', 4), flame: nums(T + 'flame', 2), pop: nums(T + 'pop', 3),
    blip: nums(T + 'blip', 2), thunk: nums(T + 'thunk', 2), zap: nums(T + 'zap', 2), rope: nums(T + 'rope', 2),
    riser: [T + 'riser.wav'], sting: [T + 'sting.wav'], beamCharge: [T + 'beam-charge.wav'],
    beamFire: [T + 'beam-fire.wav'], roar: [T + 'roar.wav'], stoneClick: [T + 'stone-click.wav'],
    stoneGrind: [T + 'stone-grind.wav'], thud: [T + 'thud.wav'], crack: [T + 'crack.wav'],
    slowmo: [T + 'slowmo.wav'], heartbeat: [T + 'heartbeat.wav'],
    sawHit: nums(A + 'saw-hit', 3), sawSnap: [A + 'saw-snap.wav'], sawLand: nums(A + 'saw-land', 2),
    sawPickup: [A + 'saw-pickup.wav'], footstep: nums(A + 'footstep-stone', 6, 'ogg'),
    swish: nums(A + 'enemy-attack', 3), doorOpen: [A + 'door-open.wav'], fall: [A + 'player-fall.wav'],
    enemySpawn: nums(A + 'enemy-spawn', 3), arrow: nums(A + 'arrow-fire', 3),
    playerHit: nums(A + 'player-hit', 3), buttonPress: nums(A + 'button-press', 2),
    buttonRelease: [A + 'button-release.wav']
};
const LOOPS = {
    music: 'assets/audio/music/megasong.mp3',
    amb: A + 'ambience-dungeon.wav',
    rumble: T + 'rumble-loop.wav',
    saw: A + 'saw-motor-loop.wav'
};

const HEAVY = new Set(['impact', 'boom', 'sting']);
const MAX_VOICES = 28;
const db = (d) => Math.pow(10, d / 20);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class TrailerAudio {
    constructor() {
        this.ctx = null;
        this.buffers = {};
        this.loops = {};
        this._last = {};
        this._lastIdx = {};
        this._voices = 0;
        this.excitement = 0;
        this._mood = { db: -60, lp: 20000 };
        this._slow = 1;
        this._prevCam = null;
        this._steps = new WeakMap();
        this._lastHeavy = -1;
        this.ready = Promise.resolve();
        const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Ctx) return;
        try { this.ctx = new Ctx(); } catch { this.ctx = null; return; }
        this._build();
        this.ready = this._loadAll();
    }

    get available() { return !!this.ctx; }
    get running() { return !!this.ctx && (this.ctx.state === 'running' || this.paused); }
    get now() { return this.ctx ? this.ctx.currentTime : 0; }
    unlock() { return this.ctx?.resume?.() ?? Promise.resolve(); }

    pause() {
        if (!this.ctx || this.paused) return;
        this.paused = true;
        const g = this.pauseGain.gain, t = this.ctx.currentTime;
        g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(0.0001, t + 0.15);
        clearTimeout(this._pauseTimer);
        this._pauseTimer = setTimeout(() => { if (this.paused) this.ctx.suspend?.(); }, 170);
    }
    resume() {
        if (!this.ctx || !this.paused) return;
        this.paused = false;
        clearTimeout(this._pauseTimer);
        this.ctx.resume?.().then(() => {
            const g = this.pauseGain.gain, t = this.ctx.currentTime;
            g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t);
            g.linearRampToValueAtTime(1, t + 0.25);
        });
    }

    _build() {
        const c = this.ctx;
        this.comp = c.createDynamicsCompressor();
        this.comp.threshold.value = -10; this.comp.knee.value = 6; this.comp.ratio.value = 10;
        this.comp.attack.value = 0.003; this.comp.release.value = 0.25;
        this.master = c.createGain(); this.master.gain.value = 0.8;
        this.user = c.createGain(); this.user.gain.value = MasterVolume.gain();
        this.pauseGain = c.createGain(); this.pauseGain.gain.value = 1;
        this.master.connect(this.comp); this.comp.connect(this.user);
        this.user.connect(this.pauseGain); this.pauseGain.connect(c.destination);
        MasterVolume.subscribe(() => this.user.gain.setTargetAtTime(MasterVolume.gain(), c.currentTime, 0.03));

        this.musicLP = c.createBiquadFilter(); this.musicLP.type = 'lowpass'; this.musicLP.frequency.value = 20000; this.musicLP.Q.value = 0.5;
        this.musicGain = c.createGain(); this.musicGain.gain.value = 0;
        this.musicDuck = c.createGain(); this.musicDuck.gain.value = 1;
        this.musicLP.connect(this.musicGain); this.musicGain.connect(this.musicDuck); this.musicDuck.connect(this.master);

        this.sfxLP = c.createBiquadFilter(); this.sfxLP.type = 'lowpass'; this.sfxLP.frequency.value = 20000;
        this.sfx = c.createGain(); this.sfx.gain.value = 0.95;
        this.sfx.connect(this.sfxLP); this.sfxLP.connect(this.master);
        this.bed = c.createGain(); this.bed.gain.value = 1; this.bed.connect(this.master);

        const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
        const d = nb.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this._noise = nb;
    }

    async _load(path) {
        try {
            const res = await fetch(path);
            if (!res.ok) return null;
            const ab = await res.arrayBuffer();
            return await new Promise((ok) => this.ctx.decodeAudioData(ab, ok, () => ok(null)));
        } catch { return null; }
    }
    async _loadAll() {
        const jobs = [];
        for (const [name, files] of Object.entries(SOUNDS)) {
            jobs.push(Promise.all(files.map(f => this._load(f))).then(bs => { this.buffers[name] = bs.filter(Boolean); }));
        }
        for (const [name, path] of Object.entries(LOOPS)) {
            jobs.push(this._load(path).then(b => { this.buffers['loop:' + name] = b; }));
        }
        await Promise.all(jobs);
    }

    start({ music = true } = {}) {
        if (!this.ctx) return;
        this.stopAll(0.05);
        this._gen = (this._gen || 0) + 1;
        const c = this.ctx, t = c.currentTime;
        this._mood = { db: -60, lp: 20000 };
        this.excitement = 0;
        this._prevCam = null;
        this.musicDuck.gain.cancelScheduledValues(t); this.musicDuck.gain.setValueAtTime(1, t);
        this.musicGain.gain.cancelScheduledValues(t); this.musicGain.gain.setValueAtTime(0, t);
        if (music) this._loop('music', this.musicLP, 1);
        this._loop('amb', this.bed, 0);
        this._loop('rumble', this.bed, 0);
        this._loop('saw', this.sfx, 0);
        const src = c.createBufferSource(); src.buffer = this._noise; src.loop = true;
        const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.9;
        const g = c.createGain(); g.gain.value = 0;
        src.connect(bp); bp.connect(g); g.connect(this.sfx); src.start();
        this.loops.wind = { src, gain: g, filter: bp };
        this.started = true;
    }
    _loop(name, dest, gain, offset = 0) {
        const buf = this.buffers['loop:' + name];
        const c = this.ctx;
        if (!buf) {
            const gen = this._gen, t0 = c.currentTime;
            this.ready.then(() => {
                if (this._gen !== gen || !this.started || !this.buffers['loop:' + name]) return;
                this._loop(name, dest, gain, c.currentTime - t0);
            });
            return;
        }
        const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
        const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 20000;
        const g = c.createGain(); g.gain.value = gain;
        src.connect(lp); lp.connect(g); g.connect(dest);
        src.start(0, offset > 0 ? offset % buf.duration : 0);
        this.loops[name] = { src, gain: g, filter: lp };
    }
    stopAll(fade = 0.6) {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        for (const L of Object.values(this.loops)) {
            L.gain.gain.cancelScheduledValues(t);
            L.gain.gain.setTargetAtTime(0, t, fade / 4);
            try { L.src.stop(t + fade + 0.1); } catch {   }
        }
        this.musicGain.gain.cancelScheduledValues(t);
        this.musicGain.gain.setTargetAtTime(0, t, fade / 4);
        this.loops = {};
        this.started = false;
    }

    mood(dbLevel, lp = 20000, s = 0.6) { this._mood = { db: dbLevel, lp, s }; }
    excite(k) { this.excitement = clamp(this.excitement + k, 0, 1); }
    duck(dbAmt = -9, hold = 0.08, release = 0.6) {
        if (!this.ctx) return;
        const g = this.musicDuck.gain, t = this.ctx.currentTime;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(db(dbAmt), t + 0.02);
        g.setValueAtTime(db(dbAmt), t + 0.02 + hold);
        g.linearRampToValueAtTime(1, t + 0.02 + hold + release);
    }

    play(name, o = {}) {
        if (!this.running || !this.started) return null;
        const list = this.buffers[name];
        if (!list || !list.length) return null;
        const t = this.ctx.currentTime;
        const cool = o.cool ?? 0.03;
        if (this._last[name] !== undefined && t - this._last[name] < cool) return null;
        if (this._voices >= MAX_VOICES && !HEAVY.has(name)) return null;
        this._last[name] = t;
        if (HEAVY.has(name)) this._lastHeavy = t;
        let i = (Math.random() * list.length) | 0;
        if (list.length > 1 && i === this._lastIdx[name]) i = (i + 1) % list.length;
        this._lastIdx[name] = i;
        const c = this.ctx;
        const src = c.createBufferSource();
        src.buffer = list[i];
        const jit = o.jitter ?? 0.05;
        const slow = o.noSlow ? 1 : (0.72 + 0.28 * this._slow);
        src.playbackRate.value = Math.max(0.2, (o.rate ?? 1) * (1 + (Math.random() * 2 - 1) * jit) * slow);
        const g = c.createGain();
        g.gain.value = (o.vol ?? 1) * (1 + (Math.random() * 2 - 1) * 0.08);
        let node = src;
        node.connect(g); node = g;
        if (o.pan && c.createStereoPanner) {
            const p = c.createStereoPanner(); p.pan.value = clamp(o.pan, -0.85, 0.85);
            node.connect(p); node = p;
        }
        node.connect(o.bus === 'bed' ? this.bed : this.sfx);
        this._voices++;
        src.onended = () => { this._voices--; };
        src.start(t + (o.delay ?? 0));
        return src;
    }
    panX(sx, W, bias = 0) { return clamp((sx / Math.max(1, W)) * 1.6 - 0.8 + bias, -0.85, 0.85); }

    shake(amount) {
        if (!this.running || !this.started) return;
        const t = this.ctx.currentTime;
        if (amount < 16 || t - this._lastHeavy < 0.15) return;
        if (this._last.shakeHit !== undefined && t - this._last.shakeHit < 0.12) return;
        this._last.shakeHit = t;
        if (amount >= 32) this.play('impact', { vol: 0.75, cool: 0.1 });
        else this.play('thud', { vol: clamp(amount / 30, 0.35, 0.9), cool: 0.08 });
        this.excite(amount / 90);
    }
    punch(amount) {
        const a = Math.abs(amount);
        if (a < 0.04) return;
        this.play('whoosh', { vol: clamp(a * 4.5, 0.2, 0.55), rate: amount < 0 ? 0.8 : 1.15, cool: 0.18 });
    }
    slowmo(scale, secs) {
        if (scale > 0.42 || secs < 0.2) return;
        this.play('slowmo', { vol: 0.5, cool: 0.7, noSlow: true });
    }

    tick(dt, s = {}) {
        if (!this.ctx || !this.started) return;
        const c = this.ctx, t = c.currentTime;
        const L = this.loops;
        const slowT = clamp(s.slow ?? 1, 0.05, 1);
        this._slow += (slowT - this._slow) * Math.min(1, dt * 8);
        const sl = this._slow;

        this.excitement = Math.max(0, this.excitement - dt * 0.55);
        const e = this.excitement, m = this._mood;
        const level = m.db + 3.5 * e - (1 - sl) * 7;
        const lp = clamp(m.lp * (1 + 1.5 * e) * (0.12 + 0.88 * sl * sl), 200, 20000);
        const tc = Math.max(0.03, (m.s ?? 0.6) / 3);
        this.musicGain.gain.setTargetAtTime(db(level), t, tc);
        this.musicLP.frequency.setTargetAtTime(lp, t, tc);
        this.sfxLP.frequency.setTargetAtTime(clamp(20000 * (0.18 + 0.82 * sl), 900, 20000), t, 0.05);

        if (L.amb) L.amb.gain.gain.setTargetAtTime(db(-14) * (s.amb ?? 0.7), t, 0.4);
        if (L.rumble) {
            const sh = clamp((s.shake ?? 0) / 30, 0, 1);
            L.rumble.gain.gain.setTargetAtTime(Math.min(1.2, sh * 1.1 + (s.rumble ?? 0)), t, 0.06);
            L.rumble.src.playbackRate.setTargetAtTime(0.8 + 0.4 * sh, t, 0.1);
        }

        if (L.saw) {
            const sw = s.saw;
            const on = sw && sw.visible;
            const spin = on ? clamp(sw.spin ?? 0, 0, 1) : 0;
            const big = Math.max(1, sw?.scale ?? 1);
            L.saw.gain.gain.setTargetAtTime(on ? (0.05 + 0.32 * spin) * Math.min(1.6, Math.sqrt(big)) : 0, t, 0.08);
            L.saw.src.playbackRate.setTargetAtTime((0.7 + 0.55 * spin) / Math.pow(big, 0.35) * (0.75 + 0.25 * sl), t, 0.08);
            L.saw.filter.frequency.setTargetAtTime(900 + 6000 * spin, t, 0.08);
        }

        if (L.wind) {
            let v = 0;
            const cam = s.cam;
            if (cam && this._prevCam && dt > 0) {
                const p = this._prevCam;
                const W = s.W || 1280;
                const dpan = Math.hypot(cam.x - p.x, cam.y - p.y) * cam.zoom / W;
                const dz = Math.abs(Math.log(Math.max(1e-4, cam.zoom) / Math.max(1e-4, p.zoom)));
                const dr = Math.abs((cam.rot || 0) - (p.rot || 0));
                v = (dpan * 1.3 + dz * 1.6 + dr * 2.2) / dt;
                if (v > 40) v = 0;
            }
            this._prevCam = cam ? { ...cam } : null;
            const k = clamp((v - 0.12) / 1.6, 0, 1);
            this._wind = (this._wind ?? 0) + (k - (this._wind ?? 0)) * Math.min(1, dt * 10);
            const w = this._wind;
            L.wind.gain.gain.setTargetAtTime(w * 0.32, t, 0.05);
            L.wind.filter.frequency.setTargetAtTime(350 + 2600 * w, t, 0.05);
        }

        if (s.players && s.ws) {
            for (const p of s.players) {
                if (!p) continue;
                let st = this._steps.get(p);
                if (!st) { st = { x: p.x, y: p.y, acc: 0 }; this._steps.set(p, st); }
                const d = Math.hypot(p.x - st.x, p.y - st.y);
                st.x = p.x; st.y = p.y;
                if (d > 60 || p.airborne || (p.hopZ ?? 0) > 2) continue;
                st.acc += d;
                if (st.acc > 58) {
                    st.acc = 0;
                    const sc = s.ws(p.x, p.y);
                    const near = clamp((cam0(s) ?? 1) / 1.2, 0.4, 1.3);
                    this.play('footstep', { vol: 0.22 * near, rate: 1.05, pan: this.panX(sc.x, s.W), cool: 0.06, jitter: 0.12 });
                }
            }
        }
    }
}

const cam0 = (s) => s.cam?.zoom;

export function hookRendererAudio(renderer, getAudio) {
    if (!renderer || renderer._audioHooked) return;
    renderer._audioHooked = true;
    const shake = renderer.triggerShake.bind(renderer);
    renderer.triggerShake = (amount = 14) => {
        const before = renderer.screenShake;
        shake(amount);
        if (amount > before * 1.25) getAudio()?.shake(amount);
    };
    const punch = renderer.triggerZoomPunch.bind(renderer);
    renderer.triggerZoomPunch = (amount = 0.08) => { punch(amount); getAudio()?.punch(amount); };
}
