import { SCRAP } from '../config/ScrapConfig.js';
import { ScrapPickup } from '../entities/ScrapPickup.js';
import { ScrapWallet } from './ScrapWallet.js';

const rand = (a, b, rng) => a + rng() * (b - a);

export class ScrapSystem {
    constructor({ audio = null, frames = [], cfg = SCRAP, rng = Math.random, now = () => performance.now() } = {}) {
        Object.assign(this, { audio, frames, cfg, rng, now });
        this.wallet = new ScrapWallet();
        this.pickups = [];
        this._streak = 0;
        this._lastPickupAt = -Infinity;
    }

    get amount() {
        return this.wallet.amount;
    }

    // `dir` (radianos) inclina o arco; sem ele a sucata se espalha em volta.
    spawnBurst(x, y, amount, { dir = null, spread = Math.PI * 2, profile = this.cfg.burst } = {}) {
        const out = [];
        for (let i = 0; i < amount; i++) {
            const a = dir === null ? this.rng() * Math.PI * 2 : dir + (this.rng() - 0.5) * spread;
            const sp = rand(profile.speedMin, profile.speedMax, this.rng);
            const p = new ScrapPickup(x, y, {
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7,
                vz: rand(profile.vzMin, profile.vzMax, this.rng), z: profile.startZ, cfg: this.cfg
            });
            this.pickups.push(p);
            out.push(p);
        }
        return out;
    }

    dropFromEnemy(enemy) {
        const amount = this.cfg.drops[enemy?.typeKey] ?? 0;
        if (amount > 0) this.spawnBurst(enemy.x, enemy.y, amount, { profile: this.cfg.enemyBurst });
        return amount;
    }

    vacuum() {
        for (const p of this.pickups) p.vacuum = true;
    }

    update(players, bounds = null) {
        let gained = 0;
        for (let i = this.pickups.length - 1; i >= 0; i--) {
            const p = this.pickups[i];
            if (!p.update(players, bounds)) continue;
            this.pickups.splice(i, 1);
            gained += p.value;
            this._playPickup();
        }
        if (gained) this.wallet.add(gained);
        return gained;
    }

    // Saída da sala: o que ficou no chão vai para o pote em vez de sumir.
    collectAll() {
        const gained = this.pickups.reduce((s, p) => s + p.value, 0);
        this.pickups = [];
        this.wallet.add(gained);
        return gained;
    }

    clear() {
        this.pickups = [];
    }

    reset() {
        this.clear();
        this.wallet.reset();
        this._streak = 0;
    }

    _playPickup() {
        if (!this.audio) return;
        const t = this.now();
        this._streak = t - this._lastPickupAt < this.cfg.pickupStreakMs ? Math.min(this._streak + 1, this.cfg.pickupStreakMax) : 0;
        this._lastPickupAt = t;
        this.audio.play("scrapPickup", { rateMultiplier: 1 + this._streak * this.cfg.pickupRateStep });
    }

    draw(ctx) {
        if (!this.pickups.length) return;
        for (const p of this.pickups) p.drawShadow(ctx);
        const sorted = this.pickups.slice().sort((a, b) => a.y - b.y);
        for (const p of sorted) p.draw(ctx, this.frames);
    }
}
