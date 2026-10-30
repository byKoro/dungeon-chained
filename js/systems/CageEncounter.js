import { CAGE } from '../config/EventsConfig.js';
import { Physics } from '../core/Physics.js';
import { ANIMATED_PROPS } from '../config/PropConfig.js';
import { StakeRopeArt, sawGap, impactBurst, drawChestDrop, easeIn, easeOut, clamp01 } from './StakeRope.js';

// Estacas no chão, cada uma segurando por uma corda vertical uma gaiola lá no alto (fora da vista).
// Os dois entram na zona → a corda `auto` arrebenta sozinha e as grades descem. Passar a serra pela estaca corta a
// corda: aviso (sombra crescendo, poeira caindo do teto), a gaiola despenca, estilhaça, empurra quem estiver perto e
// os monstros da leva saltam dos destroços para tiles de piso alcançáveis. Depois do último corte, quando a última
// leva morre, o baú do encontro despenca do lugar da última corda, bate no chão e abre; as grades sobem.
export class CageEncounter {
    constructor({ api, zoneId, encounterId, rng = Math.random, cfg = CAGE }) {
        Object.assign(this, { api, zoneId, encounterId, rng, cfg });
        this.art = new StakeRopeArt(cfg, () => api.assets);
        const objs = api.authored.interactives || [];
        this.ropeDefs = objs.filter(o => o.type === "rope").map(o => ({ col: o.col, row: o.row, ...api.tileCenter(o.col, o.row), auto: !!o.auto }));
        if (this.ropeDefs.length && !this.ropeDefs.some(r => r.auto)) this.ropeDefs[0].auto = true;
        // Baú do encontro: prop com `encounter` igual ao id; fica escondido até o fim.
        this.chest = (api.authored.props || []).find(p => ANIMATED_PROPS[p.type]?.opens && p.encounter === encounterId) || null;
        this.chestHome = this.chest ? { col: this.chest.col, row: this.chest.row } : null;
        this._restore();
        if (api.isCompleted(encounterId)) this._finishState();
    }

    get valid() {
        return this.ropeDefs.length > 0 && !!this.api.encounter(this.encounterId);
    }

    _restore() {
        this.phase = "idle";
        this.ropes = this.ropeDefs.map(r => ({ ...r, cut: false, cutT: 0, flash: 0, cage: null, wave: -1 }));
        this.cuts = 0;
        this.spawned = [];
        this.jumpers = [];
        this.lastAlive = 0;
        this.lastRope = null;
        this.drop = null;
        this._pulse = 0;
        if (this.chest) {
            this.api.moveProp?.(this.chest, this.chestHome.col, this.chestHome.row);
            this.api.chests?.setHidden(this.api.room.key, this.chest, true);
        }
    }

    _finishState() {
        this.phase = "done";
        this.ropes.forEach(r => { r.cut = true; r.cutT = 1; });
        if (this.chest) this.api.chests?.setHidden(this.api.room.key, this.chest, false);
    }

    _alive() {
        return this.spawned.filter(e => this.api.room.enemies.includes(e) && e.state !== "dying");
    }

    get _busy() {
        return this.ropes.some(r => r.cage && !r.cage.landed) || this.jumpers.length > 0;
    }

    update() {
        if (!this.valid || this.phase === "done") return;
        this._pulse++;
        for (const r of this.ropes) {
            if (r.cut && r.cutT < 1) r.cutT = Math.min(1, r.cutT + this.cfg.retractSpeed);
            if (r.flash > 0) r.flash--;
            if (r.cage) this._updateCage(r);
        }
        this._updateJumpers();
        if (this.phase === "reward") { this._updateChestDrop(); return; }

        if (this.phase === "idle") {
            if (!this.api.chain.isConnected || !this.api.bothInZone(this.zoneId)) return;
            this._start();
        }
        this._checkCuts();

        const alive = this._alive().length + (this._busy ? 1 : 0);
        if (this.lastAlive > 0 && alive === 0) {
            this.api.scrap?.vacuum();
            if (this.cuts === 1) this.api.dialogue?.say(1, "talk.wave1Clear");
        }
        this.lastAlive = alive;
        if (this.ropes.every(r => r.cut) && alive === 0) this._beginReward();
    }

    _start() {
        this.phase = "active";
        this.api.setBars(true);
        this._cut(this.ropes.find(r => r.auto), { snapped: true });
        this.api.dialogue?.say(0, "talk.rope1");
    }

    _stakePoint(r) {
        return this.art.stakePoint(r);
    }

    _sawGap(r) {
        return sawGap(this.api.chain, this.api.getPlayers(), this._stakePoint(r));
    }

