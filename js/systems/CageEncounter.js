import { CAGE } from '../config/EventsConfig.js';
import { Physics } from '../core/Physics.js';
import { ANIMATED_PROPS } from '../config/PropConfig.js';

const easeIn = k => k * k;

// Gaiola pendurada no meio da zona, presa por cordas amarradas em estacas no chÃ£o.
// Os dois entram na zona â†’ a corda `auto` arrebenta sozinha, as grades descem e cai a leva 1. Cada corda cortada pelo
// cabo ou pelo disco (atÃ© `cutRadius` da estaca) solta a prÃ³xima leva, pela ordem do corte. Na Ãºltima corda a gaiola cai
// e quebra; com a gaiola no chÃ£o e nenhum inimigo vivo, o baÃº de dentro abre e as grades sobem.
export class CageEncounter {
    constructor({ api, zoneId, encounterId, rng = Math.random, cfg = CAGE }) {
        Object.assign(this, { api, zoneId, encounterId, rng, cfg });
        const objs = api.authored.interactives || [];
        const cage = objs.find(o => o.type === "cage");
        this.cagePos = cage ? api.tileCenter(cage.col, cage.row) : null;
        this.cageTile = cage;
        // BaÃº sob a gaiola (atÃ© 1 tile de distÃ¢ncia): fica escondido atÃ© ela cair.
        this.chest = cage ? (api.authored.props || []).find(p => ANIMATED_PROPS[p.type]?.opens && Math.abs(p.col - cage.col) <= 1 && Math.abs(p.row - cage.row) <= 1) || null : null;
        this.ropeDefs = objs.filter(o => o.type === "rope").map(o => ({ ...api.tileCenter(o.col, o.row), auto: !!o.auto }));
        if (this.ropeDefs.length && !this.ropeDefs.some(r => r.auto)) this.ropeDefs[0].auto = true;
        this._restore();
        if (api.isCompleted(encounterId)) this._finishState();
    }

    get valid() {
        return !!this.cagePos && this.ropeDefs.length > 0 && !!this.api.encounter(this.encounterId);
    }

    _restore() {
        this.phase = "idle";
        this.ropes = this.ropeDefs.map(r => ({ ...r, cut: false, cutT: 0 }));
        this.cuts = 0;
        this.spawned = [];
        this.lastAlive = 0;
        this.tilt = 0;
        this.tiltTarget = 0;
        this.fallT = 0;
        this.debrisT = 0;
        this.flashT = 0;
        this.debris = [];
        this._pulse = 0;
        if (this.chest) this.api.chests?.setHidden(this.api.room.key, this.chest, true);
    }

    _finishState() {
        this.phase = "done";
        this.ropes.forEach(r => { r.cut = true; r.cutT = 1; });
        this.debrisT = 0;
        if (this.chest) this.api.chests?.setHidden(this.api.room.key, this.chest, false);
    }

    _alive() {
        return this.spawned.filter(e => this.api.room.enemies.includes(e) && e.state !== "dying");
    }

    update() {
        if (!this.valid || this.phase === "done") return;
        this._pulse += 1;
        if (this.flashT > 0) this.flashT--;
        this.tilt += (this.tiltTarget - this.tilt) * 0.12;
        for (const r of this.ropes) if (r.cut && r.cutT < 1) r.cutT = Math.min(1, r.cutT + 0.08);
        this._updateDrops();

        if (this.phase === "idle") {
            if (!this.api.bothInZone(this.zoneId)) return;
            this._start();
        }
        if (this.phase === "active") this._checkCuts();
        if (this.phase === "falling") {
            this.fallT++;
            if (this.fallT >= this.cfg.fallSteps) this._break();
        }

        const alive = this._alive().length + this.spawned.filter(e => e.isHidden).length;
        if (this.lastAlive > 0 && alive === 0) {
            this.api.scrap?.vacuum();
            if (this.cuts === 1) this.api.dialogue?.say(1, "talk.wave1Clear");
        }
        this.lastAlive = alive;
        if (this.phase === "fallen" && alive === 0) this._win();
        if (this.debrisT > 0) this.debrisT--;
    }

