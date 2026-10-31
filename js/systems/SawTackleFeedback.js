import { SAW_TACKLE_FEEL as C } from '../config/SawTackleFeelConfig.js';

const clamp = v => Math.max(0, Math.min(1, v));
const gain = db => Math.pow(10, db / 20);

export function tackleHeatColor(color, heat) {
    const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const from = rgb(C.thermal.idle);
    const to = color.startsWith('#') ? rgb(color) : color.split(',').map(Number);
    return from.map((channel, i) => Math.round(channel + (to[i] - channel) * clamp(heat))).join(', ');
}

export function tackleAudioTargets({ state, speed = 0, stone = false, active = true, timeScale = 1 } = {}) {
    const a = C.audio;
    const moving = active && (state === 'flight' || state === 'landing') && speed > a.minimumFlightSpeed;
    const cut = active && state === 'stuck';
    const motion = clamp(speed / C.referenceSpeed);
    const slow = 1 - a.slowmoDepth * (1 - clamp(timeScale));
    return {
        flight: { level: moving ? gain(a.flightMinDb + (a.flightMaxDb - a.flightMinDb) * motion) : 0,
            rate: (a.flightRate + a.flightRateDepth * motion) * slow, cutoff: a.flightCutoff },
        cut: { level: cut ? gain(stone ? a.stoneDb : a.cutDb) : 0,
            rate: (stone ? a.stoneRate : a.cutRate) * slow, cutoff: stone ? a.stoneCutoff : a.cutCutoff }
    };
}

export class SawTackleFeedback {
    constructor({ audio, renderer, particleSystem, reducedMotion = false } = {}) {
        Object.assign(this, { audio, renderer, particleSystem });
        this.motion = reducedMotion ? C.reducedMotion : 1;
        this.bursts = [];
        this.flightVoice = this.cutVoice = null;
        this.visual = { phase: 0, jitter: 0, scale: 1, heat: 0 };
        this.kick = this.hitTime = this.cutAccum = 0;
        this.lastTime = null;
        this.enabled = false;
        this.glows = new Map();
    }

    reset() {
        this.flightVoice?.stop(0);
        this.cutVoice?.stop(0);
        this.flightVoice = this.cutVoice = null;
        this.bursts.length = 0;
        this.kick = this.hitTime = this.cutAccum = 0;
        Object.assign(this.visual, { phase: 0, jitter: 0, scale: 1, lit: false, heat: 0 });
        this.lastTime = null;
        this.enabled = false;
    }

    _burst(kind, w, dir = { x: 1, y: 0 }, stone = false) {
        this.bursts.push({ kind, x: w.dropX, y: w.dropY, dx: dir.x, dy: dir.y, stone, age: 0 });
        if (this.bursts.length > C.maxBursts) this.bursts.shift();
    }

    impact(w, dir) {
        this._burst('impact', w, dir);
        this.kick = C.blade.kickSeconds;
        this.particleSystem?.triggerDust?.(w.dropX, w.dropY, -dir.x, -dir.y, C.impact.dust);
        const { db, ...envelope } = C.audio.launchDuck;
        this.audio?.duck(db, envelope);
    }

    launch(w, dir) {
        this._burst('launch', w, dir);
        this.kick = C.blade.kickSeconds;
        this.audio?.play('sawTackleLaunch');
    }

    contact(w, enemy, dir) {
        this._burst('bite', w, dir, enemy.effectMaterial === 'lavaStone');
        this.renderer?.triggerShake(C.bite.shake * this.motion);
        this.audio?.play('sawTackleBite');
    }

    hit(w, enemy, result, dir) {
        const stone = enemy.effectMaterial === 'lavaStone';
        this._burst('hit', w, dir, stone);
        this.hitTime = C.blade.hitSeconds;
        this.renderer?.triggerShake((result?.killed ? C.hit.killShake : C.hit.shake) * this.motion);
        this.cutVoice?.pulse(C.audio.hitPulse);
        if (!stone) this.particleSystem?.triggerHitBlood?.(w.dropX, w.dropY, -dir.x, -dir.y, C.hit.blood, C.hit.spread);
    }

