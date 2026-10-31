import { PhysicsSim } from '../math/PhysicsSim.js';

/**
 * TetherModel - Engine-agnostic cable and tether dynamics.
 * Extracted from Chain.js.
 * Zero browser or Canvas dependencies. Directly portable to C# class TetherModel.
 */
export class TetherModel {
    constructor(config = {}) {
        this.rest = config.rest ?? 130;
        this.stiffness = config.stiffness ?? 0.02;
        this.breakDistance = config.breakDistance ?? 240;
        this.strainDistance = config.strainDistance ?? 165;
        this.strainLimit = config.strainLimit ?? 30;
        this.reconnectDistance = config.reconnectDistance ?? 110;
        this.snapImpulse = config.snapImpulse ?? 12;
        this.reconnectDelay = config.reconnectDelay ?? 20;
        this.pickupRadius = config.pickupRadius ?? 60;
        this.playerSafeZone = config.playerSafeZone ?? 46;

        this.present = true;
        this.connected = true;
        this.strain = 0;
        this.reconnectCooldown = 0;
    }

    reset({ present = this.present } = {}) {
        this.present = present;
        this.connected = present;
        this.strain = 0;
        this.reconnectCooldown = 0;
    }

    update(p1, p2, sawModel, events = null, dungeonSim = null) {
        if (this.reconnectCooldown > 0) this.reconnectCooldown--;

        if (!this.present) {
            if (sawModel) sawModel.spin = 0;
            return;
        }

        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        if (this.connected) {
            PhysicsSim.applyChainConstraint(p1, p2, this.rest, this.stiffness);

            const split = (sawModel?.split ?? 0) > 0;
            if (dist > this.strainDistance) {
                if (!split) this.strain++;
            } else {
                this.strain = Math.max(0, this.strain - 2);
            }

            if (dist > this.breakDistance || this.strain >= this.strainLimit) {
                const nx = (p2.x - p1.x) / (dist || 1);
                const ny = (p2.y - p1.y) / (dist || 1);
                p1.vx -= nx * this.snapImpulse;
                p1.vy -= ny * this.snapImpulse;
                p2.vx += nx * this.snapImpulse;
                p2.vy += ny * this.snapImpulse;

                this.connected = false;
                this.strain = 0;
                this.reconnectCooldown = this.reconnectDelay;

                const positions = sawModel?.getSawPositions(p1, p2) ?? [];
                const rawX = positions.length ? positions.reduce((s, p) => s + p.x, 0) / positions.length : (p1.x + p2.x) / 2;
                const rawY = positions.length ? positions.reduce((s, p) => s + p.y, 0) / positions.length : (p1.y + p2.y) / 2;

                const fixed = dungeonSim?.safeDropPoint ? dungeonSim.safeDropPoint(rawX, rawY, [p1, p2]) : { x: rawX, y: rawY };
                sawModel?.drop(fixed.x, fixed.y);

                events?.emitSawSnapped(fixed.x, fixed.y);
                events?.emitCameraShake(12);
            }
        } else if (this.reconnectCooldown <= 0 && this._canReconnect(p1, p2, dist, sawModel)) {
            this.connected = true;
            sawModel?.pickup();
            events?.emitSawReconnected();
        }

        let strainLevel = 0;
        if (this.connected) {
            const byStrain = this.strain / this.strainLimit;
            const span = this.breakDistance - this.strainDistance;
            const byDist = span > 0 ? (dist - this.strainDistance) / span : 0;
            strainLevel = Math.max(0, Math.min(1, Math.max(byStrain, byDist)));
        }

        if (sawModel) {
            sawModel.setStrain(strainLevel);
            sawModel.setStretch(this.connected ? dist / this.breakDistance : 0);
            sawModel.update(p1, p2);
            if (!this.connected) sawModel.updateDropped();
        }
    }

    _canReconnect(p1, p2, dist, sawModel) {
        if (!this.present || !sawModel) return false;
        if (!sawModel.dropped) return dist < this.reconnectDistance;

        const r = this.pickupRadius;
        const d1 = Math.hypot(p1.x - sawModel.dropX, p1.y - sawModel.dropY);
        const d2 = Math.hypot(p2.x - sawModel.dropX, p2.y - sawModel.dropY);
        return d1 < r && d2 < r;
    }

    forceDrop(p1, p2, sawModel, events = null, dungeonSim = null) {
        if (!this.connected || !this.present) return false;
        this.connected = false;
        this.strain = 0;
        this.reconnectCooldown = this.reconnectDelay;

        const positions = sawModel?.getSawPositions(p1, p2) ?? [];
        const rawX = positions.length ? positions.reduce((s, p) => s + p.x, 0) / positions.length : (p1.x + p2.x) / 2;
        const rawY = positions.length ? positions.reduce((s, p) => s + p.y, 0) / positions.length : (p1.y + p2.y) / 2;

        const fixed = dungeonSim?.safeDropPoint ? dungeonSim.safeDropPoint(rawX, rawY, [p1, p2]) : { x: rawX, y: rawY };
        sawModel?.drop(fixed.x, fixed.y);

        events?.emitSawSnapped(fixed.x, fixed.y);
        events?.emitCameraShake(12);
        return true;
    }

    getRenderState(p1, p2, sawModel) {
        const SUB = 16;
        const points = [];
        if (this.connected && p1 && p2 && sawModel) {
            for (let i = 0; i <= SUB; i++) {
                points.push(sawModel.cablePoint(p1, p2, i / SUB));
            }
        }
        return {
            connected: this.connected,
            points,
            strain: this.strain / this.strainLimit,
            hasSaw: this.present
        };
    }
}