    _near(r) {
        return !r.cut && this.phase !== "idle" ? clamp01(1 - this._sawGap(r) / this.cfg.nearRadius) : 0;
    }

    _checkCuts() {
        if (this.phase !== "active") return;
        for (const r of this.ropes) {
            if (!r.cut && this._sawGap(r) < this.cfg.stakeRadius) { this._cut(r); break; }
        }
    }

    _cut(rope, { snapped = false } = {}) {
        if (!rope || rope.cut) return;
        const c = this.cfg.cut, s = this._stakePoint(rope);
        rope.cut = true;
        rope.cutT = 0;
        rope.flash = c.stakeFlashSteps;
        this.cuts++;
        rope.wave = this.cuts - 1;
        rope.cage = { t: 0, phase: "warn", landed: false, debrisT: 0, spin: (this.rng() - 0.5) * this.cfg.fallSpin };
        this.lastRope = rope;
        this.api.audio?.play("sawSnap", { rateMultiplier: snapped ? 0.8 : 1.15 });
        this.api.audio?.play("sawHit", { rateMultiplier: 0.75, volumeMultiplier: 0.6 });
        this.api.renderer?.triggerShake(c.shake);
        this.api.renderer?.triggerZoomPunch?.(c.zoomPunch);
        this.api.hitStop?.(c.hitStop);
        this.api.particleSystem?.triggerSparkBurst?.(s.x, s.y, 14, c.sparks, 1.1);
        this.api.particleSystem?.triggerFlash?.(s.x, s.y, 8, 0.9);
    }

    _updateCage(r) {
        const c = r.cage, cfg = this.cfg;
        c.t++;
        if (c.phase === "warn") {
            if (c.t % cfg.ceilingDustEvery === 0) this._ceilingDust(r.x, r.y);
            if (c.t >= cfg.warnSteps) {
                c.phase = "fall"; c.t = 0;
                this.api.audio?.play("sawLand", { rateMultiplier: 0.5, volumeMultiplier: 0.5 });
            }
        } else if (c.phase === "fall") {
            if (c.t >= cfg.fallSteps) this._impact(r);
        } else if (c.debrisT > 0) c.debrisT--;
    }

    _ceilingDust(x, y) {
        const ps = this.api.particleSystem;
        const dx = (this.rng() - 0.5) * this.cfg.width;
        ps?.triggerDust?.(x + dx, y - this.cfg.fallHeight * 0.4, 0, 1, 1);
    }

    _ground(r) {
        return { x: r.x, y: r.y + this.cfg.sprite.groundOffset };
    }

    _burst(x, y, fx) {
        impactBurst(this.api, x, y, fx);
    }

    // A gaiola bate no chão e estilhaça; os monstros saltam dos destroços.
    _impact(r) {
        const c = r.cage, g = this._ground(r);
        c.phase = "landed";
        c.landed = true;
        c.debrisT = this.cfg.debrisSteps;
        this.api.audio?.play("sawSnap", { rateMultiplier: 0.55 });
        this.api.audio?.play("sawLand", { rateMultiplier: 0.65 });
        this._burst(g.x, g.y, this.cfg.impact);
        this.api.scrap?.spawnBurst(g.x, g.y - 16, this.cfg.brokenScrap);
        this._launchWave(r.wave, r);
    }

