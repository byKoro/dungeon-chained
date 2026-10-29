import { CAGE } from '../config/EventsConfig.js';
import { Physics } from '../core/Physics.js';
import { ANIMATED_PROPS } from '../config/PropConfig.js';

const easeIn = k => k * k;
const easeOut = k => 1 - (1 - k) * (1 - k);
const clamp01 = v => Math.max(0, Math.min(1, v));

// Estacas no chão, cada uma segurando por uma corda vertical uma gaiola lá no alto (fora da vista).
// Os dois entram na zona → a corda `auto` arrebenta sozinha e as grades descem. Passar a serra pela estaca corta a
// corda: aviso (sombra crescendo, poeira caindo do teto), a gaiola despenca, estilhaça, empurra quem estiver perto e
// os monstros da leva saltam dos destroços para tiles de piso alcançáveis. Depois do último corte, quando a última
// leva morre, o baú do encontro despenca do lugar da última corda, bate no chão e abre; as grades sobem.
export class CageEncounter {
    constructor({ api, zoneId, encounterId, rng = Math.random, cfg = CAGE }) {
        Object.assign(this, { api, zoneId, encounterId, rng, cfg });
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
            if (!this.api.bothInZone(this.zoneId)) return;
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

    // Ponto de corte: a estaca (a altura do nó).
    _stakePoint(r) {
        return { x: r.x, y: r.y + this.cfg.stakeHitY };
    }

    // Distância entre a serra e a estaca, descontando o raio do disco (≤ 0 = encostando).
    _sawGap(r) {
        const chain = this.api.chain, [p1, p2] = this.api.getPlayers();
        const w = chain.weapon, s = this._stakePoint(r), disc = w.discRadius ?? 0;
        let best = Infinity;
        if (chain.isConnected) {
            for (const p of w.getSawPositions?.(p1, p2) || []) best = Math.min(best, Math.hypot(p.x - s.x, p.y - s.y) - disc);
        } else if (w.thrown) {
            best = Math.hypot(w.dropX - s.x, w.dropY - s.y) - disc;
        }
        return best;
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
        const ps = this.api.particleSystem;
        this.api.renderer?.triggerShake(fx.shake);
        this.api.renderer?.triggerZoomPunch?.(fx.zoomPunch);
        this.api.hitStop?.(fx.hitStop);
        ps?.triggerSparkBurst?.(x, y - 20, 30, fx.sparks, 1.3);
        ps?.triggerFlash?.(x, y - 20, fx.flash, 1);
        for (let i = 0; i < fx.dust; i++) {
            const a = (i / fx.dust) * Math.PI * 2;
            ps?.triggerDust?.(x + Math.cos(a) * 26, y + Math.sin(a) * 10, Math.cos(a), Math.sin(a) * 0.5, 2);
        }
        this.api.pushPlayers?.(x, y, fx.pushRadius, fx.pushForce);
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
        if (this.chest && this.api.chests?.forceOpen(this.api.room.key, this.chest)) {
            this.api.dialogue?.say(0, "talk.chest2");
        }
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
            const near = this.phase !== "idle" ? clamp01(1 - this._sawGap(r) / this.cfg.nearRadius) : 0;
            const pulse = 0.85 + 0.15 * Math.sin(this._pulse * 0.08 + r.x);
            out.push({ ...this._stakePoint(r), radius: (L.idleRadius + (L.nearRadius - L.idleRadius) * near) * pulse });
            const knot = this._knot(r);
            for (const f of L.ropeAt) out.push({ x: r.x, y: knot.y - this.cfg.ropeUp * f, radius: L.ropeRadius });
        }
        return out;
    }

    // ---------- desenho (sprites de assets/cage, 1 pixel de arte = cfg.art px de mundo) ----------

    _img(key) {
        const img = this.api.assets?.get?.(key);
        return img?.complete && img.naturalWidth > 0 ? img : null;
    }

    // Onde a corda sai da estaca (nas voltas de corda do sprite).
    _knot(r) {
        const A = this.cfg.art, s = this.cfg.sprite;
        return { x: r.x, y: r.y + s.stakeFoot - (s.stakeH - s.knotY) * A };
    }

    _shadow(ctx, x, y, k) {
        ctx.fillStyle = this.cfg.colors.shadow;
        ctx.beginPath();
        ctx.ellipse(x, y, this.cfg.width * (0.12 + k * 0.34), this.cfg.width * (0.05 + k * 0.13), 0, 0, Math.PI * 2);
        ctx.fill();
    }

