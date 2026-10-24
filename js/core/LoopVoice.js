export class LoopVoice {

    constructor({ ctx, output, buffer, path, volume, masterGain = () => 1 }) {
        this.ctx = ctx;
        this.volume = volume;
        this._masterGain = masterGain;
        this._stopped = false;
        this._level = 0;
        this._rate = 1;
        this._source = null;
        this._html = null;

        if (!ctx) {
            this._initHtml(path);
            return;
        }
        this.filter = ctx.createBiquadFilter();
        this.filter.type = "lowpass";
        this.filter.frequency.value = 18000;
        this.filter.Q.value = 0.5;
        this.pulseGain = ctx.createGain();
        this.levelGain = ctx.createGain();
        this.levelGain.gain.value = 0;
        this.filter.connect(this.pulseGain);
        this.pulseGain.connect(this.levelGain);
        this.levelGain.connect(output);

        Promise.resolve(buffer).then(buf => {
            if (this._stopped) return;
            if (!buf) return this._initHtml(path);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.loop = true;

            src.playbackRate.value = this._rate;
            src.connect(this.filter);
            src.start(0, Math.random() * buf.duration);
            this._source = src;
        });
    }

    _initHtml(path) {
        if (typeof Audio === "undefined" || !path) return;
        const a = new Audio(path);
        a.loop = true;
        a.preservesPitch = false;
        a.volume = 0;
        a.play().catch(() => {});
        this._html = a;
    }

    get started() {
        return !!(this._source || this._html);
    }

    set({ level, rate, cutoff }, tau = 0.05) {
        if (this._stopped) return;
        const t = this.ctx?.currentTime ?? 0;
        if (level !== undefined && Math.abs(level - this._level) > 0.002) {
            this._level = level;
            if (this.levelGain) this.levelGain.gain.setTargetAtTime(level * this.volume, t, tau);
        }
        if (rate !== undefined && Math.abs(rate - this._rate) > 0.002) {
            this._rate = rate;
            this._source?.playbackRate.setTargetAtTime(rate, t, tau);
        }
        if (cutoff !== undefined && this.filter) {
            this.filter.frequency.setTargetAtTime(cutoff, t, tau);
        }
        if (this._html) {
            this._html.volume = Math.max(0, Math.min(1, this._level * this.volume * this._masterGain()));
            this._html.playbackRate = Math.max(0.25, Math.min(4, this._rate));
        }
    }

    pulse({ cents = -200, gainDb = 3, hz = 9, decay = 0.09, duration = 0.35 } = {}) {
        if (this._stopped || !this.ctx || !this._source) return;
        const t = this.ctx.currentTime;
        const n = 64;
        const detune = this._source.detune;
        const g = this.pulseGain.gain;
        const dCurve = new Float32Array(n);
        const gCurve = new Float32Array(n);
        const d0 = detune?.value ?? 0;
        const g0 = g.value;
        for (let i = 0; i < n; i++) {
            const s = (i / (n - 1)) * duration;
            const env = Math.exp(-s / decay);

            const osc = i === n - 1 ? 0 : env * Math.cos(2 * Math.PI * hz * s);

            const carry = Math.exp(-s / 0.03);
            dCurve[i] = cents * osc + d0 * carry * (i === n - 1 ? 0 : 1);
            const lin = Math.pow(10, (gainDb * Math.max(0, osc)) / 20);
            gCurve[i] = i === n - 1 ? 1 : lin + (g0 - 1) * carry;
        }

        try {
            if (detune) {
                detune.cancelScheduledValues(t);
                detune.setValueCurveAtTime(dCurve, t, duration);
            }
            g.cancelScheduledValues(t);
            g.setValueCurveAtTime(gCurve, t, duration);
        } catch (_) {}
    }

    stop(fadeMs = 400) {
        if (this._stopped) return;
        this._stopped = true;
        if (this._html) {
            try { this._html.pause(); } catch (_) {}
            return;
        }
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        const g = this.levelGain.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.setTargetAtTime(0, t, fadeMs / 3000);
        try { this._source?.stop(t + fadeMs / 1000 + 0.05); } catch (_) {}
    }
}
