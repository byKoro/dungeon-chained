import { CHAIN_TENSION as C } from '../config/ChainTensionConfig.js';

const clamp = v => Math.max(0, Math.min(1, v));
const smooth = (value, target, dt, tau) => target + (value - target) * Math.exp(-dt / tau);

export function tensionTargets(chain, p1, p2, { active = true, protected: protectedState = false } = {}) {
    if (!active || !chain.hasSaw || !chain.isConnected || !p1 || !p2
        || p1.falling || p2.falling || p1.lives <= 0 || p2.lives <= 0) return { effort: 0, risk: 0 };
    const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const start = chain.rest + (chain.strainDistance - chain.rest) * C.anticipation;
    const stretch = clamp((distance - start) / Math.max(1, chain.breakDistance - start));
    const distanceRisk = clamp((distance - chain.strainDistance) / Math.max(1, chain.breakDistance - chain.strainDistance));
    const accumulates = (chain.weapon.split ?? 0) === 0 && distance > chain.strainDistance;
    const timeRisk = accumulates ? clamp(chain.strain / Math.max(1, chain.strainLimit)) : 0;
    const risk = protectedState ? 0 : Math.max(distanceRisk, timeRisk);
    return { effort: Math.max(stretch, protectedState ? 0 : timeRisk), risk };
}

export function tensionAudioTargets({ effort = 0, risk = 0 }, active = true) {
    const a = C.audio;
    const db = a.minDb + (a.maxDb - a.minDb) * clamp(effort) + a.criticalDb * clamp(risk);
    return {
        level: active && effort > a.silence ? Math.pow(10, db / 20) : 0,
        rate: a.rateMin + (a.rateMax - a.rateMin) * clamp(effort),
        cutoff: a.cutoffMin * Math.pow(a.cutoffMax / a.cutoffMin, clamp(Math.max(effort, risk)))
    };
}

export function tensionGlowTargets({ effort = 0, risk = 0, pulse = 0 }, reducedMotion = false) {
    const g = C.glow;
    const heat = clamp(Math.max(effort * 0.55, risk));
    const from = heat < 0.5 ? g.low : g.medium;
    const to = heat < 0.5 ? g.medium : g.high;
    const blend = heat < 0.5 ? heat * 2 : (heat - 0.5) * 2;
    const color = from.map((channel, i) => Math.round(channel + (to[i] - channel) * blend));
    const breathing = 1 - g.pulseDepth * risk * (reducedMotion ? C.motion.reduced : 1)
        * (0.5 + 0.5 * Math.sin(pulse * Math.PI * 2));
    return { color: `rgb(${color.join(',')})`, strength: Math.sqrt(clamp(effort)) * breathing };
}

export class ChainTensionFeedback {
    constructor({ audio, reducedMotion = false } = {}) {
        this.audio = audio;
        this.motionScale = reducedMotion ? C.motion.reduced : 1;
        this.voice = null;
        this.state = { effort: 0, risk: 0, phase: 0, pulse: 0, settle: 0, expression: null, motionScale: this.motionScale };
        this.snapTime = 0;
        this.lastTargetEffort = 0;
        this.lastTime = null;
    }

    reset(players = []) {
        this.voice?.stop(0);
        this.voice = null;
        Object.assign(this.state, { effort: 0, risk: 0, phase: 0, pulse: 0, settle: 0, expression: null });
        this.snapTime = 0;
        this.lastTargetEffort = 0;
        this.lastTime = null;
        for (const p of players) if (p) p.tensionExpression = null;
    }

    onSnap() {
        this.snapTime = C.snapSeconds;
        this.voice?.set({ level: 0 }, C.inactiveTau);
    }

