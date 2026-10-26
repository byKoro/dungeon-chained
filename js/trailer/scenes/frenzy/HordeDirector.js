const GOLDEN = 2.399963;

export class HordeDirector {
    constructor(scene) {
        this.scene = scene;
        this.members = [];
        this.mode = 'enter';
        this.center = { x: 0, y: 0 };
        this.gather = { x: 0, y: 0 };
        this.radius = 95;
        this.squashY = 0.72;
        this.holdDist = 330;
        this.speed = 1.4;
        this.compact = 1;
    }

    reset(door) {
        this.members = [];
        this.mode = 'enter';
        this.door = door;
        this.center = { x: door.x + 150, y: door.y };
        this.gather = { x: door.x - 230, y: door.y };
        this.compact = 1;
    }

    setMode(mode, opts = {}) {
        this.mode = mode;
        Object.assign(this, opts);
    }

    add(e) {
        const i = this.members.length;
        e._slot = i;
        e._phase = Math.random() * Math.PI * 2;
        e._sway = 0.6 + Math.random() * 0.8;
        e.vx = e.vy = 0;
        this.members.push(e);
    }

    _slotOffset(i, n) {
        const r = this.radius * this.compact * Math.sqrt((i + 0.5) / Math.max(n, 12));
        const a = i * GOLDEN;
        return { x: Math.cos(a) * r, y: Math.sin(a) * r * this.squashY };
    }

    get alive() {
        const list = this.scene.enemies;
        return this.members.filter(e => list.includes(e) && e.state !== 'dying');
    }

    get mass() {
        const a = this.alive;
        if (!a.length) return null;
        let x = 0, y = 0;
        for (const e of a) { x += e.x; y += e.y; }
        return { x: x / a.length, y: y / a.length };
    }

    step() {
        const S = this.scene;
        const { p1, p2 } = S.host;
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        const n = Math.max(this.members.length, 1);
        const door = this.door;

        let goal = null, sp = this.speed;
        if (this.mode === 'enter') goal = this.gather;
        else if (this.mode === 'advance') {
            const dx = mid.x - this.center.x, dy = mid.y - this.center.y;
            const d = Math.hypot(dx, dy) || 1;
            const stop = Math.max(0, d - this.holdDist);
            goal = { x: this.center.x + dx / d * stop, y: this.center.y + dy / d * stop };
        } else if (this.mode === 'rush') { goal = mid; sp = 2.6; }
        if (goal) {
            const dx = goal.x - this.center.x, dy = goal.y - this.center.y;
            const d = Math.hypot(dx, dy);
            if (d > 1) {
                const s = Math.min(sp, d * 0.06);
                this.center.x += dx / d * s;
                this.center.y += dy / d * s;
            }
        }

        const t = performance.now() / 1000;
        for (const e of this.members) {
            if (!S.enemies.includes(e)) continue;
            if (e.state === 'dying') { e.update(S.targets, () => {}); continue; }

            let tx, ty, maxV;
            if (this.mode === 'swarm') {
                tx = mid.x; ty = mid.y + Math.sin(e._phase) * 30; maxV = 2.4;
            } else {
                const o = this._slotOffset(e._slot, n);
                const sw = this.mode === 'rush' ? 4 : 10;
                tx = this.center.x + o.x + Math.sin(t * 2.1 * e._sway + e._phase) * sw;
                ty = this.center.y + o.y + Math.cos(t * 1.7 * e._sway + e._phase) * sw * 0.6;
                maxV = this.mode === 'rush' ? 3.0 : 2.0;
            }
            if (e.x > door.x - 6) ty = Math.max(door.y - 44, Math.min(door.y + 44, ty));

            const dx = tx - e.x, dy = ty - e.y;
            const d = Math.hypot(dx, dy);
            const want = Math.min(maxV, d * 0.08);
            const dvx = d > 0.5 ? dx / d * want : 0, dvy = d > 0.5 ? dy / d * want : 0;
            e.vx += (dvx - e.vx) * 0.15;
            e.vy += (dvy - e.vy) * 0.15;
            e.x += e.vx + (e.pushVx || 0);
            e.y += e.vy + (e.pushVy || 0);
            e.pushVx = (e.pushVx || 0) * 0.85;
            e.pushVy = (e.pushVy || 0) * 0.85;
            e.animTime++;
            e.facingLeft = mid.x < e.x;
            e.state = 'chase';
        }
    }
}