    bounce(w, dir) {
        this._burst('bounce', w, dir);
        this.renderer?.triggerShake(C.bounce.shake * this.motion);
    }

    land(w) {
        this._burst('land', w);
        this.particleSystem?.triggerDust?.(w.dropX, w.dropY, 0, -1, C.land.dust);
    }

    update(tackle, weapon, { active = true, timeScale = 1 } = {}, now = globalThis.performance?.now?.() ?? Date.now()) {
        const dt = this.lastTime === null ? 0 : Math.max(0, Math.min(C.maxFrameSeconds, (now - this.lastTime) / 1000));
        this.lastTime = now;
        const enabled = active && weapon?.dropped && !weapon.thrown;
        this.enabled = !!enabled;
        const simDt = enabled ? dt * clamp(timeScale) : 0;
        this.visual.heat = !enabled ? 0 : clamp(this.visual.heat + (tackle.state
            ? simDt / C.thermal.warmSeconds : -simDt / C.thermal.coolSeconds));
        if (this.visual.heat < C.thermal.minimumHeat) this.visual.heat = 0;
        this.visual.lit = !!(enabled && (tackle.state || this.visual.heat > 0));
        const speed = Math.hypot(tackle.vx, tackle.vy);
        const targets = tackleAudioTargets({ state: tackle.state, speed,
            stone: tackle.stuck?.e.effectMaterial === 'lavaStone', active: enabled, timeScale });
        for (const [key, cue] of [['flight', 'sawTackleFlight'], ['cut', 'sawTackleCut']]) {
            const target = targets[key], field = `${key}Voice`;
            if (target.level > 0 && !this[field]) this[field] = this.audio?.createLoopVoice(cue) ?? null;
            this[field]?.set(target, !enabled ? C.audio.inactiveTau : target.level > 0 ? C.audio.attackTau : C.audio.releaseTau);
        }
        if (!enabled) { this.bursts.length = 0; this.kick = this.hitTime = this.cutAccum = 0; }
        for (const burst of this.bursts) burst.age += simDt;
        this.bursts = this.bursts.filter(b => b.age < C[b.kind].seconds);
        this.kick = Math.max(0, this.kick - simDt);
        this.hitTime = Math.max(0, this.hitTime - simDt);
        this.visual.phase += simDt * Math.PI * 2 * C.blade.jitterHz;
        this.visual.jitter = enabled && tackle.state === 'stuck' ? C.blade.jitter * this.motion : 0;
        this.visual.scale = 1 + (this.kick / C.blade.kickSeconds * C.blade.kickScale
            + this.hitTime / C.blade.hitSeconds * C.blade.pulseScale) * this.motion;
        if (weapon) weapon.tackleFeedback = this.visual;
        if (enabled && tackle.state === 'stuck') {
            this.cutAccum += simDt * C.cut.emissionsPerSecond;
            const bursts = Math.min(C.cut.maxEmissionsPerFrame, Math.floor(this.cutAccum));
            this.cutAccum -= bursts;
            for (let i = 0; i < bursts; i++) this.particleSystem?.triggerHitSparks?.(weapon.dropX, weapon.dropY,
                -tackle.stuck.dirX, -tackle.stuck.dirY, C.cut.sparks, C.cut.power, C.cut.cone);
        } else this.cutAccum = 0;
    }

