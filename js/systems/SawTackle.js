import { SAW_TACKLE } from '../config/SawTackleConfig.js';
import { FLAME_GOLEM } from '../config/FlameGolemConfig.js';
import { SIM_HZ } from '../config/GameConfig.js';
import { Physics } from '../core/Physics.js';

const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const unit = (x, y, fx = 1, fy = 0) => { const d = Math.hypot(x, y); return d > 1e-6 ? { x: x / d, y: y / d } : { x: fx, y: fy }; };

export class SawTackle {
    constructor({ chain, getPlayers, getRoom, getBounds = () => null, isSolid = () => false,
        safeDrop = (x, y) => ({ x, y }), findLandingRoute = null, canLand = null, getAimTargets = null, onEnemyHit = null, audio = null, particleSystem = null, renderer = null,
        cfg = SAW_TACKLE, flightMode = cfg.flightMode, feedback = null }) {
        Object.assign(this, { chain, getPlayers, getRoom, getBounds, isSolid, safeDrop, findLandingRoute, canLand, getAimTargets, onEnemyHit, audio, particleSystem, renderer, cfg });
        this.flightMode = flightMode === 'coast' ? 'coast' : 'return';
        this.feedback = feedback;
        this.trail = [];
        this.reset();
    }

    reset() {
        this.feedback?.reset();
        this.state = null;
        this.mode = null;
        this.vx = this.vy = 0;
        this.origin = null;
        this.elapsed = 0;
        this.distance = 0;
        this.landingRoute = [];
        this.landingRetry = 0;
        this.landingFails = 0;
        this.stalled = 0;
        this.processed = new Set();
        this.stuck = null;
        this.homing = null;
        this.specialReturn = false;
        this.leftOrigin = false;
        this.steerPause = 0;
        this.impactSteps = 0;
        this.pending = null;
        this.justTackled = null;
        this._lockedTouch = [false, false];
        this.trail.length = 0;
        this._sync();
    }

    get active() { return !!this.state; }
    get locked() { return this.state === 'impact' || this.state === 'stuck'; }

    _sync() {
        const w = this.chain?.weapon;
        if (!w) return;
        w.tackleState = this.state;
        w.sawLocked = this.locked;
    }

    _loose() {
        const w = this.chain.weapon;
        return !!(this.chain.hasSaw && !this.chain.isConnected && w?.dropped && !w.thrown);
    }

    update() {
        this.justTackled = null;
        if (!this._loose()) {
            if (this.state || this.trail.length) this.reset();
            else this._sync();
            return;
        }
        const w = this.chain.weapon;
        this._tryTackle(w);
        // No passo do tackle a serra fica parada; o hit stop conta a partir do próximo, igual ao jogador.
        if (!this.justTackled) {
            if (this.state === 'impact') this._updateImpact();
            else if (this.state === 'flight') this._updateFlight(w);
            else if (this.state === 'stuck') this._updateStuck(w);
            else if (this.state === 'landing') this._updateLanding(w);
        }
        this._sync();
        this._updateTrail(w);
    }

    _tryTackle(w) {
        const r = w.discRadius * this.cfg.contactScale;
        let best = null;
        (this.getPlayers() || []).forEach((p, i) => {
            const touching = p && p.dashing && !p.falling && p.lives > 0
                && Physics.distToSegment(w.dropX, w.dropY, p.x - p.vx, p.y - p.vy, p.x, p.y) < r + (p.hitRadius ?? 16);
            if (!touching) { this._lockedTouch[i] = false; return; }
            if (this.locked) {
                if (!this._lockedTouch[i]) this._lockedFeedback(w);
                this._lockedTouch[i] = true;
                return;
            }
            // Dois tackles no mesmo passo: vence o mais próximo; empate fica com o P1.
            const d = Math.hypot(w.dropX - p.x, w.dropY - p.y);
            if (!best || d < best.d) best = { p, d, R: r + (p.hitRadius ?? 16) };
        });
        if (best) this._tackle(w, best.p, best.R);
    }

