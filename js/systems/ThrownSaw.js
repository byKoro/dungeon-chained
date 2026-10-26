import { DEMO } from '../config/DemoConfig.js';
import { Physics } from '../core/Physics.js';

export class ThrownSaw {
    constructor({ getWeapon, getRoom, safeDrop }) {
        Object.assign(this, { getWeapon, getRoom, safeDrop });
        this.aim = { x: 1, y: 0 };
    }

    aimFrom(players) {
        const x = players.reduce((n, p) => n + p.vx, 0), y = players.reduce((n, p) => n + p.vy, 0);
        const length = Math.hypot(x, y);
        if (length > 0.5) this.aim = { x: x / length, y: y / length };
    }

    launch() {
        const w = this.getWeapon();
        if (!w.dropped) return;
        w.thrown = true;
        w.throwVX = this.aim.x * DEMO.throwSpeed; w.throwVY = this.aim.y * DEMO.throwSpeed;
        w.prevX = w.dropX; w.prevY = w.dropY;
        this.hit = new Set();
    }

    update() {
        const w = this.getWeapon();
        if (!w.dropped) { w.thrown = false; return; }
        if (!w.thrown) return;
        const room = this.getRoom(), b = room.bounds, radius = w.discRadius || 20;
        w.prevX = w.dropX; w.prevY = w.dropY;
        const collides = (x, y) => x < b.minX + radius || x > b.maxX - radius || y < b.minY + radius || y > b.maxY - radius
            || room.wallBoxes.some(box => x + radius > box.x && x - radius < box.x + box.w && y + radius > box.y && y - radius < box.y + box.h);
        const steps = Math.max(1, Math.ceil(Math.hypot(w.throwVX, w.throwVY) / 8));
        for (let i = 0; i < steps; i++) {
            if (collides(w.dropX + w.throwVX / steps, w.dropY)) w.throwVX *= -DEMO.throwBounce;
            else w.dropX += w.throwVX / steps;
            if (collides(w.dropX, w.dropY + w.throwVY / steps)) w.throwVY *= -DEMO.throwBounce;
            else w.dropY += w.throwVY / steps;
        }
        w.throwVX *= DEMO.throwFriction; w.throwVY *= DEMO.throwFriction;
        w.dropSpin = 1;
        for (const enemy of room.enemies) {
            if (enemy.state === 'dying' || this.hit?.has(enemy)) continue;
            if (Physics.distToSegment(enemy.x, enemy.y, w.prevX, w.prevY, w.dropX, w.dropY) < radius + enemy.hitRadius) {
                enemy.startDying(); this.hit?.add(enemy);
            }
        }
        if (Math.hypot(w.throwVX, w.throwVY) < DEMO.throwMinSpeed) {
            w.thrown = false;
            const p = this.safeDrop(w.dropX, w.dropY);
            w.dropX = p.x; w.dropY = p.y;
        }
    }
}
