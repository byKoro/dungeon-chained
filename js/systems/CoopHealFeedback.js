import { COOP_HEAL_FEEL } from '../config/CoopHealFeelConfig.js';

const rand = (a, b) => a + Math.random() * (b - a);
const snap = (v, px) => Math.round(v / px) * px;

// Pixels de arte de uma elipse (offsets do centro, já na grade), ordenados no sentido horário a partir do topo.
// `t` (0..1) é a fração da volta onde cada pixel aparece pela primeira vez.
export function ellipsePixels(rx, ry, px) {
    const steps = Math.max(16, Math.ceil((2 * Math.PI * Math.max(rx, ry) / px) * 3));
    const seen = new Set(), out = [];
    for (let i = 0; i < steps; i++) {
        const t = i / steps, a = -Math.PI / 2 + t * Math.PI * 2;
        const x = snap(Math.cos(a) * rx, px), y = snap(Math.sin(a) * ry, px);
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ x, y, t });
    }
    return out;
}

// Juice do Vínculo: anel de progresso no chão sob cada jogador, partículas verdes subindo, luz que cresce,
// e no momento da cura um anel expandindo + "+1". Lê só o estado e as flags de um step do CoopHeal.
export class CoopHealFeedback {
    constructor({ coopHeal, getPlayers, particleSystem = null, reducedMotion = false, cfg = COOP_HEAL_FEEL }) {
        Object.assign(this, { coopHeal, getPlayers, particleSystem, cfg });
        this.motion = reducedMotion ? cfg.reducedMotion : 1;
        this._rings = new Map();
        this.reset();
    }

    reset() {
        this.alpha = 0;
        this.shown = 0;
        this.steps = 0;
        this.motes = [];
        this.shards = [];
        this.bursts = [];
        this.pulse = [0, 0];
        this._spawn = [0, 0];
        this._brokeHold = 0;
    }

    get active() {
        return this.motes.length > 0 || this.shards.length > 0 || this.bursts.length > 0;
    }

    _ring(rx, ry) {
        const key = `${rx}|${ry}`;
        let ring = this._rings.get(key);
        if (!ring) this._rings.set(key, ring = ellipsePixels(rx, ry, this.cfg.pixel));
        return ring;
    }

    _feet(p) {
        return { x: snap(p.x, this.cfg.pixel), y: snap(p.y + this.cfg.footOffsetY, this.cfg.pixel) };
    }

    _addMote(p, rise = 1) {
        const c = this.cfg, m = c.motes;
        if (this.motes.length >= m.max) this.motes.shift();
        const side = Math.random() < 0.5 ? -1 : 1, a = rand(-m.sideArc, m.sideArc), r = rand(m.bandMin, m.bandMax);
        const f = this._feet(p);
        this.motes.push({
            x: f.x + side * Math.cos(a) * c.ring.rx * r, y: f.y + Math.sin(a) * c.ring.ry * r,
            vy: -rand(m.riseMin, m.riseMax) * rise * this.motion,
            phase: Math.random() * Math.PI * 2, age: 0, life: Math.round(rand(m.lifeMin, m.lifeMax)),
            color: c.colors.mote[Math.floor(Math.random() * c.colors.mote.length)],
            cross: Math.random() < m.crossChance
        });
    }

    _shatter(p) {
        const c = this.cfg, ring = this._ring(c.ring.rx, c.ring.ry), f = this._feet(p);
        const n = Math.min(c.shards.count, ring.length);
        for (let i = 0; i < n; i++) {
            const o = ring[Math.floor(i * ring.length / n)];
            const len = Math.hypot(o.x, o.y) || 1;
            const s = c.shards.speed * rand(0.6, 1.2) * this.motion;
            this.shards.push({ x: f.x + o.x, y: f.y + o.y, vx: o.x / len * s, vy: o.y / len * s, age: 0 });
        }
    }

    update() {
        const c = this.cfg, players = this.getPlayers?.() || [];
        const h = this.coopHeal;
        this.steps++;

        const needy = players.some(p => p && p.lives < (p.maxLives ?? p.lives));
        if (this._brokeHold > 0) this._brokeHold--;
        const charging = !!h?.charging && needy && this._brokeHold === 0;
        if (charging) {
            this.shown = h.progress;
            this.alpha = Math.min(1, this.alpha + 1 / c.fadeInSteps);
        } else {
            this.alpha = Math.max(0, this.alpha - 1 / c.fadeOutSteps);
        }

        if (h?.broke === 'hurt' && this.alpha > 0) {
            for (const p of players) if (p && !p.falling) this._shatter(p);
            this.alpha = 0;
            this._brokeHold = c.shards.holdSteps;
        }

        if (h?.healed?.length) {
            this.alpha = 0;
            this.shown = 0;
            for (const p of h.healed) {
                const i = players.indexOf(p);
                if (i >= 0) this.pulse[i] = 1;
                this.bursts.push({ p, age: 0 });
                for (let k = 0; k < c.heal.motes; k++) this._addMote(p, c.heal.moteRiseBoost);
                this.particleSystem?.triggerDamageNumber?.(p.x, p.y + c.heal.numberOffsetY, 1,
                    { text: "+1", color: c.heal.numberColor });
            }
        }

        if (charging) {
            const rate = c.motes.rateBase + c.motes.rateGrow * this.shown;
            players.forEach((p, i) => {
                if (!p || p.falling) return;
                this._spawn[i] += rate;
                while (this._spawn[i] >= 1) { this._spawn[i]--; this._addMote(p); }
            });
        }

        const w = c.motes.wobble * this.motion, wHz = c.motes.wobbleHz * Math.PI * 2 / 60;
        for (const m of this.motes) {
            m.age++;
            m.y += m.vy;
            m.x += Math.sin(m.phase + m.age * wHz) * w;
        }
        this.motes = this.motes.filter(m => m.age < m.life);

        for (const s of this.shards) {
            s.age++;
            s.x += s.vx; s.y += s.vy;
            s.vx *= c.shards.drag; s.vy *= c.shards.drag;
        }
        this.shards = this.shards.filter(s => s.age < c.shards.life);

        for (const b of this.bursts) b.age++;
        this.bursts = this.bursts.filter(b => b.age < c.heal.ringSteps);

        for (let i = 0; i < 2; i++) this.pulse[i] = Math.max(0, this.pulse[i] - 1 / c.heal.pulseSteps);
    }

