import { SAW_CONTACT } from '../../config/SawWeaponConfig.js';
import { FORGE } from '../../config/ForgeConfig.js';

const CABLE_DRAG_GAIN = 7;
const CABLE_DRAG_MAX = 46;
const SPIN_ACCEL = 0.045;
const SPIN_DECEL = 0.012;
const BLEND_HI = 0.6;
const SPIN_MAX_ROTATION = 0.45;
const RECONNECT_FRAMES = 42;
const RECONNECT_SCALE = 0.5;

/**
 * SawModel - Engine-agnostic saw dynamics simulation.
 * Extracted from SawWeapon.js.
 * Zero browser or Canvas dependencies. Directly portable to C# class SawModel.
 */
export class SawModel {
    constructor() {
        this.radius = 14;
        this.discRadius = 14;
        this.spin = 0;
        this._cuttingSteps = 0;
        this.rotation = 0;
        this.wasSpinning = false;
        this.spinKick = 0;
        this.strain = 0;
        this.stretch = 0;
        this.dragX = 0;
        this.dragY = 0;
        this._sawPosPool = [{ x: 0, y: 0, radius: this.discRadius }, { x: 0, y: 0, radius: this.discRadius }];
        this._singleSawArray = [this._sawPosPool[0]];
        this._doubleSawArray = [this._sawPosPool[0], this._sawPosPool[1]];

        this.dropped = false;
        this.inertiaSteps = 0;
        this.inertiaLeft = 0;
        this.dropX = 0;
        this.dropY = 0;
        this.dropSpin = 0;
        this.dropPhase = 0;
        this.sweepPhase = 0;
        this.dropT = 0;
        this.dropHover = 0;

        this.reconnectTimer = 0;
        this.reconnectScale = RECONNECT_SCALE;

        this.sizeScale = 1;
        this.doubleSaw = false;
        this.splitAt = 0.85;
        this.mergeAt = 0.7;
        this.splitSteps = 12;
        this.split = 0;
        this._splitTarget = 0;
        this.justSplit = false;
        this.justMerged = false;
    }

    get spinningLoose() {
        return this.dropped && this.inertiaLeft > 0;
    }

    drop(x, y, { inertia = true } = {}) {
        this._cuttingSteps = 0;
        this.dropped = true;
        this.dropX = x;
        this.dropY = y;
        this.dropPhase = 0;
        this.sweepPhase = 0;
        this.dropT = 0;

        this.inertiaLeft = inertia ? this.inertiaSteps : 0;
        if (this.inertiaLeft > 0) this.spin = Math.max(this.spin, FORGE?.inertia?.minSpin ?? 0.6);
        this.dropSpin = this.spin;
    }

    pickup() {
        this.inertiaLeft = 0;
        this._cuttingSteps = 0;
        this.dropped = false;
        this.split = 0;
        this._splitTarget = 0;
        this.justSplit = false;
        this.justMerged = false;
        this.reconnectTimer = RECONNECT_FRAMES;
        this.reconnectScale = RECONNECT_SCALE;
    }

    setStrain(level) {
        this.strain = level;
    }

    setStretch(val) {
        this.stretch = val;
    }

    onHit() {
        if (this.spin >= (SAW_CONTACT?.activationSpin ?? 0.25)) {
            this._cuttingSteps = SAW_CONTACT?.holdSteps ?? 12;
        }
    }

    cablePoint(p1, p2, t) {
        const bx = p1.x + (p2.x - p1.x) * t;
        const by = p1.y + (p2.y - p1.y) * t;
        const bulge = 4 * t * (1 - t);
        return { x: bx + this.dragX * bulge, y: by + this.dragY * bulge };
    }

