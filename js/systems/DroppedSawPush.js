import { SAW_PUSH } from '../config/ChainConfig.js';

// Serra largada (cabo arrebentado) como um corpo leve: os jogadores esbarram, ela desliza um pouco, rola no sprite
// e para em paredes, buracos, grades e estacas. Não dá dano. Com os dois perto, o Chain reconecta como sempre.
export class DroppedSawPush {
    constructor({ chain, getPlayers, isBlocked = () => false, getBounds = () => null, canPush = () => true,
        audio = null, particleSystem = null, renderer = null, cfg = SAW_PUSH }) {
        Object.assign(this, { chain, getPlayers, isBlocked, getBounds, canPush, audio, particleSystem, renderer, cfg });
        this.reset();
    }

    reset() {
        this.vx = 0;
        this.vy = 0;
        this.bumpCooldown = 0;
        this.steps = 0;
        this.touching = [false, false];
        this.kickSteps = 0;
    }

    _eligible() {
        const w = this.chain.weapon;
        return this.chain.hasSaw && !this.chain.isConnected && w?.dropped && !w.thrown && this.canPush();
    }

    update() {
        if (this.bumpCooldown > 0) this.bumpCooldown--;
        if (!this._eligible()) { this.reset(); return; }
        const w = this.chain.weapon, cfg = this.cfg;
        const sawR = w.discRadius * cfg.radiusScale;
        (this.getPlayers() || []).forEach((p, i) => {
            const was = this.touching[i];
            this.touching[i] = false;
            if (!p || p.falling || p.lives <= 0) return;
            let dx = w.dropX - p.x, dy = w.dropY - p.y;
            let d = Math.hypot(dx, dy);
            const R = sawR + (p.hitRadius ?? 16);
            if (d >= R) return;
            if (d === 0) { dx = 0; dy = 1; d = 1; }
            const nx = dx / d, ny = dy / d, overlap = R - d;
            this.touching[i] = true;

            const moved = this._move(nx * overlap * cfg.share, ny * overlap * cfg.share);
            const rest = overlap - moved;
            p.x -= nx * rest;
            p.y -= ny * rest;

            const approach = p.vx * nx + p.vy * ny;
            if (approach <= 0) return;
            this.vx += nx * approach * cfg.transfer;
            this.vy += ny * approach * cfg.transfer;
            p.vx -= nx * approach * cfg.playerDrag;
            p.vy -= ny * approach * cfg.playerDrag;
            if (!was && approach >= cfg.bumpSpeed) this._bump(w, p, nx, ny, approach);
        });

        const speed = Math.hypot(this.vx, this.vy);
        if (this.kickSteps > 0) this.kickSteps--;
        else if (this.touching.some(Boolean) && speed > cfg.maxSpeed) {
            this.vx *= cfg.maxSpeed / speed;
            this.vy *= cfg.maxSpeed / speed;
        }
        const rolled = this._slide(w);
        // Rola no sprite parado: ângulo = distância / raio, no sentido do deslize horizontal.
        if (rolled > 0) w.rotation += (rolled / w.discRadius) * Math.sign(this.vx || 1) * (w.spinDir || 1);
        this.vx *= cfg.friction;
        this.vy *= cfg.friction;
        if (Math.hypot(this.vx, this.vy) < 0.02) this.vx = this.vy = 0;

        this.steps++;
        if (rolled > cfg.dustSpeed && this.steps % cfg.dustEvery === 0) {
            this.particleSystem?.triggerDust?.(w.dropX - this.vx * 4, w.dropY + w.discRadius * 0.3, -this.vx * 0.3, -this.vy * 0.3, 1);
        }
    }

    // Move a serra por (dx, dy) parando no que bloqueia; devolve quanto andou.
    _move(dx, dy) {
        const w = this.chain.weapon;
        let x = w.dropX + dx, y = w.dropY + dy;
        const b = this.getBounds();
        if (b) { x = Math.max(b.minX, Math.min(b.maxX, x)); y = Math.max(b.minY, Math.min(b.maxY, y)); }
        if (this.isBlocked(x, y)) return 0;
        const moved = Math.hypot(x - w.dropX, y - w.dropY);
        w.dropX = x;
        w.dropY = y;
        return moved;
    }

    // Integra a velocidade por eixo; ao bater, o eixo volta com `wallBounce`.
    _slide(w) {
        if (!this.vx && !this.vy) return 0;
        const x0 = w.dropX, y0 = w.dropY;
        if (!this._move(this.vx, 0)) this.vx *= -this.cfg.wallBounce;
        if (!this._move(0, this.vy)) this.vy *= -this.cfg.wallBounce;
        return Math.hypot(w.dropX - x0, w.dropY - y0);
    }

    _bump(w, p, nx, ny, approach) {
        if (this.bumpCooldown > 0) return;
        const cfg = this.cfg;
        this.bumpCooldown = cfg.bumpCooldown;
        w.dropT = Math.min(w.dropT, 1 - cfg.bumpPop);
        const roll = Math.sign(nx || 1) * (w.spinDir || 1);
        w.dropSpin += cfg.spinKick * roll;
        const s = cfg.bumpSound;
        this.audio?.play(s.cue, { rateMultiplier: s.rate, volumeMultiplier: s.volume });
        const r = w.discRadius * cfg.radiusScale;
        this.particleSystem?.triggerSparkBurst?.(w.dropX - nx * r, w.dropY - ny * r, 6, cfg.bumpSparks, 0.5);
        if (approach < cfg.hardBumpSpeed) return;
        const k = Math.min(cfg.kickMax, approach * cfg.kick);
        this.vx = nx * k;
        this.vy = ny * k;
        this.kickSteps = cfg.kickSteps;
        w.dropSpin += cfg.spinKick * 2 * roll;
        this.renderer?.triggerShake(cfg.hardBumpShake);
    }
}