    _tackle(w, p, R) {
        const c = this.cfg;
        const dir = unit(p.dashDirX ?? p.vx, p.dashDirY ?? p.vy, Math.sign(p.vx) || 1, 0);
        // O jogador para na borda do contato, do lado de onde veio.
        const back = { x: w.dropX - dir.x * R, y: w.dropY - dir.y * R };
        if (Math.hypot(back.x - p.x, back.y - p.y) <= R + Math.hypot(p.vx, p.vy)) { p.x = back.x; p.y = back.y; }
        const freeze = Math.max(1, Math.round(c.hitStopSeconds * SIM_HZ));
        p.startTackle?.(dir.x, dir.y, {
            freezeSteps: freeze, reactionSteps: c.reactionSteps, recoilSpeed: c.recoilSpeed,
            invulnSteps: c.invulnSteps, impactScale: c.impactScale
        });
        if (!p.startTackle) { p.dashing = false; p.vx = p.vy = 0; }
        this.processed = new Set();
        this.landingRoute = [];
        this.stuck = null;
        this.homing = null;
        this.specialReturn = false;
        this.leftOrigin = false;
        this.steerPause = 0;
        this.state = 'impact';
        this.mode = 'tackle';
        this.impactSteps = freeze;
        this.origin = { x: w.dropX, y: w.dropY };
        this.pending = this._assistAim(w, dir);
        this.vx = this.vy = 0;
        this.justTackled = p;
        w.dropSpin = c.spin;
        w.dropT = Math.min(w.dropT ?? 1, 0.7);
        const s = c.sound.tackle;
        this.audio?.play(s.cue, { rateMultiplier: s.rate, volumeMultiplier: s.volume });
        this.particleSystem?.triggerHitSparks?.(w.dropX - dir.x * R * 0.5, w.dropY - dir.y * R * 0.5, dir.x, dir.y, c.impactSparks, 1, 0.9);
        this.particleSystem?.triggerFlash?.(w.dropX, w.dropY, 8, 0.8);
        this.renderer?.triggerShake(c.impactShake * (this.feedback?.motion ?? 1));
        this.feedback?.impact(w, dir);
    }

    _lockedFeedback(w) {
        const s = this.cfg.sound.locked;
        this.audio?.play(s.cue, { rateMultiplier: s.rate, volumeMultiplier: s.volume });
        this.particleSystem?.triggerSparkBurst?.(w.dropX, w.dropY, w.discRadius * 0.5, this.cfg.lockedSparks, 0.4);
    }

    _targetable(e) {
        return !!e && e.state !== 'dying' && e.state !== 'dead' && !e.isHidden && !e.frozen && !e.airborne
            && (e.hp ?? 1) > 0 && !this.processed.has(e);
    }

    // Alvos da mira assistida: inimigos atingíveis + estacas de corda não cortadas (injetadas pelo Game).
    _aimCandidates() {
        const pts = [];
        for (const e of this.getRoom()?.enemies || []) if (this._targetable(e)) pts.push({ x: e.x, y: e.y });
        for (const s of this.getAimTargets?.() || []) if (s) pts.push({ x: s.x, y: s.y });
        return pts;
    }

    // Uma correção por lançamento: o alvo mais alinhado (inimigo ou estaca) dentro do cone e do alcance, sem parede no meio.
    _assistAim(w, dir) {
        const c = this.cfg, cone = c.aimConeDeg * Math.PI / 180;
        let best = null;
        for (const t of this._aimCandidates()) {
            const ex = t.x - w.dropX, ey = t.y - w.dropY, d = Math.hypot(ex, ey);
            if (d < 1 || d > c.aimRange) continue;
            const angle = Math.acos(Math.max(-1, Math.min(1, (ex * dir.x + ey * dir.y) / d)));
            if (angle > cone || this._wallBetween(w.dropX, w.dropY, t.x, t.y)) continue;
            const score = angle + (d / c.aimRange) * 0.05;
            if (!best || score < best.score) best = { score, angle, ex, ey };
        }
        if (!best) return dir;
        const turn = Math.min(best.angle, c.aimMaxTurnDeg * Math.PI / 180);
        const side = dir.x * best.ey - dir.y * best.ex >= 0 ? 1 : -1;
        const a = Math.atan2(dir.y, dir.x) + side * turn;
        return { x: Math.cos(a), y: Math.sin(a) };
    }

