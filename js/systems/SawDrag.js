import { SAW_DRAG } from '../config/ForgeConfig.js';

const INTERACT_KEYS = ["e", "shiftright"];

// Com o cabo arrebentado e a serra largada, um jogador sozinho segura interagir perto dela e a arrasta por um
// cabo curto: anda mais devagar, a serra não gira nem corta. Passada a distância de arrasto (melhoria Peso) o cabo
// curto arrebenta e a serra cai; para pegar de novo é preciso soltar e segurar outra vez. Se o parceiro chegar
// perto, o Chain reconecta normalmente.
export class SawDrag {
    constructor({ chain, getPlayers, input, getStats, isBlocked = () => false, getBounds = () => null, canDrag = () => true,
        audio = null, particleSystem = null, renderer = null, cfg = SAW_DRAG }) {
        Object.assign(this, { chain, getPlayers, input, getStats, isBlocked, getBounds, canDrag, audio, particleSystem, renderer, cfg });
        this.reset();
    }

    reset() {
        this.dragger = -1;
        this.traveled = 0;
        this.hold = [0, 0];
        this.needRelease = [false, false];
        this.cooldown = 0;
        this.nearby = false;
        this.justGrabbed = false;
        this.justSnapped = false;
    }

    get active() {
        return this.dragger >= 0;
    }

    isDragging(index) {
        return this.dragger === index;
    }

    speedScaleFor(index) {
        return this.dragger === index ? this.getStats().speedScale : 1;
    }

    // 0..1 = quanto do arrasto já foi usado (para o cabo curto ficar tenso perto do fim).
    get tension() {
        return this.active ? Math.min(1, this.traveled / this.getStats().limit) : 0;
    }

    _eligible() {
        const w = this.chain.weapon;
        return this.chain.hasSaw && !this.chain.isConnected && w.dropped && !w.thrown && !w.tackleState && this.canDrag();
    }

    _alive(p) {
        return p && !p.falling && p.lives > 0;
    }

    update() {
        this.justGrabbed = this.justSnapped = false;
        this.nearby = false;
        if (this.cooldown > 0) this.cooldown--;
        const players = this.getPlayers() || [];
        const down = INTERACT_KEYS.map(k => !!this.input.isDown(k));
        down.forEach((d, i) => { if (!d) this.needRelease[i] = false; });
        if (!this._eligible()) {
            this.dragger = -1;
            this.hold = [0, 0];
            return;
        }
        const w = this.chain.weapon;
        if (!this.active) {
            players.forEach((p, i) => {
                const near = this._alive(p) && Math.hypot(p.x - w.dropX, p.y - w.dropY) <= this.cfg.grabRadius;
                if (near) this.nearby = true;
                this.hold[i] = near && down[i] && !this.needRelease[i] ? this.hold[i] + 1 : 0;
                if (this.active || this.hold[i] < this.cfg.grabSteps || this.cooldown > 0) return;
                this.dragger = i;
                this.traveled = 0;
                this.justGrabbed = true;
                w.dropSpin = 0;
                this.audio?.play("sawLand", { rateMultiplier: 1.4, volumeMultiplier: 0.6 });
            });
            return;
        }

        const p = players[this.dragger];
        if (!this._alive(p) || !down[this.dragger]) { this._release(); return; }
        const dx = w.dropX - p.x, dy = w.dropY - p.y;
        const d = Math.hypot(dx, dy);
        const L = this.cfg.ropeLength;
        if (d > L) {
            const k = (d - L) / d;
            let nx = w.dropX - dx * k, ny = w.dropY - dy * k;
            const b = this.getBounds();
            if (b) {
                nx = Math.max(b.minX, Math.min(b.maxX, nx));
                ny = Math.max(b.minY, Math.min(b.maxY, ny));
            }
            if (!this.isBlocked(nx, ny)) {
                this.traveled += Math.hypot(nx - w.dropX, ny - w.dropY);
                w.dropX = nx;
                w.dropY = ny;
            } else if (d > L + this.cfg.ropeSlack) {
                this._snap();
                return;
            }
        }
        w.dropSpin = 0;
        if (this.traveled >= this.getStats().limit) this._snap();
    }

    _release() {
        this.dragger = -1;
        this.hold = [0, 0];
    }

    _snap() {
        const w = this.chain.weapon;
        this.needRelease[this.dragger] = true;
        this._release();
        this.cooldown = this.cfg.regrabSteps;
        this.justSnapped = true;
        this.audio?.play("sawSnap", { rateMultiplier: 1.35, volumeMultiplier: 0.5 });
        this.renderer?.triggerShake(this.cfg.snapShake);
        this.particleSystem?.triggerSparkBurst?.(w.dropX, w.dropY, w.discRadius ?? 24, this.cfg.snapSparks, 0.8);
    }

    get prompt() {
        return !this.active && this.nearby ? "drag.prompt" : null;
    }

    // Cabo curto da mão de quem arrasta até a serra, com uma barriga que some quando estica.
    drawRope(ctx) {
        if (!this.active) return;
        const p = this.getPlayers()?.[this.dragger];
        const w = this.chain.weapon;
        if (!p) return;
        const ax = p.x, ay = p.y + 6, bx = w.dropX, by = w.dropY;
        const taut = Math.min(1, Math.hypot(bx - ax, by - ay) / this.cfg.ropeLength);
        const sag = this.cfg.ropeSag * (1 - taut * 0.8) * (1 - this.tension * 0.6);
        const mx = (ax + bx) / 2, my = (ay + by) / 2 + sag;
        ctx.save();
        ctx.lineCap = "round";
        for (const [color, width, off] of [[this.cfg.ropeColor, this.cfg.ropeWidth, 0], [this.cfg.ropeLight, this.cfg.ropeWidth / 2, -1]]) {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.beginPath();
            ctx.moveTo(ax, ay + off);
            ctx.quadraticCurveTo(mx, my + off, bx, by + off);
            ctx.stroke();
        }
        ctx.restore();
    }
}