    _start() {
        this.phase = "active";
        this.api.setBars(true);
        const auto = this.ropes.find(r => r.auto);
        this._cut(auto, { snapped: true });
        this.api.dialogue?.say(0, "talk.rope1");
    }

    _checkCuts() {
        const chain = this.api.chain, [p1, p2] = this.api.getPlayers();
        const w = chain.weapon;
        const saws = chain.isConnected ? (w.getSawPositions?.(p1, p2) || []) : [];
        for (const r of this.ropes) {
            if (r.cut) continue;
            let hit = false;
            if (chain.isConnected) {
                hit = Physics.distToSegment(r.x, r.y, p1.x, p1.y, p2.x, p2.y) < this.cfg.cutRadius
                    || saws.some(s => Math.hypot(s.x - r.x, s.y - r.y) < this.cfg.cutRadius);
            } else if (w.thrown) {
                hit = Math.hypot(w.dropX - r.x, w.dropY - r.y) < this.cfg.cutRadius;
            }
            if (hit) { this._cut(r); break; }
        }
    }

    _cut(rope, { snapped = false } = {}) {
        if (!rope || rope.cut) return;
        rope.cut = true;
        rope.cutT = 0;
        this.cuts++;
        this.flashT = this.cfg.flashSteps;
        const side = Math.sign(rope.x - this.cagePos.x) || 1;
        this.tiltTarget = -side * this.cfg.tiltPerCut * this.cuts;
        this.api.audio?.play("sawSnap", { rateMultiplier: snapped ? 0.8 : 1.1 });
        this.api.renderer?.triggerShake(snapped ? this.cfg.snapShake : this.cfg.cutShake);
        this.api.particleSystem?.triggerSparkBurst?.(rope.x, rope.y, 12, 8, 0.9);
        this._spawnWave(this.cuts - 1);
        if (this.ropes.every(r => r.cut)) {
            this.phase = "falling";
            this.fallT = 0;
        }
    }

    _spawnWave(index) {
        const wave = this.api.encounter(this.encounterId)?.waves?.[index];
        if (!wave) return;
        const c = this.cagePos;
        let n = 0;
        for (const group of wave) {
            for (let i = 0; i < group.count; i++, n++) {
                const a = this.rng() * Math.PI * 2;
                const d = this.cfg.landMin + this.rng() * (this.cfg.landMax - this.cfg.landMin);
                const e = this.api.spawnEnemy(group.type, c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.7, this.cfg.dropSteps + n * this.cfg.dropStagger);
                if (e) this.spawned.push(e);
            }
        }
    }

    // Inimigos caindo: aparecem com poeira e tremor; depois do efeito de entrada voltam a agir.
    _updateDrops() {
        for (const e of this.spawned) {
            if (e.justAppeared) {
                this.api.renderer?.triggerShake(this.cfg.landShake);
                this.api.audio?.play("sawLand", { rateMultiplier: 0.7 });
                const ps = this.api.particleSystem;
                for (let i = 0; i < this.cfg.landDust; i++) {
                    const a = (i / this.cfg.landDust) * Math.PI * 2;
                    ps?.triggerDust?.(e.x + Math.cos(a) * 14, (e.footY ?? e.y + 20) + Math.sin(a) * 6, Math.cos(a), Math.sin(a), 1);
                }
            }
            if (e.frozen && !e.isHidden && !(e.spawnFx > 0)) e.unfreeze?.();
        }
    }

