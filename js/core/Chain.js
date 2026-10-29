import { Physics } from './Physics.js';

export class Chain {
    constructor(weapons, config = {}) {
        this.weapons = weapons;
        this.weaponIndex = 0;

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

    // `present: false` = a dupla ainda não tem a serra: sem cabo, sem disco e sem reconexão.
    reset({ present = this.present } = {}) {
        this.present = present;
        this.connected = present;
        this.strain = 0;
        this.reconnectCooldown = 0;

        this.weapon.pickup?.();
    }

    get hasSaw() {
        return this.present;
    }

    // A serra aparece largada em (x, y); os dois precisam chegar perto para conectar.
    spawnSaw(x, y) {
        this.present = true;
        this.connected = false;
        this.strain = 0;
        this.reconnectCooldown = 0;
        this.weapon.drop?.(x, y);
    }

    get weapon() {
        return this.weapons[this.weaponIndex];
    }

    get name() {
        return this.weapon.name;
    }

    get isConnected() {
        return this.connected;
    }

    cycleWeapon() {
        this.weaponIndex = (this.weaponIndex + 1) % this.weapons.length;
        return this.weapon;
    }

    update(p1, p2, events = {}) {
        if (this.reconnectCooldown > 0) this.reconnectCooldown--;
        const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        if (this.connected) {

            Physics.applyChainConstraint(p1, p2, this.rest, this.stiffness);

            if (dist > this.strainDistance) this.strain++;
            else this.strain = Math.max(0, this.strain - 2);

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

                const sp = this.weapon.getSawPositions?.(p1, p2)?.[0];
                const rawX = sp ? sp.x : (p1.x + p2.x) / 2;
                const rawY = sp ? sp.y : (p1.y + p2.y) / 2;

                const fixed = events.resolveDropPoint?.(rawX, rawY) ?? { x: rawX, y: rawY };
                this.weapon.drop?.(fixed.x, fixed.y);

                events.onSnap?.();
            }
        } else if (this.reconnectCooldown <= 0 && this._canReconnect(p1, p2, dist)) {

            this.connected = true;
            this.weapon.pickup?.();
            events.onReconnect?.();
        }

        let strainLevel = 0;
        if (this.connected) {
            const byStrain = this.strain / this.strainLimit;
            const span = this.breakDistance - this.strainDistance;
            const byDist = span > 0 ? (dist - this.strainDistance) / span : 0;
            strainLevel = Math.max(0, Math.min(1, Math.max(byStrain, byDist)));
        }

        this.weapon.setStrain?.(strainLevel);
        this.weapon.update(p1, p2);

        if (!this.connected) this.weapon.updateDropped?.();
    }

    forceDrop(p1, p2, resolveDropPoint) {
        if (!this.connected || !this.present) return false;
        this.connected = false;
        this.strain = 0;
        this.reconnectCooldown = this.reconnectDelay;
        const sp = this.weapon.getSawPositions?.(p1, p2)?.[0];
        const rawX = sp ? sp.x : (p1.x + p2.x) / 2;
        const rawY = sp ? sp.y : (p1.y + p2.y) / 2;
        const fixed = resolveDropPoint?.(rawX, rawY) ?? { x: rawX, y: rawY };
        this.weapon.drop?.(fixed.x, fixed.y);
        return true;
    }

    _canReconnect(p1, p2, dist) {
        const w = this.weapon;
        if (!this.present || w.thrown) return false;
        if (!w.dropped) return dist < this.reconnectDistance;

        const r = this.pickupRadius;
        const d1 = Math.hypot(p1.x - w.dropX, p1.y - w.dropY);
        const d2 = Math.hypot(p2.x - w.dropX, p2.y - w.dropY);
        return d1 < r && d2 < r;
    }

    applyToEnemies(p1, p2, enemies, onHit) {
        if (!this.connected) return;

        const w = this.weapon;
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            const d = Physics.distToSegment(e.x, e.y, p1.x, p1.y, p2.x, p2.y);
            const dP1 = Math.hypot(e.x - p1.x, e.y - p1.y);
            const dP2 = Math.hypot(e.x - p2.x, e.y - p2.y);
            const nearPlayer = dP1 < this.playerSafeZone || dP2 < this.playerSafeZone;

            if (e.state !== "dying" && !nearPlayer
                && d < w.hitThreshold + e.hitRadius) {
                onHit(e);
            }
        }
    }

    drawChain(ctx, p1, p2) {
        if (this.connected) this.weapon.drawChain(ctx, p1, p2);
    }

    draw(ctx, p1, p2) {
        if (this.connected) this.weapon.draw(ctx, p1, p2);
    }

    drawDropped(ctx) {
        if (!this.connected) this.weapon.drawDropped?.(ctx);
    }

    getDroppedLight() {
        if (this.connected || !this.weapon.dropped) return null;
        return { x: this.weapon.dropX, y: this.weapon.dropY, hover: this.weapon.dropHover ?? 0 };
    }
}
