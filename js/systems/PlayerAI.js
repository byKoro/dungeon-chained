export class PlayerAI {

    constructor({ input, getP1, getP2, getRoom, isHoleAt, getDoors, controls = ["w", "s", "a", "d"] }) {
        this.input = input;
        this.getP1 = getP1;
        this.getP2 = getP2;
        this.getRoom = getRoom;
        this.isHoleAt = isHoleAt || (() => false);
        this.getDoors = getDoors || (() => []);
        this.controls = controls;

        this.enabled = false;

        this.orbitDir = 1;
        this.orbitFlipTimer = 0;
        this.orbitFlipEvery = 90;

        this.followDistance = 70;

        this.doorApproachRange = 170;

        this.lookAhead = 26;

        this.avoidAngles = [25, -25, 50, -50, 75, -75, 100, -100, 130, -130, 160, -160];

        if (typeof window !== "undefined") {
            window.addEventListener("keydown", (e) => {
                if (e.key.toLowerCase() === "i" && !e.repeat) this.toggle();
            });
            window.playerAI = this;
        }
    }

    enable() { this.enabled = true; this._log(); }
    disable() { this.enabled = false; this._log(); }
    toggle() { this.enabled = !this.enabled; this._log(); }

    _log() {
        if (typeof console !== "undefined") {
            console.log(`[PlayerAI] IA do P1 ${this.enabled ? "LIGADA" : "DESLIGADA"}`);
        }
    }

    update() {
        if (!this.enabled) return;

        const p1 = this.getP1?.();
        const p2 = this.getP2?.();
        if (!p1) return;

        if (this.orbitFlipTimer-- <= 0) {
            this.orbitDir *= -1;
            this.orbitFlipTimer = this.orbitFlipEvery;
        }

        let dir = this._combatDir(p1, p2);
        if (!dir) dir = this._doorDir(p1, p2);
        if (!dir) dir = this._followDir(p1, p2);

        const [up, down, left, right] = this.controls;
        const keys = this.input.keys;
        keys.delete(up); keys.delete(down); keys.delete(left); keys.delete(right);

        if (!dir || (dir.x === 0 && dir.y === 0)) return;

        const safe = this._avoidHoles(p1, dir.x, dir.y);
        if (!safe) return;

        const dead = 0.33;
        if (safe.y < -dead) keys.add(up);
        else if (safe.y > dead) keys.add(down);
        if (safe.x < -dead) keys.add(left);
        else if (safe.x > dead) keys.add(right);
    }

    _combatDir(p1, p2) {
        const enemy = this._nearestEnemy(p1);
        if (!enemy) return null;

        let desiredX, desiredY;
        if (p2) {
            const ex = enemy.x - p2.x;
            const ey = enemy.y - p2.y;
            const em = Math.hypot(ex, ey) || 1;

            desiredX = enemy.x + (ex / em) * 60;
            desiredY = enemy.y + (ey / em) * 60;
        } else {
            desiredX = enemy.x;
            desiredY = enemy.y;
        }

        let dx = desiredX - p1.x;
        let dy = desiredY - p1.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 24) {
            const ox = p1.x - enemy.x;
            const oy = p1.y - enemy.y;
            const om = Math.hypot(ox, oy) || 1;

            const tx = -oy / om * this.orbitDir;
            const ty = ox / om * this.orbitDir;
            return { x: tx, y: ty };
        }

        return { x: dx / dist, y: dy / dist };
    }

    _doorDir(p1, p2) {
        if (!p2) return null;
        const doors = this.getDoors?.() || [];
        if (!doors.length) return null;

        let best = null, bestD = Infinity;
        for (const d of doors) {
            const dd = Math.hypot(d.x - p2.x, d.y - p2.y);
            if (dd < bestD) { bestD = dd; best = d; }
        }
        if (!best || bestD > this.doorApproachRange) return null;

        const off = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[best.dir] || [0, 0];
        const tx = best.x + off[0] * 40;
        const ty = best.y + off[1] * 40;
        let dx = tx - p1.x, dy = ty - p1.y;
        const m = Math.hypot(dx, dy) || 1;
        return { x: dx / m, y: dy / m };
    }

    _followDir(p1, p2) {
        if (!p2) return null;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        if (dist < this.followDistance) return { x: 0, y: 0 };
        return { x: dx / dist, y: dy / dist };
    }

    _nearestEnemy(p1) {
        const room = this.getRoom?.();
        const enemies = room?.enemies || [];
        let nearest = null, nd = Infinity;
        for (const e of enemies) {
            if (e.state === "dying" || e.isHidden) continue;
            const d = Math.hypot(e.x - p1.x, e.y - p1.y);
            if (d < nd) { nd = d; nearest = e; }
        }
        return nearest;
    }

    _avoidHoles(p1, dx, dy) {
        if (!this.isHoleAt) return { x: dx, y: dy };

        const clear = (ang) => {
            const nx = Math.cos(ang), ny = Math.sin(ang);
            const probeX = p1.x + nx * this.lookAhead;
            const probeY = p1.y + ny * this.lookAhead;
            return !this.isHoleAt(probeX, probeY);
        };

        const base = Math.atan2(dy, dx);
        if (clear(base)) return { x: dx, y: dy };

        for (const deg of this.avoidAngles) {
            const ang = base + (deg * Math.PI) / 180;
            if (clear(ang)) return { x: Math.cos(ang), y: Math.sin(ang) };
        }
        return null;
    }
}
