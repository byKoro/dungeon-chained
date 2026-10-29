import { FloorDebris } from './FloorDebris.js';
import { DustPuff } from './DustPuff.js';
import { SparkParticle } from './SparkParticle.js';
import { FlashParticle } from './FlashParticle.js';
import { FlameParticle } from './FlameParticle.js';
import { DamageNumber } from './DamageNumber.js';
import { DamageCombo } from './DamageCombo.js';
import { DAMAGE_NUMBER, DAMAGE_COMBO } from '../config/CombatFeelConfig.js';
import { LavaFragment } from './LavaFragment.js';
import { ARAUTO_FX } from '../config/ArautoEffectsConfig.js';

const BLOOD_PX = 4;

const AIR_BLOOD_COLORS = ["#5c0a18", "#6e0f1c", "#7d1420", "#4a0612", "#640d1a"];

function updateAndCompact(list, a, b) {
    let w = 0;
    for (let r = 0; r < list.length; r++) {
        const p = list[r];
        p.update(a, b);
        if (!p.done) list[w++] = p;
    }
    list.length = w;
}

class AirParticle {
    constructor(x, y, color, isBlood = false, spread = 1, ephemeral = false, dir = null) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.isBlood = isBlood;

        this.ephemeral = ephemeral;

        this.size = BLOOD_PX * (1 + (Math.random() < 0.35 ? 1 : 0));

        // Com `dir`, o sangue sai em leque ao redor da direção do golpe em vez de radial.
        const angle = dir
            ? Math.atan2(dir.y, dir.x) + (Math.random() - 0.5) * 1.6
            : Math.random() * Math.PI * 2;
        const speed = ((isBlood ? 3 : 4) + Math.random() * (isBlood ? 8 : 11)) * spread;
        this.vx = Math.cos(angle) * speed + (Math.random() - 0.5) * 2;
        this.vy = Math.sin(angle) * speed - (1 + Math.random() * 3.5);

        this.gravity = 0.4;
        this.friction = 0.92;

        this.groundY = y + 12 + (Math.random() - 0.5) * 36 * spread;
        this.bounces = 0;
        this.maxBounces = 1 + Math.floor(Math.random() * 2);
        this.settled = false;
    }

    get done() {
        return this.settled;
    }

    update(debrisList, bloodCanvas) {
        if (this.settled) return;

        this.vx *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;

        if (this.y >= this.groundY) {
            this.y = this.groundY;
            this.bounces++;
            if (this.bounces < this.maxBounces && Math.abs(this.vy) > 1.4) {
                this.vy = -this.vy * 0.35;
                this.vx *= 0.6;
            } else {
                this.settled = true;
                if (this.ephemeral) {

                } else if (this.isBlood && bloodCanvas) {

                    bloodCanvas.stampSplat(this.x, this.y, 0.6 + Math.random() * 0.5);
                } else if (debrisList) {

                    debrisList.push(new FloorDebris(this.x, this.y, this.size, this.size, this.color, false));
                }
            }
        }
    }

    draw(ctx) {
        if (this.settled) return;
        ctx.fillStyle = this.color;

        const x = Math.round(this.x / BLOOD_PX) * BLOOD_PX;
        const y = Math.round(this.y / BLOOD_PX) * BLOOD_PX;
        ctx.fillRect(x, y, this.size, this.size);
    }
}

export class ParticleSystem {
    constructor(bloodCanvas = null) {
        this.airParticles = [];
        this.floorDebris = [];
        this.smoke = [];
        this.sparks = [];
        this.flashes = [];
        this.flames = [];
        this.damageNumbers = [];
        this.damageCombos = [];
        this.lavaFragments = [];
        this.bloodCanvas = bloodCanvas;
    }

    clear() {
        this.lavaFragments = [];
        this.airParticles = [];
        this.floorDebris = [];
        this.smoke = [];
        this.sparks = [];
        this.flashes = [];
        this.flames = [];
        this.clearDamageNumbers();
        if (this.bloodCanvas) this.bloodCanvas.clear();
    }

    clearDamageNumbers() {
        this.damageNumbers = [];
        this.damageCombos = [];
    }