    _break() {
        this.phase = "fallen";
        const c = this.cagePos;
        this.api.renderer?.triggerShake(this.cfg.impactShake);
        this.api.audio?.play("sawSnap", { rateMultiplier: 0.6 });
        this.api.particleSystem?.triggerSparkBurst?.(c.x, c.y, 30, 16, 1.2);
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            this.api.particleSystem?.triggerDust?.(c.x + Math.cos(a) * 30, c.y + 20 + Math.sin(a) * 12, Math.cos(a), Math.sin(a), 2);
        }
        this.api.scrap?.spawnBurst(c.x, c.y, this.cfg.brokenScrap);
        this.debrisT = this.cfg.debrisSteps;
        this.debris = Array.from({ length: 7 }, () => ({
            x: c.x + (this.rng() - 0.5) * this.cfg.width * 1.4, y: c.y + 10 + (this.rng() - 0.5) * 40,
            a: this.rng() * Math.PI, len: 20 + this.rng() * 30
        }));
        if (this.chest) this.api.chests?.setHidden(this.api.room.key, this.chest, false);
    }

    _win() {
        this.phase = "done";
        this.api.complete(this.encounterId);
        this.api.setBars(false);
        if (this.chest && this.api.chests?.forceOpen(this.api.room.key, this.chest)) {
            this.api.dialogue?.say(0, "talk.chest2");
        }
    }

    onDeath() {
        if (this.phase === "done" || !this.valid) return;
        this.api.removeEnemies(this.spawned);
        this._restore();
    }

    // ---------- desenho (sprites de assets/cage, 1 pixel de arte = cfg.art px de mundo) ----------

    _img(key) {
        const img = this.api.assets?.get?.(key);
        return img?.complete && img.naturalWidth > 0 ? img : null;
    }

    // Topo do sprite da gaiola: pendurada, caindo ou já no chão.
    _cageTop() {
        const c = this.cagePos, s = this.cfg.sprite;
        const hung = c.y - this.cfg.hang - s.bodyBottom * this.cfg.art;
        const floor = c.y + s.floorOffset - s.bodyBottom * this.cfg.art;
        if (this.phase === "falling") return hung + (floor - hung) * easeIn(this.fallT / this.cfg.fallSteps);
        return hung;
    }

    // Ponto do sprite (pixel de arte) no mundo, girado pela inclinação em volta do gancho.
    _cagePoint(ax, ay) {
        const A = this.cfg.art, s = this.cfg.sprite, c = this.cagePos, top = this._cageTop();
        const hx = c.x, hy = top + s.hookY * A;
        const lx = (ax - s.w / 2) * A, ly = (ay - s.hookY) * A;
        const cos = Math.cos(this.tilt), sin = Math.sin(this.tilt);
        return { x: hx + lx * cos - ly * sin, y: hy + lx * sin + ly * cos };
    }

    _stakeKnot(r) {
        const A = this.cfg.art, s = this.cfg.sprite;
        return { x: r.x + (s.knotX - s.stakeW / 2) * A, y: r.y + s.stakeFoot - (s.stakeH - s.knotY) * A };
    }

    drawFloor(ctx) {
        if (!this.valid) return;
        const col = this.cfg.colors, c = this.cagePos, A = this.cfg.art, s = this.cfg.sprite;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const stake = this._img("ropeStake");
        for (const r of this.ropes) {
            if (stake) ctx.drawImage(stake, Math.round(r.x - s.stakeW * A / 2), Math.round(r.y + s.stakeFoot - s.stakeH * A), s.stakeW * A, s.stakeH * A);
            if (r.cut) this._ropeEnd(ctx, this._stakeKnot(r), 0);
        }
        if (this.phase !== "fallen" && this.phase !== "done") {
            const k = this.phase === "falling" ? easeIn(this.fallT / this.cfg.fallSteps) : 0;
            ctx.fillStyle = col.shadow;
            ctx.beginPath();
            ctx.ellipse(c.x, c.y + s.floorOffset, this.cfg.width * (0.42 + k * 0.2), this.cfg.width * (0.15 + k * 0.08), 0, 0, Math.PI * 2);
            ctx.fill();
        }
        for (const e of this.spawned) {
            if (!e.isHidden) continue;
            ctx.fillStyle = col.shadow;
            ctx.beginPath();
            ctx.ellipse(e.x, (e.footY ?? e.y + 20), 16, 6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        const broken = this._img("cageBroken");
        if (this.debrisT > 0 && broken) {
            ctx.globalAlpha = Math.min(1, this.debrisT / 60);
            const w = broken.naturalWidth * A, h = broken.naturalHeight * A;
            ctx.drawImage(broken, Math.round(c.x - w / 2), Math.round(c.y + s.floorOffset - h + 8), w, h);
        }
        ctx.restore();
    }

    // Gaiola e cordas ficam no alto: desenhadas por cima de tudo (no passe acima da escuridão).
    drawAir(ctx) {
        if (!this.valid || this.phase === "fallen" || this.phase === "done") return;
        const A = this.cfg.art, s = this.cfg.sprite, c = this.cagePos;
        const [p1, p2] = this.api.getPlayers();
        const chain = this.api.chain;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const r of this.ropes) {
            const a = this._cagePoint(r.x < c.x ? s.ropeLeftX : s.ropeRightX, s.ropeY);
            if (r.cut) {
                const k = Math.min(1, r.cutT);
                this._ropeEnd(ctx, { x: a.x + (r.x - a.x) * 0.06 * k, y: a.y + 30 + 10 * k }, 1, a);
                continue;
            }
            const knot = this._stakeKnot(r);
            const near = this.phase === "active" && chain.isConnected
                && Physics.distToSegment(r.x, r.y, p1.x, p1.y, p2.x, p2.y) < this.cfg.nearRadius;
            const wob = near ? Math.sin(this._pulse * 0.9) * 3 : 0;
            if (near) {
                ctx.strokeStyle = this.cfg.colors.glow;
                ctx.lineWidth = s.ropeThick + 8;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.moveTo(knot.x, knot.y);
                ctx.quadraticCurveTo((knot.x + a.x) / 2 + wob, (knot.y + a.y) / 2 + s.ropeSag + wob, a.x, a.y);
                ctx.stroke();
            }
            this._ropeAlong(ctx, knot, a, wob);
        }
        const img = this._img(this.flashT > 0 ? "cageOpen" : "cageHang");
        if (img) {
            const top = this._cageTop();
            ctx.translate(c.x, top + s.hookY * A);
            ctx.rotate(this.tilt);
            ctx.drawImage(img, -s.w * A / 2, -s.hookY * A, s.w * A, img.naturalHeight * A);
        }
        ctx.restore();
    }

    // Corda texturizada ao longo de uma curva (mesma ideia do cabo da serra).
    _ropeAlong(ctx, p, q, wob) {
        const tex = this._img("cageRope"), s = this.cfg.sprite;
        const mx = (p.x + q.x) / 2 + wob, my = (p.y + q.y) / 2 + s.ropeSag + wob;
        const at = t => ({
            x: (1 - t) * (1 - t) * p.x + 2 * (1 - t) * t * mx + t * t * q.x,
            y: (1 - t) * (1 - t) * p.y + 2 * (1 - t) * t * my + t * t * q.y
        });
        const N = 20;
        let prev = at(0), u = 0;
        for (let i = 1; i <= N; i++) {
            const cur = at(i / N);
            const len = Math.hypot(cur.x - prev.x, cur.y - prev.y);
            ctx.save();
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

    // Ponta desfiada de corda cortada; com `from`, desenha antes o pedaço pendurado até ela.
    _ropeEnd(ctx, at, dangling, from = null) {
        if (from) this._ropeAlong(ctx, from, at, 0);
        const img = this._img("cageRopeEnd"), A = this.cfg.art;
        if (!img) return;
        const w = img.naturalWidth * A * 0.75, h = img.naturalHeight * A * 0.75;
        ctx.drawImage(img, Math.round(at.x - w / 2), Math.round(at.y - h / 2 + dangling * 4), w, h);
    }
}