    _glow(ctx, x, y, size, color, alpha) {
        let sprite = this.glows.get(color);
        if (!sprite) {
            sprite = document.createElement('canvas');
            sprite.width = sprite.height = C.glowTextureSize;
            const g = sprite.getContext('2d'), r = C.glowTextureSize / 2;
            const gradient = g.createRadialGradient(r, r, 0, r, r, r);
            for (const stop of C.glowStops) gradient.addColorStop(stop.offset, color + stop.alpha);
            g.fillStyle = gradient; g.fillRect(0, 0, r * 2, r * 2);
            this.glows.set(color, sprite);
        }
        ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, x - size / 2, y - size / 2, size, size);
    }

    _drawTrail(ctx, tackle, w) {
        const points = tackle.trail;
        if (points.length < 3) return;
        for (const side of [-1, 1]) {
            const edge = points.map((p, i) => {
                const k = (i + 1) / points.length;
                const angle = (i === points.length - 1 ? w.rotation : p.rotation ?? w.rotation) * (w.spinDir ?? -1);
                return { x: p.x + Math.cos(angle) * w.discRadius * C.trail.orbit * side,
                    y: p.y + Math.sin(angle) * w.discRadius * C.trail.orbit * side - (1 - k) ** 2 * C.trail.rise };
            });
            ctx.lineJoin = 'round'; ctx.lineCap = 'round';
            for (let i = 1; i < edge.length; i++) {
                const a = edge[i - 1], b = edge[i], k = (i + 1) / edge.length;
                const length = C.trail.segmentBase + C.trail.segmentVariation * Math.sin(i * C.burstAngleStep);
                ctx.lineWidth = C.trail.width * k;
                ctx.strokeStyle = `rgb(${tackleHeatColor(C.colors.flight, this.visual.heat)})`;
                ctx.globalAlpha = Math.pow(k, C.trail.fadePower) * C.trail.alpha;
                ctx.beginPath();
                ctx.moveTo(b.x - (b.x - a.x) * length, b.y - (b.y - a.y) * length);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
                ctx.lineWidth = C.trail.coreWidth;
                ctx.strokeStyle = `rgb(${tackleHeatColor(i % C.trail.hotEvery === 0 ? C.colors.hot : C.colors.metal, this.visual.heat)})`;
                ctx.stroke();
            }
            for (let i = 0; i < edge.length; i += C.trail.glowStride) {
                const p = edge[i], k = (i + 1) / edge.length;
                this._heatedGlow(ctx, p.x, p.y, w.discRadius * C.blade.glowScale, C.colors.metal, C.trail.glowAlpha * k);
                ctx.globalAlpha = Math.pow(k, C.trail.fadePower) * C.trail.alpha;
                ctx.fillStyle = `rgb(${tackleHeatColor(i % 2 ? C.colors.flight : C.colors.hot, this.visual.heat)})`;
                ctx.fillRect(Math.round(p.x / C.pixel) * C.pixel, Math.round(p.y / C.pixel) * C.pixel, C.trail.coreWidth, C.trail.coreWidth);
            }
        }
    }

    _drawBurst(ctx, b) {
        const c = C[b.kind], t = b.age / c.seconds, eased = 1 - (1 - t) ** 3;
        const color = b.stone ? C.colors.stone : b.kind === 'launch' ? C.colors.flight : C.colors.metal;
        const radius = c.radius + c.travel * eased * this.motion;
        this._glow(ctx, b.x, b.y, radius * C.burst.glowScale, color, (1 - t) ** C.burst.fadePower * C.burst.glowAlpha);
        const angle = Math.atan2(b.dy, b.dx);
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.lineWidth = C.pixel;
        for (let i = 0; i < c.rays; i++) {
            const spread = Math.sin(i * C.burstAngleStep);
            const a = angle + spread * C.burstCone;
            const distance = radius * (C.burst.distanceBase + C.burst.distanceVariation * Math.cos(i * C.burstAngleStep));
            const x = b.x + Math.cos(a) * distance, y = b.y + Math.sin(a) * distance + t * t * c.travel;
            const tail = c.length * (1 - t);
            this._glow(ctx, x, y, C.pixel * C.burst.sparkGlowScale, color, (1 - t) * C.burst.sparkGlowAlpha);
            ctx.globalAlpha = (1 - t) * C.burst.alpha;
            ctx.beginPath(); ctx.moveTo(x - Math.cos(a) * tail, y - Math.sin(a) * tail); ctx.lineTo(x, y); ctx.stroke();
            ctx.fillStyle = C.colors.hot;
            ctx.fillRect(Math.round(x / C.pixel) * C.pixel, Math.round(y / C.pixel) * C.pixel, C.pixel, C.pixel);
        }
    }

    _heatedGlow(ctx, x, y, size, color, alpha) {
        this._glow(ctx, x, y, size, C.thermal.idle, alpha * (1 - this.visual.heat));
        this._glow(ctx, x, y, size, color, alpha * this.visual.heat);
    }

    renderLights(renderer, postProcessor, tackle, w) {
        if (!this.enabled || !w?.dropped || w.thrown) return;
        const stone = tackle.stuck?.e.effectMaterial === 'lavaStone';
        const cut = tackle.state === 'stuck';
        const color = stone ? C.light.stone : cut ? C.light.cut : C.light.flight;
        const light = (x, y, radius, strength, lightColor = color) => {
            const p = renderer.worldToScreen(x, y);
            postProcessor.addLight(p.x, p.y, radius * p.zoom, Math.max(2, Math.round(C.pixel * p.zoom)), C.light.flatten, {
                color: tackleHeatColor(lightColor, this.visual.heat), flickerBase: 1, flickerSine: C.light.flicker, flickerNoise: 0,
                falloff: C.light.falloff.map(stop => ({ offset: stop.offset, alpha: stop.alpha * strength }))
            });
        };
        if (this.visual.lit) for (const side of [-1, 1]) {
            const angle = w.rotation * (w.spinDir ?? -1), radius = w.discRadius * C.trail.orbit;
            light(w.dropX + Math.cos(angle) * radius * side, w.dropY + Math.sin(angle) * radius * side,
                cut ? C.light.cutRadius : C.light.flightRadius, cut ? C.light.cutStrength : C.light.flightStrength);
        }
        for (const b of this.bursts.slice(-C.light.maxBursts)) {
            const t = b.age / C[b.kind].seconds;
            light(b.x, b.y, C.light.burstRadius * (C.light.burstRadiusStart + C.light.burstRadiusGrow * t),
                (1 - t) ** C.burst.fadePower, b.stone ? C.light.stone : C.light.cut);
        }
        const stride = Math.max(1, Math.ceil(tackle.trail.length / C.light.maxTrail));
        for (let i = 0; i < tackle.trail.length - 2; i += stride) {
            const p = tackle.trail[i];
            light(p.x, p.y, C.light.trailRadius, (i + 1) / tackle.trail.length * C.light.trailStrength, C.light.flight);
        }
    }

    draw(ctx, tackle, w) {
        if (!this.enabled || !w?.dropped || w.thrown) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        this._drawTrail(ctx, tackle, w);
        if (this.visual.lit) {
            const cut = tackle.state === 'stuck', stone = tackle.stuck?.e.effectMaterial === 'lavaStone';
            const color = cut ? stone ? C.colors.stone : C.colors.metal : C.colors.flight;
            const radius = w.discRadius * C.trail.orbit;
            for (const side of [-1, 1]) {
                const angle = w.rotation * (w.spinDir ?? -1);
                this._heatedGlow(ctx, w.dropX + Math.cos(angle) * radius * side, w.dropY + Math.sin(angle) * radius * side,
                    w.discRadius * C.blade.glowScale, color, cut
                        ? C.blade.cutGlowAlpha * (1 + C.blade.cutPulseGlow * this.hitTime / C.blade.hitSeconds)
                        : C.blade.flightGlowAlpha);
            }
        }
        for (const burst of this.bursts) this._drawBurst(ctx, burst);
        ctx.restore();
    }
}
