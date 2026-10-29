import { Weapon } from './Weapon.js';

const SAW_FRAME = { size: 16, cols: 4 };
const ROW_INERTIA_CLEAN = 0;
const ROW_INERTIA_BLOODY = 1;
const ROW_SPIN_CLEAN = 2;
const ROW_SPIN_BLOODY = 3;

const SAW_DRAW_LARGE = SAW_FRAME.size * 4.025;
const SAW_DRAW_SMALL = SAW_FRAME.size * 2;

const CABLE_LINK_WORLD_H = 16;
const CABLE_DRAG_GAIN = 7;
const CABLE_DRAG_MAX = 46;

const BLOOD_DURATION = 90;

const SPIN_ACCEL = 0.045;
const SPIN_DECEL = 0.012;

const BLEND_LO = 0.35;
const BLEND_HI = 0.6;

const SPIN_MAX_ROTATION = 0.45;

const INERTIA_FRAME = SAW_FRAME.cols - 1;

const SHAKE_SPIN = 4;
const SHAKE_TRANSITION = 3;

const RECONNECT_FRAMES = 42;
const RECONNECT_GROW_END = 0.2;
const RECONNECT_SCALE = 0.5;
const RECONNECT_BLINKS = 3;

const easeOutCubic = (k) => 1 - Math.pow(1 - k, 3);

const easeOutBack = (k) => {
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
};

export class SawWeapon extends Weapon {
    constructor(sprite = null, cableSprite = null) {
        super("SERRAS", 14);
        this.sprite = sprite;
        this.cableSprite = cableSprite;
        this.bloodTimer = 0;
        this.onBlood = false;
        this.spin = 0;
        this.rotation = 0;
        this.wasSpinning = false;
        this.spinKick = 0;
        this.strain = 0;
        this.flashPhase = 0;
        this._flashCanvas = null;
        this.textureOffset = 0;
        this.dragX = 0;
        this.dragY = 0;

        this.dropped = false;
        this.dropX = 0;
        this.dropY = 0;
        this.dropPhase = 0;
        this.dropSpin = 0;
        this.sweepPhase = 0;
        this.dropT = 0;
        this.dropHover = 0;

        this.reconnectTimer = 0;
        this.reconnectScale = RECONNECT_SCALE;

        // Melhorias da forja (aplicadas pelo Game): tamanho do disco e Serra dupla.
        this.sizeScale = 1;
        this.doubleSaw = false;
        this.splitAt = 0.85;
        this.mergeAt = 0.7;
        this.splitSteps = 12;
        this.stretch = 0;
        this.split = 0;
        this._splitTarget = 0;
        this.justSplit = false;
        this.justMerged = false;
    }

    // `scale` = quanto o disco cresce no pulo da reconexão (a primeira, depois da forja, é maior).
    playReconnect(scale = RECONNECT_SCALE) {
        this.reconnectTimer = RECONNECT_FRAMES;
        this.reconnectScale = scale;
    }

    get _reconnectT() {
        return 1 - this.reconnectTimer / RECONNECT_FRAMES;
    }

    get _reconnectScale() {
        if (this.reconnectTimer <= 0) return 1;
        const t = this._reconnectT;
        if (t < RECONNECT_GROW_END) {
            return 1 + this.reconnectScale * easeOutCubic(t / RECONNECT_GROW_END);
        }
        const k = (t - RECONNECT_GROW_END) / (1 - RECONNECT_GROW_END);
        return 1 + this.reconnectScale * (1 - easeOutBack(k));
    }

    get _reconnectFlash() {
        if (this.reconnectTimer <= 0) return 0;
        const t = this._reconnectT;
        const osc = 0.5 + 0.5 * Math.cos(t * Math.PI * 2 * RECONNECT_BLINKS);
        return osc * Math.pow(1 - t, 1.5);
    }

    drop(x, y) {
        this.dropped = true;
        this.dropX = x;
        this.dropY = y;
        this.dropPhase = 0;
        this.sweepPhase = 0;
        this.dropT = 0;

        this.dropSpin = this.spin;
    }

    pickup() {
        this.thrown = false;
        this.dropped = false;
    }