    _wallBetween(x0, y0, x1, y1) {
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 16));
        for (let i = 1; i < n; i++) {
            const t = i / n;
            if (this.isSolid(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true;
        }
        return false;
    }

    _updateImpact() {
        if (--this.impactSteps > 0) return;
        this._launch(this.pending, this.cfg.speed);
    }

    _launch(dir, speed) {
        this.stalled = 0;
        this.state = 'flight';
        this.vx = dir.x * speed;
        this.vy = dir.y * speed;
        this.elapsed = 0;
        this.distance = 0;
        this.feedback?.launch(this.chain.weapon, dir);
    }

    onBossImpacts(enemies) {
        if (!this._loose() || this.state) return;
        for (const e of enemies || []) {
            if (e.effectMaterial !== 'lavaStone') continue;
            if (e.charging && e.currentAttack === 'attack3') {
                const w = this.chain.weapon;
                const point = Physics.closestPointOnSegment(w.dropX, w.dropY, e.x - e.vx, e.y - e.vy, e.x, e.y);
                const cfg = e.abilities?.attack3 ?? FLAME_GOLEM.attacks.attack3;
                this.launchFromBoss(e, point.x, point.y, cfg.hitRadius, unit(e.vx, e.vy));
                continue;
            }
            let radius = null;
            if (e.justSlammed) radius = FLAME_GOLEM.slam.radius;
            else if (e.justGroundHit && !e.slamMode && ['attack', 'attack2'].includes(e.currentAttack)) {
                const cfg = e.abilities?.[e.currentAttack] ?? FLAME_GOLEM.attacks[e.currentAttack];
                radius = cfg.radius ?? cfg.range;
            }
            if (radius !== null) this.launchFromBoss(e, e.x, e.y, radius);
        }
    }

    // Só a serra parada no chão; não mexe na serra em voo, presa ou conectada.
    launchFromBoss(boss, cx, cy, radius, direction = null) {
        if (!this._loose() || this.state) return false;
        const w = this.chain.weapon;
        const dx = w.dropX - cx, dy = w.dropY - cy;
        if (Math.hypot(dx, dy) > radius + w.discRadius * this.cfg.contactScale) return false;
        if (this._wallBetween(cx, cy, w.dropX, w.dropY)) return false;
        // Serra no centro exato do impacto: sai para baixo (direção fixa, sem sorteio).
        const dir = direction ?? unit(dx, dy, 0, 1);
        this.processed = new Set([boss]);
        this.stuck = null;
        this.homing = null;
        this.specialReturn = false;
        this.leftOrigin = false;
        this.mode = 'boss';
        this.origin = { x: w.dropX, y: w.dropY };
        this._launch(dir, this.cfg.bossLaunchSpeed);
        w.dropSpin = this.cfg.spin;
        this._sync();
        return true;
    }

    _blocked(w, x, y) {
        const r = w.discRadius * this.cfg.wallContactScale;
        const b = this.getBounds?.();
        if (b && (x < b.minX + r || x > b.maxX - r || y < b.minY + r || y > b.maxY - r)) return true;
        if (this.isSolid(x, y)) return true;
        // Na volta especial o corpo sólido já atingido conta como parede: a serra não atravessa o Arauto.
        if (this.specialReturn || (this.mode === 'tackle' && this.flightMode === 'coast')) {
            for (const e of this.processed) if (this._insideBody(e, x, y, w.discRadius * this.cfg.enemyContactScale)) return true;
        }
        return false;
    }

    // A serra encosta (com uma folga) num corpo sólido já atingido neste lançamento.
    _touchingProcessed(w) {
        const r = w.discRadius * this.cfg.enemyContactScale + this.cfg.sweepStep;
        for (const e of this.processed) if (this._insideBody(e, w.dropX, w.dropY, r)) return true;
        return false;
    }

    _insideBody(e, x, y, r) {
        if (!e?.immovable || !e.collisionBodies || e.ignoresEntityCollisions) return false;
        return e.collisionBodies.some(body => Math.hypot(
            (x - e.x - body.x) / (body.radiusX + r), (y - e.y - body.y) / (body.radiusY + r)) < 1);
    }

    _contactAt(w) {
        const r = w.discRadius * this.cfg.enemyContactScale;
        for (const e of this.getRoom()?.enemies || []) {
            if (!this._targetable(e)) continue;
            if (e.immovable && e.collisionBodies && !e.ignoresEntityCollisions) {
                if (this._insideBody(e, w.dropX, w.dropY, r)) return { e, solid: true };
            } else if (Math.hypot(e.x - w.dropX, e.y - w.dropY) < r + (e.hitRadius ?? 16)) return { e, solid: false };
        }
        return null;
    }

    _steer(w, speed) {
        if (this.steerPause > 0) { this.steerPause--; return; }
        let rate;
        if (this.homing === 'direct') rate = Math.PI;
        else {
            const start = this.cfg.returnStartSteps;
            if (this.elapsed < start) return;
            rate = this.cfg.returnTurnRate * Math.min(1, (this.elapsed - start + 1) / this.cfg.returnRampSteps);
            this.homing ??= 'normal';
        }
        const desired = Math.atan2(this.origin.y - w.dropY, this.origin.x - w.dropX);
        const current = Math.atan2(this.vy, this.vx);
        const a = current + Math.max(-rate, Math.min(rate, wrap(desired - current)));
        this.vx = Math.cos(a) * speed;
        this.vy = Math.sin(a) * speed;
    }

    // Serra já dentro de algo que bloqueia (encostada na parede além da margem do voo, ou dentro do corpo do
    // Arauto que mexeu os braços): todo passo seria bloqueado nos dois sentidos e ela ficaria parada para sempre.
    // Leva para o ponto livre mais próximo, de preferência contra o movimento. Devolve false se não achou.
    _unstick(w) {
        if (!this._blocked(w, w.dropX, w.dropY)) return true;
        const c = this.cfg, max = w.discRadius * c.unstickMaxScale;
        const away = unit(-this.vx, -this.vy, 0, 0);
        for (let r = c.unstickStep; r <= max; r += c.unstickStep) {
            let best = null;
            for (let i = 0; i < 16; i++) {
                const a = i * Math.PI / 8, x = w.dropX + Math.cos(a) * r, y = w.dropY + Math.sin(a) * r;
                if (this._blocked(w, x, y)) continue;
                const score = Math.cos(a) * away.x + Math.sin(a) * away.y;
                if (!best || score > best.score) best = { x, y, score };
            }
            if (best) { w.dropX = best.x; w.dropY = best.y; return true; }
        }
        return false;
    }

    _updateFlight(w) {
        const c = this.cfg, boss = this.mode === 'boss';
        const coast = !boss && this.flightMode === 'coast';
        this.elapsed++;
        if (!this._unstick(w)) { this._land(w); return; }
        this._stepFrom = { x: w.dropX, y: w.dropY };
        let speed = Math.hypot(this.vx, this.vy);
        if (!boss && !coast) { speed = c.speed; this._steer(w, speed); }
        const steps = Math.max(1, Math.ceil(speed / c.sweepStep));
        const bounce = boss ? -c.bossRestitution : -1;
        let bounced = false;
        for (let i = 0; i < steps; i++) {
            const px = w.dropX, py = w.dropY;
            const sx = this.vx / steps, sy = this.vy / steps;
            if (this._blocked(w, w.dropX + sx, w.dropY)) { this.vx *= bounce; bounced = true; } else w.dropX += sx;
            if (this._blocked(w, w.dropX, w.dropY + sy)) { this.vy *= bounce; bounced = true; } else w.dropY += sy;
            const hit = this.specialReturn ? null : this._contactAt(w);
            if (hit?.solid) { w.dropX = px; w.dropY = py; }
            this.distance += Math.hypot(w.dropX - px, w.dropY - py);
            if (hit) {
                this._stick(w, hit.e);
                return;
            }
        }
        w.dropSpin = c.spin;
        // Sem sair do lugar por vários passos (quinas, ou o volante empurrando contra o corpo do Arauto): cai no
        // piso seguro em vez de ficar quicando parada.
        const moved = Math.hypot(w.dropX - this._stepFrom.x, w.dropY - this._stepFrom.y);
        this.stalled = moved < c.stallMinMove ? this.stalled + 1 : 0;
        if (this.stalled >= c.stallSteps) { this._land(w); return; }
        // Na volta direta, bater no Arauto (e não numa parede) troca para a volta normal com quiques.
        if (bounced && this.specialReturn && this._touchingProcessed(w)) this.specialReturn = false;
        if (bounced) this._bounceFeedback(w);
        if (bounced && this.homing) {
            this.steerPause = c.steerPauseSteps;
            if (this.homing === 'direct') this.homing = 'normal';
        }
        if (boss) {
            this.vx *= c.bossFriction;
            this.vy *= c.bossFriction;
            if (Math.hypot(this.vx, this.vy) < c.bossMinSpeed || this.elapsed >= c.bossMaxFlightSteps) this._land(w);
            return;
        }
        if (coast) {
            if (this.distance >= c.coastDistance) {
                this.vx *= c.coastFriction;
                this.vy *= c.coastFriction;
            }
            if (Math.hypot(this.vx, this.vy) < c.coastMinSpeed || this.elapsed >= c.maxFlightSteps) this._land(w);
            return;
        }
        const d = Math.hypot(w.dropX - this.origin.x, w.dropY - this.origin.y);
        if (d > c.arriveRadius * 1.5) this.leftOrigin = true;
        if ((this.leftOrigin && this.elapsed >= c.minFlightSteps && d < c.arriveRadius) || this.elapsed >= c.maxFlightSteps) this._land(w);
    }

    _bounceFeedback(w) {
        const s = this.cfg.sound.bounce;
        this.audio?.play(s.cue, { rateMultiplier: s.rate, volumeMultiplier: s.volume });
        this.particleSystem?.triggerSparkBurst?.(w.dropX, w.dropY, w.discRadius * 0.6, 3, 0.6);
        this.feedback?.bounce(w, unit(this.vx, this.vy));
    }

    _land(w) {
        const p = this.safeDrop(w.dropX, w.dropY);
        if (Math.hypot(p.x - w.dropX, p.y - w.dropY) > 1e-6 || this._blocked(w, w.dropX, w.dropY)) {
            if (this.state !== 'landing') this.landingFails = 0;
            this.state = 'landing';
            this.stuck = null;
            this.homing = null;
            this._unstick(w);
            this.landingRoute = this.findLandingRoute
                ? this.findLandingRoute(w.dropX, w.dropY, (x, y) => this._blocked(w, x, y)) || [] : [p];
            this.landingRetry = this.cfg.landingRepathSteps;
            return;
        }
        this._finishLanding();
    }

    // Sem rota depois de várias tentativas (cercada ou presa): cai no piso seguro e alcançável. Prefere perto da
    // origem do lançamento (a serra "volta para onde foi lançada" e nunca fica inalcançável), senão perto de onde parou.
    // `safeDrop` já devolve um tile de chão; quando há `canLand`, só aceita o ponto perto da origem se for alcançável.
    _forceLanding(w) {
        const origin = this.origin;
        const nearOrigin = origin ? this.safeDrop(origin.x, origin.y) : null;
        const ok = nearOrigin && (!this.canLand || this.canLand(nearOrigin.x, nearOrigin.y));
        const p = ok ? nearOrigin : this.safeDrop(w.dropX, w.dropY);
        w.dropX = p.x;
        w.dropY = p.y;
        this._finishLanding();
    }

    _updateLanding(w) {
        if (!this.landingRoute.length) {
            if (--this.landingRetry > 0) return;
            if (++this.landingFails > this.cfg.landingMaxRetries) { this._forceLanding(w); return; }
            this._land(w);
            if (this.state !== 'landing' || !this.landingRoute.length) return;
        }
        this._unstick(w);
        const target = this.landingRoute[0];
        const dx = target.x - w.dropX, dy = target.y - w.dropY, distance = Math.hypot(dx, dy);
        const travel = Math.min(distance, this.cfg.landingSpeed);
        const steps = Math.max(1, Math.ceil(travel / this.cfg.sweepStep));
        const dir = unit(dx, dy);
        for (let i = 0; i < steps; i++) {
            const x = w.dropX + dir.x * travel / steps, y = w.dropY + dir.y * travel / steps;
            if (this._blocked(w, x, y)) {
                this.landingRoute = [];
                this.landingRetry = this.cfg.landingRepathSteps;
                this.vx = this.vy = 0;
                return;
            }
            this.vx = x - w.dropX; this.vy = y - w.dropY;
            w.dropX = x; w.dropY = y;
        }
        if (distance <= travel + 1e-6) {
            this.landingRoute.shift();
            if (!this.landingRoute.length) {
                if (this.canLand?.(w.dropX, w.dropY) && !this._blocked(w, w.dropX, w.dropY)) this._finishLanding();
                else this._land(w);
            }
        }
    }

    _finishLanding() {
        const s = this.cfg.sound.land;
        this.audio?.play(s.cue, { rateMultiplier: s.rate, volumeMultiplier: s.volume });
        this.feedback?.land(this.chain.weapon);
        this.state = null;
        this.mode = null;
        this.stuck = null;
        this.homing = null;
        this.specialReturn = false;
        this.vx = this.vy = 0;
        this.landingRoute = [];
    }

    _stick(w, e) {
        const dir = unit(e.x - w.dropX, e.y - w.dropY, this.vx, this.vy);
        this.stuck = { e, ox: w.dropX - e.x, oy: w.dropY - e.y, hits: 0, next: 0, wait: 0, vx: this.vx, vy: this.vy, dirX: dir.x, dirY: dir.y };
        this.state = 'stuck';
        w.dropSpin = this.cfg.spin;
        this.feedback?.contact(w, e, dir);
    }

    _updateStuck(w) {
        const c = this.cfg, s = this.stuck, e = s.e;
        const room = this.getRoom();
        const valid = (room?.enemies || []).includes(e) && e.state !== 'dying' && e.state !== 'dead'
            && !e.isHidden && !e.airborne && (e.hp ?? 1) > 0;
        if (!valid) { this._release(w, false); return; }
        w.dropX = e.x + s.ox;
        w.dropY = e.y + s.oy;
        w.dropSpin = c.spin;
        this.particleSystem?.triggerSparks?.(w.dropX, w.dropY, w.discRadius, w.spinDir ?? 1, c.stuckSparks);
        s.wait++;
        if (s.next > 0) s.next--;
        if (s.next <= 0) {
            const result = e.takeHit ? e.takeHit(c.damagePerHit, { dirX: s.dirX, dirY: s.dirY }) : (e.startDying?.(), { killed: true });
            if (result) {
                s.hits++;
                s.wait = 0;
                s.next = Math.max(1, Math.round(c.hitIntervalSeconds * SIM_HZ));
                this.onEnemyHit?.(e, result, { x: w.dropX, y: w.dropY, dirX: s.dirX, dirY: s.dirY });
                this.feedback?.hit(w, e, result, { x: s.dirX, y: s.dirY });
                const killed = (typeof result === 'object' && result.killed) || e.state === 'dying';
                if (killed) { this._release(w, false); return; }
                if (s.hits >= c.hits) { this._release(w, true); return; }
            }
        }
        if (s.wait > Math.round(c.stuckMaxWaitSeconds * SIM_HZ)) this._release(w, false);
    }

    _release(w, completed) {
        const s = this.stuck, e = s.e;
        this.processed.add(e);
        this.stuck = null;
        this.state = 'flight';
        this.vx = s.vx;
        this.vy = s.vy;
        if (this.flightMode === 'coast') return;
        if (!completed || this.mode !== 'tackle' || e.effectMaterial !== 'lavaStone') return;
        if (this.cfg.arautoAfterHits === 'drop') { this._land(w); return; }
        // Arauto: volta direto para a origem, sem procurar novos alvos e sem mira assistida.
        this.specialReturn = true;
        this.homing = 'direct';
        this.leftOrigin = true;
        this.steerPause = 0;
        const dir = unit(this.origin.x - w.dropX, this.origin.y - w.dropY, -s.vx, -s.vy);
        this.vx = dir.x * this.cfg.speed;
        this.vy = dir.y * this.cfg.speed;
    }

    _updateTrail(w) {
        if (this.state === 'flight' || this.state === 'landing') {
            this.trail.push({ x: w.dropX, y: w.dropY, rotation: w.rotation });
            if (this.trail.length > this.cfg.trailLength) this.trail.shift();
        } else if (this.trail.length) this.trail.shift();
    }

}