    _fallK(cage, warnSteps, fallSteps) {
        if (cage.phase === "warn") return 0.25 * clamp01(cage.t / warnSteps);
        return 0.25 + 0.75 * easeIn(clamp01(cage.t / fallSteps));
    }

    drawFloor(ctx) {
        if (!this.valid) return;
        const A = this.cfg.art, s = this.cfg.sprite, col = this.cfg.colors;
        const stake = this._img("ropeStake"), broken = this._img("cageBroken");
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const r of this.ropes) {
            const g = this._ground(r), cage = r.cage;
            if (cage && !cage.landed) this._shadow(ctx, g.x, g.y, this._fallK(cage, this.cfg.warnSteps, this.cfg.fallSteps));
            if (cage?.landed && cage.debrisT > 0 && broken) {
                ctx.globalAlpha = Math.min(1, cage.debrisT / 60);
                const w = broken.naturalWidth * A, h = broken.naturalHeight * A;
                ctx.drawImage(broken, Math.round(g.x - w / 2), Math.round(g.y - h + 8), w, h);
                ctx.globalAlpha = 1;
            }
            if (!r.cut && this.phase !== "idle") this._ring(ctx, r);
            if (stake) this._drawStake(ctx, r, stake);
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
            this._shadow(ctx, d.x, d.ground, this._fallK(d, this.cfg.chest.warnSteps, this.cfg.chest.fallSteps));
        }
        ctx.restore();
    }

    // Anel pontilhado no chão em volta da estaca: "passe a serra aqui". Fica mais forte com a serra perto.
    _ring(ctx, r) {
        const near = clamp01(1 - this._sawGap(r) / this.cfg.nearRadius);
        const pulse = 0.5 + 0.5 * Math.sin(this._pulse * 0.12 + r.x);
        const alpha = 0.25 + 0.55 * near * (0.6 + 0.4 * pulse);
        const rx = 30 + 6 * pulse, ry = rx * 0.45, cy = r.y + this.cfg.sprite.stakeFoot - 4, n = 18, P = this.cfg.art;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.cfg.colors.ring;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + this._pulse * 0.02;
            ctx.fillRect(Math.round((r.x + Math.cos(a) * rx) / P) * P - P / 2, Math.round((cy + Math.sin(a) * ry) / P) * P - P / 2, P, P);
        }
        ctx.restore();
    }

    // Estaca: fica no lugar depois do corte. Inteira, brilha (faixa de luz) e pisca branco no golpe.
    _drawStake(ctx, r, img) {
        const A = this.cfg.art, s = this.cfg.sprite;
        const w = s.stakeW * A, h = s.stakeH * A;
        const sq = r.flash > 0 ? Math.sin((r.flash / this.cfg.cut.stakeFlashSteps) * Math.PI) * this.cfg.cut.squash : 0;
        const x = r.x, base = r.y + s.stakeFoot;
        ctx.save();
        ctx.translate(x, base);
        ctx.scale(1 + sq * 0.6, 1 - sq);
        ctx.drawImage(img, -w / 2, -h, w, h);
        const near = !r.cut && this.phase !== "idle" ? clamp01(1 - this._sawGap(r) / this.cfg.nearRadius) : 0;
        const glow = r.flash > 0 ? r.flash / this.cfg.cut.stakeFlashSteps : near * (0.35 + 0.25 * Math.sin(this._pulse * 0.2));
        if (glow > 0.01) {
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = Math.min(1, glow);
            ctx.drawImage(this._white(img), -w / 2, -h, w, h);
        }
        ctx.restore();
        if (r.cut) this._ropeEnd(ctx, this._knot(r), 0);
    }

    _white(img) {
        if (this._whiteImg?.src === img) return this._whiteImg.canvas;
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = "source-atop";
        g.fillStyle = this.cfg.colors.shine;
        g.fillRect(0, 0, c.width, c.height);
        this._whiteImg = { src: img, canvas: c };
        return c;
    }

    // Cordas subindo para o teto e gaiolas/baú caindo. No passe do mundo: a luz do ambiente atua neles.
    drawAir(ctx) {
        if (!this.valid || this.phase === "done" && !this.drop) return;
        const A = this.cfg.art, s = this.cfg.sprite;
        const img = this._img("cageHang");
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const r of this.ropes) {
            const knot = this._knot(r);
            const top = { x: r.x, y: knot.y - this.cfg.ropeUp };
            if (!r.cut) {
                const wob = Math.sin(this._pulse * 0.03 + r.x * 0.01) * this.cfg.swayAmp;
                this._ropeAlong(ctx, knot, top, wob, this.cfg.ropeFade);
            } else if (r.cutT < 1) {
                // A parte de cima chicoteia para o alto e some.
                const end = { x: r.x, y: knot.y - 18 - this.cfg.ropeUp * easeIn(r.cutT) };
                const fade = Math.max(0, (this.cfg.ropeFade * this.cfg.ropeUp - (knot.y - end.y)) / Math.max(1, end.y - top.y));
                this._ropeAlong(ctx, end, top, Math.sin(r.cutT * 20) * 6 * (1 - r.cutT), fade);
                this._ropeEnd(ctx, end, 0);
            }
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
        const d = this.drop, c = this.cfg.chest, T = this.api.tile;
        if (!d || !this.chest || (d.phase !== "fall" && d.phase !== "landed")) return;
        if (d.phase === "landed" && d.t >= c.squashSteps) return;
        let y = 0, sx = 1, sy = 1;
        if (d.phase === "fall") {
            const k = d.t / c.fallSteps;
            y = -c.fallHeight * (1 - easeIn(k));
            sy = 1 + 0.18 * k; sx = 1 / sy;
        } else {
            const k = d.t / c.squashSteps;
            const wave = Math.sin(k * Math.PI * 2.5) * (1 - k);
            sy = 1 - 0.38 * wave; sx = 1 + 0.25 * wave;
        }
        this.api.drawPropFrame?.(ctx, this.chest.type, 0, d.col * T + this.api.rect().x, d.row * T + this.api.rect().y + y, sx, sy);
    }

    // Corda texturizada ao longo de uma curva; `wob` desloca o meio na horizontal (balanço).
    // `fade` (0..1): a partir dessa fração do caminho p→q a corda vai sumindo.
    _ropeAlong(ctx, p, q, wob, fade = 1) {
        const tex = this._img("cageRope"), s = this.cfg.sprite;
        const mx = (p.x + q.x) / 2 + wob, my = (p.y + q.y) / 2;
        const at = t => ({
            x: (1 - t) * (1 - t) * p.x + 2 * (1 - t) * t * mx + t * t * q.x,
            y: (1 - t) * (1 - t) * p.y + 2 * (1 - t) * t * my + t * t * q.y
        });
        const N = 24;
        let prev = at(0), u = 0;
        for (let i = 1; i <= N; i++) {
            const cur = at(i / N);
            const len = Math.hypot(cur.x - prev.x, cur.y - prev.y);
            ctx.save();
            const tt = (i - 0.5) / N;
            if (tt > fade) ctx.globalAlpha *= Math.max(0, 1 - (tt - fade) / (1 - fade));
            ctx.translate((prev.x + cur.x) / 2, (prev.y + cur.y) / 2);
            ctx.rotate(Math.atan2(cur.y - prev.y, cur.x - prev.x));
            if (tex) {
                const tw = tex.naturalWidth, srcW = Math.max(1, Math.min(tw, Math.round(len / s.ropeThick * tex.naturalHeight)));
                const sx = Math.floor(u) % Math.max(1, tw - srcW + 1);
                ctx.drawImage(tex, sx, 0, srcW, tex.naturalHeight, -len / 2 - 0.5, -s.ropeThick / 2, len + 1, s.ropeThick);
                u += srcW;
            } else {
                ctx.fillStyle = this.cfg.colors.rope;
                ctx.fillRect(-len / 2, -s.ropeThick / 4, len, s.ropeThick / 2);
            }
            ctx.restore();
            prev = cur;
        }
    }

    // Ponta desfiada de corda cortada.
    _ropeEnd(ctx, at, dangling) {
        const img = this._img("cageRopeEnd"), A = this.cfg.art;
        if (!img) return;
        const w = img.naturalWidth * A * 0.75, h = img.naturalHeight * A * 0.75;
        ctx.drawImage(img, Math.round(at.x - w / 2), Math.round(at.y - h / 2 + dangling * 4), w, h);
    }
}