    updateDropped() {
        if (!this.dropped) return;
        this.dropPhase += 0.07;
        this.sweepPhase += 0.03;
        this.dropSpin *= 0.94;
        this.rotation += this.dropSpin * 0.25;
        if (this.dropT < 1) this.dropT = Math.min(1, this.dropT + 0.06);
        this.dropHover = (Math.sin(this.dropPhase) + 1) / 2;
    }

    update(p1 = null, p2 = null) {

        if (this.onBlood) this.bloodTimer = BLOOD_DURATION;
        else if (this.bloodTimer > 0) this.bloodTimer--;

        if (this.dropped) {

            this.spin += (0 - this.spin) * SPIN_DECEL;
            this.split = 0;
            this._splitTarget = 0;
            this.justSplit = this.justMerged = false;
            return;
        }
        this._updateSplit();

        if (this.reconnectTimer > 0) this.reconnectTimer--;

        this.flashPhase += 0.15 + this.strain * 0.6;

        let target = 0;
        if (p1 && p2) {
            const speed = p1.speed || p2.speed || 4.2;
            const mag = Math.min(p1.speedMag ?? 0, p2.speedMag ?? 0);
            target = Math.max(0, Math.min(1, mag / speed));
        }

        if (p1 && p2) {
            const vx = (p1.vx + p2.vx) / 2;
            const vy = (p1.vy + p2.vy) / 2;

            let tx = -vx * CABLE_DRAG_GAIN;
            let ty = -vy * CABLE_DRAG_GAIN;
            const m = Math.hypot(tx, ty);
            if (m > CABLE_DRAG_MAX) { tx = tx / m * CABLE_DRAG_MAX; ty = ty / m * CABLE_DRAG_MAX; }
            this.dragX += (tx - this.dragX) * 0.1;
            this.dragY += (ty - this.dragY) * 0.1;
        } else {
            this.dragX *= 0.9;
            this.dragY *= 0.9;
        }

        this.textureOffset += this.spin * 1.2;

        const lerp = target > this.spin ? SPIN_ACCEL : SPIN_DECEL;
        this.spin += (target - this.spin) * lerp;

        const s = Math.max(0, Math.min(1, this.spin));
        const eased = s * s * (3 - 2 * s);
        this.rotation += eased * SPIN_MAX_ROTATION;

        const spinningNow = this.spin > BLEND_HI;
        if (spinningNow && !this.wasSpinning) this.spinKick = 1;
        this.wasSpinning = spinningNow;
        if (this.spinKick > 0) this.spinKick = Math.max(0, this.spinKick - 0.08);
    }

    onHit() {
        this.bloodTimer = BLOOD_DURATION;
    }

    setOnBlood(flag) {
        this.onBlood = !!flag;
    }

    setStrain(level) {
        this.strain = Math.max(0, Math.min(1, level || 0));
    }

    get spinSpeed() {
        return this.spin;
    }

    get isHighSpeed() {
        return this.spin > BLEND_HI;
    }

    get discRadius() {
        return SAW_DRAW_LARGE * this.sizeScale / 2;
    }

    // Esticado (distância / ruptura) vindo do Chain; com a Serra dupla, acima de `splitAt` o disco se divide.
    setStretch(k) {
        this.stretch = k || 0;
    }

    _updateSplit() {
        const was = this.split;
        if (!this.doubleSaw) this._splitTarget = 0;
        else if (this.stretch >= this.splitAt) this._splitTarget = 1;
        else if (this.stretch <= this.mergeAt) this._splitTarget = 0;
        const step = 1 / Math.max(1, this.splitSteps);
        this.split = this._splitTarget > this.split ? Math.min(1, this.split + step) : Math.max(0, this.split - step);
        this.justSplit = was === 0 && this.split > 0;
        this.justMerged = was > 0 && this.split === 0;
    }

    get collisionRadius() {
        return this.discRadius * 0.5;
    }

    get isBloody() {
        return this.bloodTimer > 0;
    }

    get spinDir() {
        return -1;
    }

    cablePoint(p1, p2, t) {
        const bx = p1.x + (p2.x - p1.x) * t;
        const by = p1.y + (p2.y - p1.y) * t;
        const bulge = 4 * t * (1 - t);
        return { x: bx + this.dragX * bulge, y: by + this.dragY * bulge };
    }