    triggerDamageNumber(x, y, amount, opts = {}) {
        this.damageNumbers.push(new DamageNumber(x, y, amount, opts));
        while (this.damageNumbers.length > DAMAGE_NUMBER.max) this.damageNumbers.shift();
    }

    // Soma o golpe no combo aberto do inimigo, ou abre um novo. `top` = onde nasce o número individual.
    triggerDamageCombo(target, top, amount, opts = {}) {
        const combo = this.damageCombos.find(c => c.open && c.target === target);
        if (combo) { combo.add(amount, top, opts); return combo; }
        const created = new DamageCombo(target, top, amount, opts);
        this.damageCombos.push(created);
        while (this.damageCombos.length > DAMAGE_COMBO.max) this.damageCombos.shift();
        return created;
    }

    triggerLavaDebris(x, y, amount = ARAUTO_FX.contactPieces, opts = {}) {
        for (let i = 0; i < amount; i++) {
            this.lavaFragments.push(new LavaFragment(x, y, { ...opts, lava: opts.lava ?? i % 2 === 0 }));
        }
        if (this.lavaFragments.length > ARAUTO_FX.maxFragments) {
            this.lavaFragments.splice(0, this.lavaFragments.length - ARAUTO_FX.maxFragments);
        }
    }

    // Faíscas em cone a partir do ponto de contato, na direção do golpe.
    triggerHitSparks(x, y, dirX, dirY, amount = 6, power = 1, cone = 0.9) {
        for (let i = 0; i < amount; i++) {
            this.sparks.push(new SparkParticle(x, y, 0, 1, { dir: { x: dirX, y: dirY }, power, cone }));
        }
    }

    triggerHitBlood(x, y, dirX, dirY, amount = 5, spread = 0.8) {
        const dir = { x: dirX, y: dirY };
        for (let i = 0; i < amount; i++) {
            const c = AIR_BLOOD_COLORS[Math.floor(Math.random() * AIR_BLOOD_COLORS.length)];
            this.airParticles.push(new AirParticle(x, y, c, true, spread, false, dir));
        }
    }

    triggerDust(x, y, dirX, dirY, amount = 10) {

        const n = amount + ((Math.random() * Math.max(1, amount * 0.3)) | 0);
        for (let i = 0; i < n; i++) {

            const ox = (Math.random() - 0.5) * 8;
            const oy = (Math.random() - 0.5) * 6;
            this.smoke.push(new DustPuff(x + ox, y + oy, dirX, dirY));
        }
    }

    triggerFlameBurst(x, y, baseColor = [255, 190, 110], opts = {}) {
        const amount = opts.amount ?? 34;
        const flameOpts = {
            rise: opts.rise ?? 50,
            width: opts.width ?? 30,
            sizeScale: opts.sizeScale ?? 1
        };
        for (let i = 0; i < amount; i++) {
            this.flames.push(new FlameParticle(x, y, baseColor, flameOpts));
        }
    }

    triggerFlash(x, y, amount = 14, power = 1) {
        for (let i = 0; i < amount; i++) {
            this.flashes.push(new FlashParticle(x, y, power));
        }
    }

    triggerSparks(cx, cy, radius = 24, spinDir = 1, amount = 2) {
        for (let i = 0; i < amount; i++) {
            this.sparks.push(new SparkParticle(cx, cy, radius, spinDir));
        }
    }

    triggerSparkBurst(cx, cy, radius = 24, amount = 24, power = 1.5) {
        for (let i = 0; i < amount; i++) {
            this.sparks.push(new SparkParticle(cx, cy, radius, 1, { burst: true, power }));
        }
    }

    triggerBlood(x, y, amount = 20, spread = 1) {
        const bloodColors = AIR_BLOOD_COLORS;
        const count = amount + Math.floor(Math.random() * (amount * 0.5));
        for (let i = 0; i < count; i++) {
            const c = bloodColors[Math.floor(Math.random() * bloodColors.length)];
            this.airParticles.push(new AirParticle(x, y, c, true, spread));
        }
    }

    triggerBloodDroplets(x, y, amount = 2, spread = 1) {
        const bloodColors = AIR_BLOOD_COLORS;
        for (let i = 0; i < amount; i++) {
            const c = bloodColors[Math.floor(Math.random() * bloodColors.length)];
            this.airParticles.push(new AirParticle(x, y, c, true, spread, true));
        }
    }

