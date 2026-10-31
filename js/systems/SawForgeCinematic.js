import { SAW_CINEMATIC } from '../config/ForgeConfig.js';
import { HOLE_FALL } from '../config/GameConfig.js';
import { PROP_COLLISION } from '../config/PropConfig.js';

const clamp01 = v => Math.max(0, Math.min(1, v));
const easeOut = k => 1 - Math.pow(1 - k, 3);
const easeIn = k => k * k;
const FOOT = HOLE_FALL.footOffset;
const NO_INPUT = { isDown: () => false };

// Liang–Barsky estrito: encostar na borda não conta como atravessar.
function segmentCrossesBox(ax, ay, bx, by, b) {
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dy = by - ay;
    for (const [p, q] of [[-dx, ax - b.x], [dx, b.x + b.w - ax], [-dy, ay - b.y], [dy, b.y + b.h - ay]]) {
        if (p === 0) { if (q <= 0) return false; continue; }
        const r = q / p;
        if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
        else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return t1 - t0 > 1e-6;
}

const grow = (b, m) => ({ x: b.x - m, y: b.y - m, w: b.w + m * 2, h: b.h + m * 2 });

// Craft da Serra: letterbox e câmera na bigorna; os dois andam até um lado cada, três marteladas, a serra salta
// girando, pousa na bigorna e desce até o meio deles. O Game congela o resto da simulação enquanto `active`;
// `onEnd(anvil)` conecta a serra de verdade nos dois.
export class SawForgeCinematic {
    constructor({ renderer, particleSystem, audio = null, camera = null, getWeapon, getPlayers = () => [], getAnvilBox = null,
        resolvePlayers = null, onEnd = null, cfg = SAW_CINEMATIC }) {
        Object.assign(this, { renderer, particleSystem, audio, camera, getWeapon, getPlayers, getAnvilBox, resolvePlayers, onEnd, cfg });
        this.walkers = [];
        this.reset();
    }

    reset() {
        for (const w of this.walkers) w.p.autoMove = null;
        this.active = false;
        this.t = 0;
        this.anvil = null;
        this.walkers = [];
        this.forgeAt = null;
        this._box = null;
        this._hits = 0;
        this._landed = false;
        if (this.camera) this.camera.focus = null;
    }

    start(anvil) {
        this.reset();
        this.active = true;
        this.anvil = anvil;
        if (this.camera) this.camera.focus = { x: anvil.x, y: anvil.y + this.cfg.focusOffsetY, zoom: this.cfg.zoom };
        this._box = this.getAnvilBox?.(anvil) ?? { x: anvil.x - 32, y: anvil.y + 8, w: 64, h: 24 };
        this.walkers = this._planWalk();
        if (!this.walkers.length) this.forgeAt = this.cfg.settle;
    }

    get anvilTop() {
        return { x: this.anvil.x, y: this.anvil.y - this.cfg.sawLift };
    }

    // Tempo desde o início da forja (marteladas em diante); negativo enquanto eles andam.
    get forgeT() {
        return this.forgeAt === null ? -Infinity : this.t - this.forgeAt;
    }

    // Quem está mais à esquerda vai para o lado esquerdo. Alvos em coordenada do centro do jogador.
    _planWalk() {
        const c = this.cfg, b = this._box, ax = this.anvil.x;
        const players = (this.getPlayers() || []).filter(p => p && !p.falling && p.lives > 0);
        if (players.length < 2) return [];
        const half = Math.max(ax - b.x, b.x + b.w - ax) + c.sideGap;
        const y = b.y + b.h + c.frontGap - FOOT;
        const [left, right] = [...players].sort((a, b2) => a.x - b2.x);
        return [{ p: left, x: ax - half, y, faceLeft: false }, { p: right, x: ax + half, y, faceLeft: true }].map(w => {
            w.p.cancelDash?.();
            return { ...w, arrived: false };
        });
    }

    // Próximo ponto (pés) até o alvo: em linha reta ou pelas quinas da frente da base, sem atravessar a bigorna.
    _waypoint(fx, fy, gx, gy) {
        const solid = grow(this._box, PROP_COLLISION.footRadius);
        if (!segmentCrossesBox(fx, fy, gx, gy, solid)) return { x: gx, y: gy };
        const e = grow(this._box, PROP_COLLISION.footRadius + 4);
        const cx = e.x + e.w / 2, front = e.y + e.h;
        const goalCorner = { x: gx < cx ? e.x : e.x + e.w, y: front };
        if (!segmentCrossesBox(fx, fy, goalCorner.x, goalCorner.y, solid)) return goalCorner;
        return { x: fx < cx ? e.x : e.x + e.w, y: front };
    }

    _updateWalk() {
        const c = this.cfg;
        for (const w of this.walkers) {
            const p = w.p;
            const dist = Math.hypot(w.x - p.x, w.y - p.y);
            if (!w.arrived && dist <= c.arriveRadius && p.speedMag < 0.3) w.arrived = true;
            if (w.arrived || dist <= c.arriveRadius) p.autoMove = { x: 0, y: 0 };
            else {
                const goal = this._waypoint(p.x, p.y + FOOT, w.x, w.y + FOOT);
                const dx = goal.x - p.x, dy = goal.y - (p.y + FOOT);
                const leg = Math.hypot(dx, dy) || 1;
                const k = Math.min(1, dist / c.slowRadius) * c.walkScale;
                p.autoMove = { x: (dx / leg) * k, y: (dy / leg) * k };
            }
            p.update(NO_INPUT, null, {});
        }
        this.resolvePlayers?.(this.walkers.map(w => w.p));
        for (const w of this.walkers) if (w.arrived) w.p.facingLeft = w.faceLeft;
        if (this.forgeAt === null && (this.walkers.every(w => w.arrived) || this.t >= c.walkMax)) this.forgeAt = this.t + c.settle;
    }

    update(dt) {
        if (!this.active) return;
        const c = this.cfg;
        this.t += dt;
        this._updateWalk();
        const k = this.forgeT;
        const top = this.anvilTop;
        while (this._hits < c.hits.length && k >= c.hits[this._hits]) {
            const i = this._hits++;
            this.audio?.play("forgeHammer", { rateMultiplier: 1 + i * 0.06 });
            this.renderer.triggerShake(c.hitShake[i]);
            this.particleSystem.triggerSparkBurst?.(top.x, top.y + 8, 18, c.hitSparks[i], 1 + i * 0.25);
            this.particleSystem.triggerFlash?.(top.x, top.y + 6, 6 + i * 3, 0.8);
        }
        if (!this._landed && k >= c.jumpEnd) {
            this._landed = true;
            this.audio?.play("sawLand");
            this.renderer.triggerShake(c.landShake);
            this.particleSystem.triggerFlash?.(top.x, top.y, c.landFlash, 1);
        }
        if (k >= c.end) {
            const anvil = this.anvil;
            for (const w of this.walkers) { w.p.autoMove = null; w.p.latchDashKey?.(); }
            this.walkers = [];
            this.active = false;
            if (this.camera) this.camera.focus = null;
            this.onEnd?.(anvil);
        }
    }

    // 0..1 = altura das faixas pretas.
    get letterbox() {
        if (!this.active) return 0;
        const c = this.cfg;
        const k = this.forgeT;
        if (k > c.connectStart) return 1 - easeOut(clamp01((k - c.connectStart) / (c.end - c.connectStart)));
        if (this.t < c.letterboxIn) return easeOut(this.t / c.letterboxIn);
        return 1;
    }

    // Meio dos dois jogadores, onde a serra conectada vai ficar.
    _linkPoint() {
        const [a, b] = this.walkers.map(w => w.p);
        return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : this.anvilTop;
    }

    // Pose da serra no mundo: salto, pouso com squash e descida até o meio dos dois; null antes de surgir.
    sawPose() {
        const c = this.cfg;
        const k = this.forgeT;
        if (!this.active || k < c.jumpStart) return null;
        const top = this.anvilTop;
        if (k < c.jumpEnd) {
            const j = (k - c.jumpStart) / (c.jumpEnd - c.jumpStart);
            return { x: top.x, y: top.y - Math.sin(j * Math.PI) * c.jumpHeight, rotation: j * c.jumpSpins * Math.PI * 2, sx: 1, sy: 1 };
        }
        const since = k - c.jumpEnd;
        const sq = since < c.squashTime ? Math.sin((since / c.squashTime) * Math.PI) * (1 - since / c.squashTime) : 0;
        const m = easeIn(clamp01((k - c.connectStart) / (c.end - c.connectStart)));
        const link = this._linkPoint();
        return {
            x: top.x + (link.x - top.x) * m, y: top.y + (link.y - top.y) * m,
            rotation: 0, sx: 1 + sq * c.squashAmount * 0.6, sy: 1 - sq * c.squashAmount
        };
    }

    drawWorld(ctx) {
        const pose = this.sawPose();
        if (pose) this.getWeapon()?.drawAt?.(ctx, pose.x, pose.y, pose);
    }

    drawOverlay(ctx, canvas) {
        const k = this.letterbox;
        if (k <= 0) return;
        const h = Math.round(canvas.height * this.cfg.barRatio * k);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#050409";
        ctx.fillRect(0, 0, canvas.width, h);
        ctx.fillRect(0, canvas.height - h, canvas.width, h);
        ctx.restore();
    }
}