    getSawPositions(p1, p2) {
        if (this.split > 0) {
            const k = this.split * this.split * (3 - 2 * this.split);
            return [0.5 - k / 6, 0.5 + k / 6].map(t => {
                const q = this.cablePoint(p1, p2, t);
                return { x: q.x, y: q.y, radius: 14 };
            });
        }
        const mid = this.cablePoint(p1, p2, 0.5);
        return [{ x: mid.x, y: mid.y, radius: 14 }];
    }

    hitsTarget(target, p1, p2) {
        return this.getSawPositions(p1, p2).some(saw =>
            Math.hypot(target.x - saw.x, target.y - saw.y) < saw.radius + (target.hitRadius ?? 0)
        );
    }

    drawChain(ctx, p1, p2) {
        const cable = this.cableSprite;
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;

        if (!cable || !cable.complete || !cable.naturalWidth) {
            ctx.save();
            ctx.strokeStyle = "#1a1a1e";
            ctx.lineWidth = 4;
            ctx.beginPath();
            const start = this.cablePoint(p1, p2, 0);
            ctx.moveTo(start.x, start.y);
            for (let i = 1; i <= 16; i++) {
                const q = this.cablePoint(p1, p2, i / 16);
                ctx.lineTo(q.x, q.y);
            }
            ctx.stroke();
            ctx.restore();
            return;
        }

        const linkH = CABLE_LINK_WORLD_H;
        const scale = linkH / cable.naturalHeight;

        const tileW = cable.naturalWidth * scale;

        const SUB = 48;
        const drawW = (Math.hypot(p2.x - p1.x, p2.y - p1.y) + Math.hypot(this.dragX, this.dragY) * 2) / SUB + 1;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        let prev = this.cablePoint(p1, p2, 0);
        let u = this.textureOffset % tileW;
        for (let i = 1; i <= SUB; i++) {
            const cur = this.cablePoint(p1, p2, i / SUB);
            const segLen = Math.hypot(cur.x - prev.x, cur.y - prev.y);
            const mx = (prev.x + cur.x) / 2;
            const my = (prev.y + cur.y) / 2;
            const ang = Math.atan2(cur.y - prev.y, cur.x - prev.x);

            const su = ((u % tileW) / tileW) * cable.naturalWidth;
            const sw = (segLen / tileW) * cable.naturalWidth;

            ctx.save();
            ctx.translate(mx, my);
            ctx.rotate(ang);
            if (su + sw <= cable.naturalWidth) {
                ctx.drawImage(cable, su, 0, sw, cable.naturalHeight,
                    -segLen / 2 - 0.5, -linkH / 2, segLen + 1, linkH);
            } else {

                const sw1 = cable.naturalWidth - su;
                const frac = sw1 / sw;
                const w1 = (segLen + 1) * frac;
                ctx.drawImage(cable, su, 0, sw1, cable.naturalHeight,
                    -segLen / 2 - 0.5, -linkH / 2, w1, linkH);
                ctx.drawImage(cable, 0, 0, sw - sw1, cable.naturalHeight,
                    -segLen / 2 - 0.5 + w1, -linkH / 2, (segLen + 1) - w1, linkH);
            }
            ctx.restore();

            u += segLen;
            prev = cur;
        }
        ctx.restore();
    }