    update(chain, players, options = {}, now = globalThis.performance?.now?.() ?? Date.now()) {
        const dt = this.lastTime === null ? 0 : Math.max(0, Math.min(C.maxFrameSeconds, (now - this.lastTime) / 1000));
        this.lastTime = now;
        const [p1, p2] = players;
        const active = options.active !== false;
        const target = tensionTargets(chain, p1, p2, options);
        const s = this.state;
        const oldEffort = s.effort;
        if (!active) {
            s.effort = s.risk = s.settle = 0;
            this.snapTime = 0;
        } else {
            s.effort = smooth(s.effort, target.effort, dt, target.effort > s.effort ? C.attackTau : C.releaseTau);
            s.risk = options.protected ? 0 : smooth(s.risk, target.risk, dt, target.risk > s.risk ? C.attackTau : C.releaseTau);
            if (target.effort === 0 && this.lastTargetEffort > 0 && oldEffort >= C.effortExit && chain.isConnected) s.settle = C.settleSeconds;
            s.settle = Math.max(0, s.settle - dt);
            this.snapTime = Math.max(0, this.snapTime - dt);
            s.phase += dt * Math.PI * 2 * (C.motion.hzMin + (C.motion.hzMax - C.motion.hzMin) * s.effort);
            s.pulse += dt * (C.motion.pulseHzMin + (C.motion.pulseHzMax - C.motion.pulseHzMin) * s.risk);
        }
        this.lastTargetEffort = target.effort;
        const critical = s.expression === C.expressions.critical ? C.criticalExit : C.criticalEnter;
        const effort = s.expression ? C.effortExit : C.effortEnter;
        s.expression = s.risk >= critical ? C.expressions.critical : s.effort >= effort ? C.expressions.effort : null;
        if (!chain.isConnected || !active) s.expression = null;
        for (const p of players) if (p) p.tensionExpression = p.falling || p.lives <= 0 ? null : s.expression;
        chain.weapon.tensionFeedback = s;
        const sound = tensionAudioTargets(s, active && chain.isConnected);
        if (sound.level > 0 && !this.voice) this.voice = this.audio?.createLoopVoice('chainTension') ?? null;
        this.voice?.set(sound, active && chain.isConnected ? C.attackTau : C.inactiveTau);
    }

    _drawGlow(ctx, p1, p2, weapon) {
        if (!weapon) return;
        const g = C.glow;
        const { color, strength } = tensionGlowTargets(this.state, this.motionScale < 1);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = color;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();
        const saws = weapon.getSawPositions(p1, p2);
        let drawing = false;
        for (let i = 0; i <= g.samples; i++) {
            const t = g.inset + i / g.samples * (1 - g.inset * 2);
            const p = weapon.visualCablePoint(p1, p2, t);
            if (saws.some(saw => Math.hypot(p.x - saw.x, p.y - saw.y) < weapon.discRadius)) {
                drawing = false;
                continue;
            }
            const x = Math.round(p.x / C.motion.pixel) * C.motion.pixel;
            const y = Math.round(p.y / C.motion.pixel) * C.motion.pixel;
            if (!drawing) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            drawing = true;
        }
        for (const [width, alpha] of [[g.haloWidth, g.haloAlpha], [g.bodyWidth, g.bodyAlpha], [g.coreWidth, g.coreAlpha]]) {
            ctx.lineWidth = width;
            ctx.globalAlpha = strength * alpha;
            ctx.stroke();
        }
        ctx.restore();
    }

    draw(ctx, p1, p2, connected, weapon) {
        const s = this.state, m = C.motion;
        if ((!connected || s.effort < C.effortExit) && this.snapTime <= 0) return;
        if (connected) this._drawGlow(ctx, p1, p2, weapon);
        const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
        const nx = (p2.x - p1.x) / distance, ny = (p2.y - p1.y) / distance;
        const progress = s.pulse % 1;
        const snap = this.snapTime > 0 ? 1 - this.snapTime / C.snapSeconds : null;
        const radius = m.pulseRadius + (snap === null ? progress * m.pulseTravel : snap * m.snapTravel) * this.motionScale;
        const alpha = snap === null ? (1 - progress) * s.effort : (1 - snap);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.risk >= C.criticalExit || snap !== null ? m.light : m.dark;
        for (const [p, dir] of [[p1, 1], [p2, -1]]) {
            if (p.falling) continue;
            const x = p.x + nx * dir * m.anchorInset;
            const y = p.y + ny * dir * m.anchorInset;
            if (snap !== null) {
                ctx.strokeStyle = m.light;
                ctx.lineWidth = m.pixel;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + nx * dir * m.snapTravel * (1 - snap), y + ny * dir * m.snapTravel * (1 - snap));
                ctx.stroke();
            }
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const px = Math.round((x + dx * radius) / m.pixel) * m.pixel;
                const py = Math.round((y + dy * radius) / m.pixel) * m.pixel;
                ctx.fillRect(px, py, m.pixel * 2, m.pixel);
            }
        }
        ctx.restore();
    }
}