    // Tiles de piso ligados à estaca (sem atravessar parede, buraco ou grade), longe o bastante dela.
    _landingCells(r, count) {
        const kinds = this.api.authored.kinds || [], cfg = this.cfg;
        // Grades não se atravessam; estacas e props sólidos se atravessam, mas ninguém pousa neles.
        const walls = new Set((this.api.authored.bars || []).map(o => `${o.col},${o.row}`));
        const blocked = new Set([...walls, ...this.ropeDefs.map(o => `${o.col},${o.row}`)]);
        for (const p of this.api.authored.props || []) if (ANIMATED_PROPS[p.type]?.solid) blocked.add(`${p.col},${p.row}`);
        const seen = new Set([`${r.col},${r.row}`]), queue = [{ col: r.col, row: r.row, d: 0 }], out = [];
        while (queue.length) {
            const cur = queue.shift();
            const dist = Math.hypot(cur.col - r.col, cur.row - r.row);
            if (dist >= cfg.landMinTiles && dist <= cfg.landMaxTiles && !blocked.has(`${cur.col},${cur.row}`)) out.push(cur);
            if (cur.d >= cfg.landMaxTiles + 2) continue;
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const col = cur.col + dc, row = cur.row + dr, key = `${col},${row}`;
                if (seen.has(key) || kinds[row]?.[col] !== "f" || walls.has(key)) continue;
                seen.add(key);
                queue.push({ col, row, d: cur.d + 1 });
            }
        }
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(this.rng() * (i + 1));
            [out[i], out[j]] = [out[j], out[i]];
        }
        if (!out.length) out.push({ col: r.col, row: r.row });
        return Array.from({ length: count }, (_, i) => out[i % out.length]);
    }

    _launchWave(index, rope) {
        const wave = this.api.encounter(this.encounterId)?.waves?.[index];
        if (!wave) return;
        const list = wave.flatMap(g => Array.from({ length: g.count }, () => g.type));
        const cells = this._landingCells(rope, list.length);
        const g = this._ground(rope), j = this.cfg.jump;
        list.forEach((type, i) => {
            const cell = this.api.tileCenter(cells[i].col, cells[i].row);
            // Escondido (spawn congelado) até a hora do salto; aparece já saindo dos destroços.
            const wait = j.delay + i * j.stagger;
            const e = this.api.spawnEnemy(type, cell.x, cell.y, wait, { airborne: true });
            if (!e) return;
            this.spawned.push(e);
            this.jumpers.push({ e, t: -wait, fromX: g.x, fromY: g.y - 10, toX: e.x, toY: e.y, landed: false, hold: 0 });
            e.x = g.x; e.y = g.y - 10;
        });
    }

    // Arco do salto: sai do meio dos destroços, sobe e pousa no tile escolhido.
    _updateJumpers() {
        const j = this.cfg.jump, ps = this.api.particleSystem;
        for (let i = this.jumpers.length - 1; i >= 0; i--) {
            const k = this.jumpers[i], e = k.e;
            if (!this.api.room.enemies.includes(e)) { this.jumpers.splice(i, 1); continue; }
            k.t++;
            if (k.t < 0) { e.x = k.fromX; e.y = k.fromY; continue; }
            if (!k.landed) {
                if (k.t === 1) {
                    this.api.audio?.play("enemySpawn", { rateMultiplier: 1.2, volumeMultiplier: 0.6 });
                }
                const u = clamp01(k.t / j.steps);
                e.x = k.fromX + (k.toX - k.fromX) * easeOut(u);
                e.y = k.fromY + (k.toY - k.fromY) * u - Math.sin(u * Math.PI) * j.height;

                if (u >= 1) {
                    k.landed = true;
                    e.x = k.toX; e.y = k.toY;
                    this.api.renderer?.triggerShake(j.shake);
                    this.api.audio?.play("enemyStep", { rateMultiplier: 0.8 });
                    for (let n = 0; n < j.dust; n++) {
                        const a = (n / j.dust) * Math.PI * 2;
                        ps?.triggerDust?.(e.x + Math.cos(a) * 14, (e.footY ?? e.y + 20) + Math.sin(a) * 5, Math.cos(a), Math.sin(a) * 0.5, 1);
                    }
                }
                continue;
            }
            if (++k.hold >= j.holdSteps) {
                e.airborne = false;
                e.frozen = false;
                this.jumpers.splice(i, 1);
            }
        }
    }

    // ---------- baú caindo no fim ----------

    _beginReward() {
        this.phase = "reward";
        this.api.complete(this.encounterId);
        this.api.scrap?.vacuum();
        if (!this.chest) { this._win(); return; }
        const rope = this.lastRope ?? this.ropes[this.ropes.length - 1];
        const cell = this._landingCells(rope, 1)[0];
        this.api.moveProp?.(this.chest, cell.col, cell.row);
        this.api.chests?.setHidden(this.api.room.key, this.chest, true);
        const at = this.api.tileCenter(cell.col, cell.row);
        this.drop = { t: -this.cfg.chest.delay, phase: "wait", x: at.x, ground: at.y + 26, col: cell.col, row: cell.row };
    }

    _updateChestDrop() {
        const d = this.drop, c = this.cfg.chest;
        if (!d) return;
        d.t++;
        if (d.phase === "wait" && d.t >= 0) { d.phase = "warn"; d.t = 0; }
        else if (d.phase === "warn") {
            if (d.t % this.cfg.ceilingDustEvery === 0) this._ceilingDust(d.x, d.ground - 26);
            if (d.t >= c.warnSteps) { d.phase = "fall"; d.t = 0; }
        } else if (d.phase === "fall" && d.t >= c.fallSteps) {
            d.phase = "landed"; d.t = 0;
            this.api.audio?.play("forgeHammer", { rateMultiplier: 0.7 });
            this.api.audio?.play("sawLand", { rateMultiplier: 0.55 });
            this._burst(d.x, d.ground, c);
        } else if (d.phase === "landed") {
            if (d.t === c.squashSteps) this.api.chests?.setHidden(this.api.room.key, this.chest, false);
            if (d.t >= c.squashSteps + c.openDelay) this._win();
        }
    }

    _win() {
        this.phase = "done";
        this.api.setBars(false);
    }

    onDeath() {
        if (this.phase === "done" || this.phase === "reward" || !this.valid) return;
        this.api.removeEnemies(this.spawned);
        this._restore();
    }

    // ---------- luz ----------

    // Estacas inteiras brilham (mais com a serra perto), para o jogador saber onde passar a serra.
    lights() {
        if (!this.valid || this.phase === "done") return [];
        const L = this.cfg.light;
        const out = [];
        for (const r of this.ropes) {
            if (r.cut) continue;
            const pulse = 0.85 + 0.15 * Math.sin(this._pulse * 0.08 + r.x);
            out.push({ ...this._stakePoint(r), radius: (L.idleRadius + (L.nearRadius - L.idleRadius) * this._near(r)) * pulse });
            const knot = this.art.knot(r);
            for (const f of L.ropeAt) out.push({ x: r.x, y: knot.y - this.cfg.ropeUp * f, radius: L.ropeRadius });
        }
        return out;
    }

    // ---------- desenho ----------

    drawFloor(ctx) {
        if (!this.valid) return;
        const A = this.cfg.art, col = this.cfg.colors;
        const broken = this.art.img("cageBroken");
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const r of this.ropes) {
            const g = this._ground(r), cage = r.cage;
            if (cage && !cage.landed) this.art.shadow(ctx, g.x, g.y, this.art.fallK(cage, this.cfg.warnSteps, this.cfg.fallSteps));
            if (cage?.landed && cage.debrisT > 0 && broken) {
                ctx.globalAlpha = Math.min(1, cage.debrisT / 60);
                const w = broken.naturalWidth * A, h = broken.naturalHeight * A;
                ctx.drawImage(broken, Math.round(g.x - w / 2), Math.round(g.y - h + 8), w, h);
                ctx.globalAlpha = 1;
            }
            if (!r.cut && this.phase !== "idle") this.art.ring(ctx, r, this._near(r), this._pulse);
        }
        for (const k of this.jumpers) {
            if (k.t < 0 || k.landed) continue;
            const u = clamp01(k.t / this.cfg.jump.steps);
            const gx = k.fromX + (k.toX - k.fromX) * easeOut(u), gy = k.fromY + (k.toY - k.fromY) * u;
            ctx.fillStyle = col.shadow;
            ctx.beginPath();
            ctx.ellipse(gx, gy + 20, 14 - 4 * Math.sin(u * Math.PI), 5, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        const d = this.drop;
        if (d && (d.phase === "warn" || d.phase === "fall")) {
            this.art.shadow(ctx, d.x, d.ground, this.art.fallK(d, this.cfg.chest.warnSteps, this.cfg.chest.fallSteps));
        }
        ctx.restore();
    }

    // Corpos sólidos das estacas (ficam mesmo depois do corte).
    solidCircles() {
        if (!this.valid) return [];
        return this.ropes.map(r => this.art.solidCircle(r));
    }

    // Estacas ordenadas por y com as entidades (quem está atrás é desenhado antes).
    drawables() {
        if (!this.valid) return [];
        return this.art.drawables(this.ropes, r => this._near(r), this._pulse);
    }

    // Cordas subindo para o teto e gaiolas/baú caindo. No passe do mundo: a luz do ambiente atua neles.
    drawAir(ctx) {
        if (!this.valid || this.phase === "done" && !this.drop) return;
        const A = this.cfg.art, s = this.cfg.sprite;
        const img = this.art.img("cageHang");
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const r of this.ropes) {
            const knot = this.art.knot(r);
            this.art.rope(ctx, r, { x: r.x, y: knot.y - this.cfg.ropeUp }, this._pulse);
            if (r.cage?.phase === "fall" && img) {
                const k = r.cage.t / this.cfg.fallSteps;
                const g = this._ground(r);
                const bottom = g.y - this.cfg.fallHeight * (1 - easeIn(k));
                const stretch = 1 + 0.12 * k;
                ctx.save();
                ctx.translate(g.x, bottom - s.bodyBottom * A / 2);
                ctx.rotate(r.cage.spin * k);
                ctx.scale(1 / stretch, stretch);
                ctx.drawImage(img, -s.w * A / 2, -s.bodyBottom * A / 2, s.w * A, img.naturalHeight * A);
                ctx.restore();
            }
        }
        this._drawChestDrop(ctx);
        ctx.restore();
    }

    _drawChestDrop(ctx) {
        drawChestDrop(ctx, this.api, this.chest, this.drop, this.cfg.chest);
    }
}