    draw(ctx, p1, p2) {
        ctx.save();

        const sprite = this.sprite;
        const spriteReady = sprite && sprite.complete && sprite.naturalWidth > 0;

        const prevSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;

        const bloody = this.bloodTimer > 0;
        const inertiaRow = (bloody ? ROW_INERTIA_BLOODY : ROW_INERTIA_CLEAN) * SAW_FRAME.size;
        const spinRow = (bloody ? ROW_SPIN_BLOODY : ROW_SPIN_CLEAN) * SAW_FRAME.size;

        const bt = Math.max(0, Math.min(1, (this.spin - BLEND_LO) / (BLEND_HI - BLEND_LO)));
        const blend = bt * bt * (3 - 2 * bt);

        const spinning = this.spin > BLEND_LO;
        const transPulse = blend * (1 - blend) * 4;

        const strainShake = this.strain * this.strain * 3.5;
        const shake = (spinning ? SHAKE_SPIN : 0) + SHAKE_TRANSITION * transPulse + strainShake;

        let flash = 0;
        if (this.strain > 0.02) {
            const osc = 0.5 + 0.5 * Math.sin(this.flashPhase);
            const env = this.strain * this.strain;

            flash = Math.min(1, osc * env * 1.4 + env * env * 0.6);
        }

        flash = Math.max(flash, this._reconnectFlash);

        const popScale = (1 + 0.22 * this.spinKick) * this._reconnectScale;

        const whiteTint = (sx, sy) => {
            const S = SAW_FRAME.size;
            if (!this._flashCanvas) {
                this._flashCanvas = document.createElement("canvas");
                this._flashCanvas.width = S;
                this._flashCanvas.height = S;
            }
            const fc = this._flashCanvas;
            const fx = fc.getContext("2d");
            fx.imageSmoothingEnabled = false;
            fx.clearRect(0, 0, S, S);
            fx.globalCompositeOperation = "source-over";
            fx.drawImage(sprite, sx, sy, S, S, 0, 0, S, S);

            fx.globalCompositeOperation = "source-atop";
            fx.fillStyle = "#ffffff";
            fx.fillRect(0, 0, S, S);
            fx.globalCompositeOperation = "source-over";
            return fc;
        };

        const drawDisc = (x, y, draw, dir, sx, sy, alpha) => {
            const jx = (Math.random() - 0.5) * 2 * shake;
            const jy = (Math.random() - 0.5) * 2 * shake;
            const sz = draw * popScale;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(x + jx, y + jy);
            ctx.rotate(this.rotation * dir);
            ctx.drawImage(sprite, sx, sy, SAW_FRAME.size, SAW_FRAME.size, -sz / 2, -sz / 2, sz, sz);

            if (flash > 0) {
                ctx.globalAlpha = alpha * flash;
                ctx.drawImage(whiteTint(sx, sy), -sz / 2, -sz / 2, sz, sz);
            }
            ctx.restore();
        };

        const inertiaSx = INERTIA_FRAME * SAW_FRAME.size;
        const spinSx = 0;

        this.getSawPositions(p1, p2).forEach(({ x, y, radius }, index) => {
            const dir = index % 2 === 1 ? 1 : -1;
            const draw = (radius >= 14 ? SAW_DRAW_LARGE : SAW_DRAW_SMALL) * this.sizeScale;

            if (flash > 0.01) {
                ctx.save();
                ctx.globalCompositeOperation = "lighter";
                ctx.globalAlpha = flash * 0.7;
                ctx.shadowColor = "#eaf2ff";
                ctx.shadowBlur = 8 * flash;
                ctx.fillStyle = "#eaf2ff";
                ctx.beginPath();
                ctx.arc(x, y, draw * 0.28 * popScale, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                ctx.globalAlpha = 1;
            }

            if (spriteReady) {

                if (blend <= 0) {
                    drawDisc(x, y, draw, dir, inertiaSx, inertiaRow, 1);
                } else if (blend >= 1) {
                    drawDisc(x, y, draw, dir, spinSx, spinRow, 1);
                } else {
                    drawDisc(x, y, draw, dir, inertiaSx, inertiaRow, 1 - blend);
                    drawDisc(x, y, draw, dir, spinSx, spinRow, blend);
                }
                ctx.globalAlpha = 1;
            } else {

                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(this.rotation * dir);
                ctx.fillStyle = bloody ? "#9a2638" : "#c8ccd4";
                ctx.beginPath();
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                    ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
                    ctx.lineTo(Math.cos(a + 0.3) * (radius * 0.5), Math.sin(a + 0.3) * (radius * 0.5));
                }
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = "#2b2d42";
                ctx.lineWidth = 1.5;
                ctx.stroke();
                ctx.restore();
            }
        });

        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = prevSmoothing;
        ctx.restore();
    }

