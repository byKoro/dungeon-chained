import { DASH_PUSH_FEEL } from '../config/DashPushFeelConfig.js';

// Juice do Impacto: contato (hit-stop, faíscas, flash no inimigo, som), rastro de poeira enquanto ele voa e
// a batida quando o voo para de repente. `update()` roda depois das colisões do step, para medir o quanto o
// inimigo realmente andou; o amortecimento do voo (`pushDamp`) é limpo quando o arremesso acaba.
export class DashPushFeedback {
    constructor({ particleSystem = null, renderer = null, audio = null, hitStop = null, reducedMotion = false, endSpeed = 1, cfg = DASH_PUSH_FEEL } = {}) {
        Object.assign(this, { particleSystem, renderer, audio, hitStop, endSpeed, cfg });
        this.motion = reducedMotion ? cfg.reducedMotion : 1;
        this.flying = [];
    }

    reset() {
        for (const f of this.flying) delete f.e.pushDamp;
        this.flying = [];
    }

    _foot(e) {
        return e.footY ?? e.y + (e.hitRadius ?? 16);
    }

    _sound(s) {
        this.audio?.play?.(s.cue, { rateMultiplier: s.rate, volumeMultiplier: s.volume });
    }

    launch(e, p, nx, ny) {
        const c = this.cfg.contact, ps = this.particleSystem;
        const cx = (e.x + p.x) / 2, cy = (e.y + p.y) / 2;
        ps?.triggerHitSparks?.(cx, cy, nx, ny, c.sparks, c.power, c.cone);
        ps?.triggerFlash?.(cx, cy, c.flash, 0.9);
        ps?.triggerDust?.(e.x, this._foot(e), nx, ny, c.dust);
        e._startFlash?.(c.flashSteps);
        this.renderer?.triggerShake?.(c.shake * this.motion);
        this.hitStop?.(c.hitStop);
        this._sound(c.sound);
        this.flying = this.flying.filter(f => f.e !== e);
        this.flying.push({ e, by: p, x: e.x, y: e.y, speed: Math.hypot(e.pushVx, e.pushVy), age: 0 });
    }

    update() {
        const c = this.cfg, ps = this.particleSystem;
        this.flying = this.flying.filter(f => {
            const e = f.e;
            const done = () => { delete e.pushDamp; return false; };
            if (e.state === 'dying' || e.state === 'dead' || e.frozen || ++f.age > c.maxSteps) return done();
            // No step do contato o inimigo ainda não andou: só registra a posição já resolvida.
            if (f.age === 1) { f.x = e.x; f.y = e.y; return true; }
            const moved = Math.hypot(e.x - f.x, e.y - f.y);
            const speed = Math.hypot(e.pushVx ?? 0, e.pushVy ?? 0);
            if (f.speed > c.slam.minSpeed && moved < f.speed * c.slam.ratio) {
                const s = c.slam, k = 1 / (f.speed || 1);
                const dx = (e.pushVx ?? 0) * k || 0, dy = (e.pushVy ?? 0) * k || 0;
                ps?.triggerDust?.(e.x, this._foot(e), dx, dy, s.dust);
                ps?.triggerSparkBurst?.(e.x + dx * (e.hitRadius ?? 16), e.y + dy * (e.hitRadius ?? 16), 6, s.sparks, 0.7);
                this.renderer?.triggerShake?.(s.shake * this.motion);
                this.hitStop?.(s.hitStop);
                this._sound(s.sound);
                e.pushVx = e.pushVy = 0;
                // Quem arremessou ainda vem em dash logo atrás: para ali. Sem isso o dash atravessa o inimigo
                // preso na parede e a colisão de corpos o cospe para trás do jogador.
                const p = f.by;
                if (p?.dashing && Math.hypot(p.x - e.x, p.y - e.y) < ((p.hitRadius ?? 16) + (e.hitRadius ?? 16)) * s.stopReach) {
                    p.cancelDash?.();
                    p.vx = p.vy = 0;
                }
                return done();
            }
            if (speed > c.trail.minSpeed && f.age % c.trail.every === 0) {
                ps?.triggerDust?.(e.x, this._foot(e), e.pushVx / speed, e.pushVy / speed, c.trail.dust);
            }
            f.x = e.x; f.y = e.y; f.speed = speed;
            return speed >= this.endSpeed || done();
        });
    }
}
