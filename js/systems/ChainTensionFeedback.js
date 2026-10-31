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

export class ChainTensionFeedback {
    constructor({ audio, reducedMotion = false } = {}) {
        this.audio = audio;
        this.motionScale = reducedMotion ? C.motion.reduced : 1;
        this.voice = null;
        this.state = { effort: 0, risk: 0, phase: 0, pulse: 0, settle: 0, expression: null, motionScale: this.motionScale };
        this.snapTime = 0;
        this.snapPoint = null;
        this.lastTargetEffort = 0;
        this.lastTime = null;
    }

    reset(players = []) {
        this.voice?.stop(0);
        this.voice = null;
        Object.assign(this.state, { effort: 0, risk: 0, phase: 0, pulse: 0, settle: 0, expression: null });
        this.snapTime = 0;
        this.snapPoint = null;
        this.lastTargetEffort = 0;
        this.lastTime = null;
        for (const p of players) if (p) p.tensionExpression = null;
    }

    onSnap(point = null) {
        this.snapTime = C.snapSeconds;
        this.snapPoint = point;
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
        }
        this.lastTargetEffort = target.effort;
        // Sem cara de raiva/fúria: a tensão é mostrada só pela corda (afina + pisca), não pelo rosto.
        s.expression = null;
        for (const p of players) if (p) p.tensionExpression = null;
        chain.weapon.tensionFeedback = s;
        const sound = tensionAudioTargets(s, active && chain.isConnected);
        if (sound.level > 0 && !this.voice) this.voice = this.audio?.createLoopVoice('chainTension') ?? null;
        this.voice?.set(sound, active && chain.isConnected ? C.attackTau : C.inactiveTau);
    }

    // Só o estalo da ruptura desenha aqui. O aviso de tensão (afinar + piscar) mora na própria
    // corda em SawWeapon.drawChain — sem glow vermelho nem anéis sobre o canvas.
    draw(ctx, p1, p2, connected, weapon) {
        if (this.snapTime > 0) this._drawSnap(ctx, p1, p2);
    }

    // Estalo: corte seco. As duas metades do cabo recuam RETAS e RÁPIDO pra cada jogador e somem
    // num piscar (sem overshoot, sem onda, sem acomodação). `k` 0→1 é o progresso do estalo.
    _drawSnap(ctx, p1, p2) {
        const cfg = C.snap;
        const k = 1 - this.snapTime / C.snapSeconds;
        const mid = this.snapPoint ?? { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        // Tudo acontece na janela inicial `cutWindow`: a ponta some por completo e o resto é vazio.
        const w = Math.min(1, k / (cfg.cutWindow ?? 0.4));
        if (w >= 1) return; // corte terminou: nada desenhado (abrupto, sem rastro)

        // Recuo linear e veloz (ease-out forte, sem back): a ponta livre volta rápido pro jogador.
        const retract = 1 - Math.pow(1 - w, 3);

        ctx.save();
        ctx.lineCap = 'butt'; // ponta reta, não arredondada — leitura de corte
        ctx.strokeStyle = cfg.color;
        ctx.globalAlpha = 1; // sem fade suave: a corda é opaca até sumir de uma vez

        for (const p of [p1, p2]) {
            if (p.falling) continue;
            const ax = p.x, ay = p.y;
            let dx = mid.x - ax, dy = mid.y - ay;
            const len = Math.hypot(dx, dy) || 1;
            dx /= len; dy /= len;
            // Da âncora até a ponta que recua: comprimento encolhe reto até zero.
            const tip = len * (1 - retract);
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(ax + dx * tip, ay + dy * tip);
            ctx.lineWidth = cfg.thickness;
            ctx.stroke();
        }
        ctx.restore();
    }
}