    _drawPixels(ctx, cx, cy, pixels, color, alpha) {
        const px = this.cfg.pixel;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        for (const o of pixels) ctx.fillRect(cx + o.x, cy + o.y, px, px);
    }

    // Passe do mundo (antes das entidades, junto das sombras): anel de progresso no chão.
    drawFloor(ctx) {
        const c = this.cfg, r = c.ring, px = c.pixel;
        if (this.alpha <= 0) return;
        const players = this.getPlayers?.() || [];
        ctx.save();

        if (this.alpha > 0) {
            const ring = this._ring(r.rx, r.ry);
            let pulse = 1;
            if (this.shown > r.pulseFrom && this.motion === 1) {
                const k = (this.shown - r.pulseFrom) / (1 - r.pulseFrom);
                const hz = r.pulseHzMin + (r.pulseHzMax - r.pulseHzMin) * k;
                pulse = 1 - r.pulseDepth * k * (0.5 + 0.5 * Math.sin(this.steps / 60 * hz * Math.PI * 2));
            }
            const filled = [], empty = [];
            for (const o of ring) (o.t <= this.shown ? filled : empty).push(o);
            const head = filled.length ? [filled[filled.length - 1]] : [];
            for (const p of players) {
                if (!p || p.falling) continue;
                const f = this._feet(p);
                this._drawPixels(ctx, f.x, f.y, empty, c.colors.dim, this.alpha * r.dimAlpha);
                this._drawPixels(ctx, f.x, f.y, filled, c.colors.fill, this.alpha * r.fillAlpha * pulse);
                this._drawPixels(ctx, f.x, f.y, head, c.colors.head, this.alpha);
            }
        }

        ctx.restore();
    }

    // Passe sem luz (beginOverlayWorld): anéis da cura (saem do alcance da luz, então não podem ser multiplicados
    // pela escuridão), partículas subindo e cacos do anel quebrado.
    drawOverlay(ctx) {
        if (!this.active) return;
        const c = this.cfg, r = c.ring, px = c.pixel, m = c.motes;
        ctx.save();
        for (const b of this.bursts) {
            if (b.p.falling) continue;
            const t = b.age / c.heal.ringSteps, eased = 1 - (1 - t) ** 3;
            const scale = c.heal.ringFrom + (c.heal.ringTo - c.heal.ringFrom) * eased * (0.5 + 0.5 * this.motion);
            const rx = Math.max(px, snap(r.rx * scale, px)), ry = Math.max(px, snap(r.ry * scale, px));
            const f = this._feet(b.p);
            this._drawPixels(ctx, f.x, f.y, this._ring(rx, ry), c.colors.fill, (1 - t) ** 1.5);
        }
        for (const p of this.motes) {
            const t = p.age / p.life;
            const alpha = Math.min(1, p.age / 4) * (t < m.fadeFrom ? 1 : 1 - (t - m.fadeFrom) / (1 - m.fadeFrom));
            const x = snap(p.x, px), y = snap(p.y, px);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            if (p.cross) {
                ctx.fillRect(x - px, y, px * 3, px);
                ctx.fillRect(x, y - px, px, px * 3);
            } else {
                ctx.fillRect(x, y, px, px);
            }
        }
        ctx.fillStyle = c.colors.shard;
        for (const s of this.shards) {
            ctx.globalAlpha = 1 - s.age / c.shards.life;
            ctx.fillRect(snap(s.x, px), snap(s.y, px), px, px);
        }
        ctx.restore();
    }

    renderLights(renderer, postProcessor) {
        const L = this.cfg.light, players = this.getPlayers?.() || [];
        players.forEach((p, i) => {
            if (!p || p.falling) return;
            const pulse = this.pulse[i] ** 2;
            const strength = this.alpha * (L.strengthMin + (L.strengthMax - L.strengthMin) * this.shown) + pulse * L.healStrength;
            if (strength <= 0.01) return;
            const radius = L.radius + L.radiusGrow * this.shown * this.alpha + L.healRadius * pulse;
            const f = this._feet(p), s = renderer.worldToScreen(f.x, f.y);
            postProcessor.addLight(s.x, s.y, radius * s.zoom, Math.max(2, Math.round(this.cfg.pixel * s.zoom)), L.flatten, {
                color: L.color, flickerBase: 1, flickerSine: 0, flickerNoise: 0,
                falloff: L.falloff.map(o => ({ offset: o.offset, alpha: o.alpha * Math.min(1, strength) }))
            });
        });
    }
}