    getSawPositions(p1, p2) {
        if (!this._sawPosPool) {
            this._sawPosPool = [{ x: 0, y: 0, radius: this.discRadius }, { x: 0, y: 0, radius: this.discRadius }];
            this._singleSawArray = [this._sawPosPool[0]];
            this._doubleSawArray = [this._sawPosPool[0], this._sawPosPool[1]];
        }
        if (this.dropped) {
            const s0 = this._sawPosPool[0];
            s0.x = this.dropX;
            s0.y = this.dropY;
            s0.radius = this.discRadius;
            return this._singleSawArray;
        }
        if (!p1 || !p2) {
            const s0 = this._sawPosPool[0];
            s0.x = 0;
            s0.y = 0;
            s0.radius = this.discRadius;
            return this._singleSawArray;
        }
        if (this.split > 0) {
            const k = this.split * this.split * (3 - 2 * this.split);
            const t0 = 0.5 - k / 6;
            const t1 = 0.5 + k / 6;
            const b0 = 4 * t0 * (1 - t0);
            const b1 = 4 * t1 * (1 - t1);
            const s0 = this._sawPosPool[0];
            const s1 = this._sawPosPool[1];
            s0.x = p1.x + (p2.x - p1.x) * t0 + this.dragX * b0;
            s0.y = p1.y + (p2.y - p1.y) * t0 + this.dragY * b0;
            s0.radius = this.discRadius;
            s1.x = p1.x + (p2.x - p1.x) * t1 + this.dragX * b1;
            s1.y = p1.y + (p2.y - p1.y) * t1 + this.dragY * b1;
            s1.radius = this.discRadius;
            return this._doubleSawArray;
        }
        const t = 0.5;
        const b = 4 * t * (1 - t);
        const s0 = this._sawPosPool[0];
        s0.x = p1.x + (p2.x - p1.x) * t + this.dragX * b;
        s0.y = p1.y + (p2.y - p1.y) * t + this.dragY * b;
        s0.radius = this.discRadius;
        return this._singleSawArray;
    }

    _updateSplit() {
        this.justSplit = false;
        this.justMerged = false;
        if (!this.doubleSaw) {
            this.split = 0;
            this._splitTarget = 0;
            return;
        }
        if (this._splitTarget === 0 && this.stretch >= this.splitAt) {
            this._splitTarget = 1;
        } else if (this._splitTarget === 1 && this.stretch <= this.mergeAt) {
            this._splitTarget = 0;
        }

        const step = 1 / Math.max(1, this.splitSteps);
        if (this.split < this._splitTarget) {
            this.split = Math.min(this._splitTarget, this.split + step);
            if (this.split >= 1) this.justSplit = true;
        } else if (this.split > this._splitTarget) {
            this.split = Math.max(this._splitTarget, this.split - step);
            if (this.split <= 0) this.justMerged = true;
        }
    }

    updateDropped() {
        if (!this.dropped) return;
        this.dropPhase += 0.07;
        this.sweepPhase += 0.03;
        if (this.inertiaLeft > 0) {
            this.dropSpin = this.spin;
            const spinToRot = FORGE?.inertia?.spinToRotation ?? 0.35;
            this.rotation += this.spin * spinToRot;
        } else {
            this.dropSpin *= 0.94;
            this.rotation += this.dropSpin * 0.25;
        }
        if (this.dropT < 1) this.dropT = Math.min(1, this.dropT + 0.06);
        this.dropHover = (Math.sin(this.dropPhase) + 1) / 2;
    }

    update(p1 = null, p2 = null) {
        if (this.dropped) {
            if (this.inertiaLeft > 0) this.inertiaLeft--;
            else this.spin += (0 - this.spin) * SPIN_DECEL;
            this.split = 0;
            this._splitTarget = 0;
            this.justSplit = false;
            this.justMerged = false;
            return;
        }

        this._updateSplit();

        if (this.reconnectTimer > 0) this.reconnectTimer--;

        let target = 0;
        if (p1 && p2) {
            const speed = p1.speed || p2.speed || 4.2;
            const mag = Math.min(p1.speedMag ?? 0, p2.speedMag ?? 0);
            target = Math.max(0, Math.min(1, mag / speed));
        }

        if (this._cuttingSteps > 0) {
            this._cuttingSteps--;
            const minSpin = SAW_CONTACT?.minimumSpin ?? 0.45;
            target = Math.max(target, minSpin);
            this.spin = Math.max(this.spin, minSpin);
        }

        if (p1 && p2) {
            const vx = (p1.vx + p2.vx) / 2;
            const vy = (p1.vy + p2.vy) / 2;
            let tx = -vx * CABLE_DRAG_GAIN;
            let ty = -vy * CABLE_DRAG_GAIN;
            const m = Math.hypot(tx, ty);
            if (m > CABLE_DRAG_MAX) {
                tx = (tx / m) * CABLE_DRAG_MAX;
                ty = (ty / m) * CABLE_DRAG_MAX;
            }
            this.dragX += (tx - this.dragX) * 0.1;
            this.dragY += (ty - this.dragY) * 0.1;
        } else {
            this.dragX *= 0.9;
            this.dragY *= 0.9;
        }

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

    getRenderState(p1 = null, p2 = null) {
        const positions = this.getSawPositions(p1, p2);
        const primary = positions[0] || { x: 0, y: 0 };
        return {
            x: this.dropped ? this.dropX : primary.x,
            y: this.dropped ? this.dropY : primary.y,
            positions,
            rotation: this.rotation,
            spin: this.spin,
            dropped: this.dropped,
            radius: this.discRadius,
            doubleSaw: this.doubleSaw,
            split: this.split
        };
    }
}