    // Disco solto em (x, y) para cinemáticas; `sx`/`sy` escalam a partir da base (squash), `glow` 0..1.
    drawAt(ctx, x, y, { rotation = 0, sx = 1, sy = 1, glow = 0 } = {}) {
        const sprite = this.sprite;
        const size = SAW_DRAW_LARGE * this.sizeScale;
        ctx.save();
        if (glow > 0) {
            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = glow * 0.7;
            ctx.fillStyle = "#cfe4ff";
            ctx.beginPath();
            ctx.arc(x, y, size * (0.4 + glow * 0.35), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        ctx.imageSmoothingEnabled = false;
        ctx.translate(x, y + size / 2);
        ctx.scale(sx, sy);
        ctx.translate(0, -size / 2);
        ctx.rotate(rotation);
        if (sprite?.complete && sprite.naturalWidth > 0) {
            ctx.drawImage(sprite, INERTIA_FRAME * SAW_FRAME.size, ROW_INERTIA_CLEAN * SAW_FRAME.size, SAW_FRAME.size, SAW_FRAME.size, -size / 2, -size / 2, size, size);
        } else {
            ctx.fillStyle = "#c8ccd4";
            ctx.beginPath();
            ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    drawDropped(ctx) {
        if (!this.dropped) return;

        const sprite = this.sprite;
        const spriteReady = sprite && sprite.complete && sprite.naturalWidth > 0;

        const prevSmoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;

        const draw = SAW_DRAW_LARGE * this.sizeScale;
        const bloody = this.bloodTimer > 0;

        const row = (bloody ? ROW_INERTIA_BLOODY : ROW_INERTIA_CLEAN) * SAW_FRAME.size;
        const sx = INERTIA_FRAME * SAW_FRAME.size;

        const bob = Math.sin(this.dropPhase) * 5;
        const hover = (Math.sin(this.dropPhase) + 1) / 2;

        const settle = 1 + (1 - this.dropT) * 0.25;

        const cx = this.dropX;
        const cy = this.dropY;

        ctx.save();
        const shadowScale = 1 - hover * 0.22;
        const shadowAlpha = 0.38 - hover * 0.14;
        ctx.globalAlpha = Math.max(0, shadowAlpha);
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.ellipse(cx, cy + draw * 0.34, draw * 0.34 * shadowScale, draw * 0.13 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.18 + hover * 0.12;
        ctx.shadowColor = "#cfe4ff";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#9fc4ff";
        ctx.beginPath();
        ctx.arc(cx, cy - bob, draw * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        const ly = cy - bob;
        const sz = draw * settle;

        if (spriteReady) {
            ctx.save();
            ctx.translate(cx, ly);
            ctx.rotate(this.rotation * this.spinDir);
            ctx.drawImage(sprite, sx, row, SAW_FRAME.size, SAW_FRAME.size, -sz / 2, -sz / 2, sz, sz);
            ctx.restore();

            ctx.save();
            ctx.globalCompositeOperation = "lighter";
            ctx.translate(cx, ly);

            const beam = this._buildBeam(sx, row);
            if (beam) ctx.drawImage(beam, -sz / 2, -sz / 2, sz, sz);
            ctx.restore();
        }

        ctx.globalAlpha = 1;
        ctx.imageSmoothingEnabled = prevSmoothing;
    }

    _buildBeam(sx, sy) {
        const sprite = this.sprite;
        if (!sprite || !sprite.complete || !sprite.naturalWidth) return null;

        const S = SAW_FRAME.size;
        if (!this._beamCanvas) {
            this._beamCanvas = document.createElement("canvas");
            this._beamCanvas.width = S;
            this._beamCanvas.height = S;
        }
        const bc = this._beamCanvas;
        const bx = bc.getContext("2d");
        bx.imageSmoothingEnabled = false;
        bx.clearRect(0, 0, S, S);

        const p = (Math.sin(this.sweepPhase) + 1) / 2;
        const travel = -S + p * (2.2 * S);

        const dx = travel, dy = travel;
        const grad = bx.createLinearGradient(dx - S * 0.5, dy - S * 0.5, dx + S * 0.5, dy + S * 0.5);
        grad.addColorStop(0.0, "rgba(255,255,255,0)");
        grad.addColorStop(0.42, "rgba(255,255,255,0)");
        grad.addColorStop(0.5, "rgba(255,255,255,0.85)");
        grad.addColorStop(0.58, "rgba(255,255,255,0)");
        grad.addColorStop(1.0, "rgba(255,255,255,0)");
        bx.fillStyle = grad;
        bx.fillRect(0, 0, S, S);

        bx.globalCompositeOperation = "destination-in";
        bx.drawImage(sprite, sx, sy, S, S, 0, 0, S, S);
        bx.globalCompositeOperation = "source-over";
        return bc;
    }
}