    triggerBloodPool(x, y, scale = 1) {
        if (this.bloodCanvas) this.bloodCanvas.stampPool(x, y, scale);
    }

    triggerExplosion(x, y, isSkeleton) {
        const bloodColors = AIR_BLOOD_COLORS;
        const boneColors = isSkeleton
            ? ["#ffffff", "#e5e5e5", "#b8b8b8", "#595959"]
            : ["#48cae4", "#0096c7", "#023e8a", "#e0fbfc"];

        const bloodCount = 22 + Math.floor(Math.random() * 10);
        for (let i = 0; i < bloodCount; i++) {
            const c = bloodColors[Math.floor(Math.random() * bloodColors.length)];
            this.airParticles.push(new AirParticle(x, y, c, true));
        }

        const pieceCount = 14 + Math.floor(Math.random() * 8);
        for (let i = 0; i < pieceCount; i++) {
            const c = boneColors[Math.floor(Math.random() * boneColors.length)];
            this.airParticles.push(new AirParticle(x, y, c, false));
        }
    }

    update(players, bounds) {
        updateAndCompact(this.lavaFragments);

        for (let i = 0; i < this.floorDebris.length; i++) {
            this.floorDebris[i].update(players, bounds);
        }

        updateAndCompact(this.airParticles, this.floorDebris, this.bloodCanvas);

        updateAndCompact(this.smoke);
        updateAndCompact(this.sparks);
        updateAndCompact(this.flashes);
        updateAndCompact(this.flames);
        updateAndCompact(this.damageNumbers);
        updateAndCompact(this.damageCombos);
    }

    get hasDamageNumbers() {
        return this.damageNumbers.length > 0 || this.damageCombos.length > 0;
    }

    // Os totais vêm depois: ficam por cima dos números individuais.
    drawDamageNumbers(ctx) {
        for (let i = 0; i < this.damageNumbers.length; i++) this.damageNumbers[i].draw(ctx);
        for (let i = 0; i < this.damageCombos.length; i++) this.damageCombos[i].draw(ctx);
    }

    drawFloor(ctx, clip, holes = null) {
        ctx.save();
        if (clip) {
            ctx.beginPath();
            ctx.rect(clip.minX, clip.minY, clip.maxX - clip.minX, clip.maxY - clip.minY);

            if (holes) {
                for (const h of holes) ctx.rect(h.x, h.y, h.w, h.h);
            }
            ctx.clip("evenodd");
        }
        if (this.bloodCanvas) this.bloodCanvas.draw(ctx);
        for (const fragment of this.lavaFragments) if (fragment.settled) fragment.draw(ctx);
        for (let i = 0; i < this.floorDebris.length; i++) {
            this.floorDebris[i].draw(ctx);
        }
        ctx.restore();
    }

    drawSmoke(ctx) {
        if (this.smoke.length === 0) return;
        ctx.save();
        for (let i = 0; i < this.smoke.length; i++) {
            this.smoke[i].draw(ctx);
        }
        ctx.restore();
    }

    drawSparks(ctx) {
        if (this.sparks.length === 0 && this.flashes.length === 0) return;
        ctx.save();
        for (let i = 0; i < this.sparks.length; i++) {
            this.sparks[i].draw(ctx);
        }

        if (this.flashes.length > 0) {

            const zoom = ctx.getTransform().a || 1;
            ctx.globalCompositeOperation = "lighter";
            for (let i = 0; i < this.flashes.length; i++) {
                this.flashes[i].draw(ctx, zoom);
            }
        }
        ctx.restore();
    }

    drawAir(ctx) {
        for (const fragment of this.lavaFragments) if (!fragment.settled) fragment.draw(ctx);
        for (let i = 0; i < this.airParticles.length; i++) {
            this.airParticles[i].draw(ctx);
        }
    }

    drawFlames(ctx) {
        if (this.flames.length === 0) return;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        for (let i = 0; i < this.flames.length; i++) {
            this.flames[i].draw(ctx);
        }
        ctx.restore();
    }
}
