import { CAGE } from '../config/EventsConfig.js';
import { Physics } from '../core/Physics.js';
import { ANIMATED_PROPS } from '../config/PropConfig.js';

const easeIn = k => k * k;

// Gaiola pendurada no meio da zona, presa por cordas amarradas em estacas no chão.
// Os dois entram na zona → a corda `auto` arrebenta sozinha, as grades descem e cai a leva 1. Cada corda cortada pelo
// cabo ou pelo disco (até `cutRadius` da estaca) solta a próxima leva, pela ordem do corte. Na última corda a gaiola cai
// e quebra; com a gaiola no chão e nenhum inimigo vivo, o baú de dentro abre e as grades sobem.
export class CageEncounter {
    constructor({ api, zoneId, encounterId, rng = Math.random, cfg = CAGE }) {
        Object.assign(this, { api, zoneId, encounterId, rng, cfg });
        const objs = api.authored.interactives || [];
        const cage = objs.find(o => o.type === "cage");
        this.cagePos = cage ? api.tileCenter(cage.col, cage.row) : null;
        this.cageTile = cage;
        // Baú sob a gaiola (até 1 tile de distância): fica escondido até ela cair.
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

    // ---------- desenho (placeholders procedurais) ----------

    _cageY() {
        if (this.phase === "falling") return this.cagePos.y - this.cfg.hang * (1 - easeIn(this.fallT / this.cfg.fallSteps));
        return this.cagePos.y - this.cfg.hang;
    }

    drawFloor(ctx) {
        if (!this.valid) return;
        const col = this.cfg.colors, c = this.cagePos;
        ctx.save();
        for (const r of this.ropes) {
            ctx.fillStyle = col.stake;
            ctx.fillRect(r.x - 6, r.y - 10, 12, 18);
            ctx.fillStyle = col.ropeDark;
            ctx.fillRect(r.x - 8, r.y - 4, 16, 4);
        }
        if (this.phase !== "fallen" && this.phase !== "done") {
            const k = this.phase === "falling" ? easeIn(this.fallT / this.cfg.fallSteps) : 0;
            ctx.fillStyle = col.shadow;
            ctx.beginPath();
            ctx.ellipse(c.x, c.y + 20, this.cfg.width * (0.45 + k * 0.2), this.cfg.width * (0.16 + k * 0.08), 0, 0, Math.PI * 2);
            ctx.fill();
        }
        for (const e of this.spawned) {
            if (!e.isHidden) continue;
            ctx.fillStyle = col.shadow;
            ctx.beginPath();
            ctx.ellipse(e.x, (e.footY ?? e.y + 20), 16, 6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        if (this.debrisT > 0) {
            ctx.globalAlpha = Math.min(1, this.debrisT / 60);
            for (const d of this.debris) {
                ctx.save();
                ctx.translate(d.x, d.y);
                ctx.rotate(d.a);
                ctx.fillStyle = col.bar; ctx.fillRect(-d.len / 2, -3, d.len, 6);
                ctx.fillStyle = col.barLight; ctx.fillRect(-d.len / 2, -3, d.len, 2);
                ctx.restore();
            }
        }
        ctx.restore();
    }

    // Gaiola e cordas ficam no alto: desenhadas por cima de tudo (no passe acima da escuridão).
    drawAir(ctx) {
        if (!this.valid || this.phase === "fallen" || this.phase === "done") return;
        const col = this.cfg.colors, c = this.cagePos, W = this.cfg.width, H = this.cfg.height, px = this.cfg.art;
        const cy = this._cageY();
        const [p1, p2] = this.api.getPlayers();
        const chain = this.api.chain;
        ctx.save();
        for (const r of this.ropes) {
            const attachX = c.x + Math.sign(r.x - c.x) * W * 0.45, attachY = cy + H * 0.1;
            let near = false;
            if (!r.cut && this.phase === "active" && chain.isConnected) {
                near = Physics.distToSegment(r.x, r.y, p1.x, p1.y, p2.x, p2.y) < this.cfg.nearRadius;
            }
            const wob = near ? Math.sin(this._pulse * 0.9) * 3 : 0;
            if (!r.cut) {
                if (near) { ctx.strokeStyle = col.glow; ctx.lineWidth = 10; this._rope(ctx, r.x, r.y - 8, attachX, attachY, wob); }
                ctx.strokeStyle = col.ropeDark; ctx.lineWidth = 5; this._rope(ctx, r.x, r.y - 8, attachX, attachY, wob);
                ctx.strokeStyle = col.rope; ctx.lineWidth = 2; this._rope(ctx, r.x, r.y - 9, attachX, attachY - 1, wob);
            } else {
                const k = 1 - r.cutT * 0.7;
                ctx.strokeStyle = col.rope; ctx.lineWidth = 3;
                this._rope(ctx, attachX, attachY, attachX + (r.x - attachX) * 0.15 * k, attachY + 40 * (1 - k * 0.3), 0);
            }
        }
        ctx.translate(c.x, cy + H / 2);
        ctx.rotate(this.tilt);
        ctx.translate(-W / 2, -H / 2);
        ctx.fillStyle = col.frame;
        ctx.fillRect(0, 0, W, 3 * px);
        ctx.fillRect(0, H - 3 * px, W, 3 * px);
        const bars = 6;
        for (let i = 0; i < bars; i++) {
            const x = Math.round((i / (bars - 1)) * (W - 2 * px));
            ctx.fillStyle = col.bar; ctx.fillRect(x, 0, 2 * px, H);
            ctx.fillStyle = col.barLight; ctx.fillRect(x, 0, px, H);
        }
        ctx.fillStyle = col.barLight;
        ctx.fillRect(0, 0, W, px);
        if (this.flashT > 0) {
            ctx.globalAlpha = this.flashT / this.cfg.flashSteps;
            ctx.fillStyle = "#fff4c8";
            ctx.fillRect(W * 0.3, H - 3 * px, W * 0.4, 3 * px);
        }
        ctx.restore();
    }

    _rope(ctx, x1, y1, x2, y2, wob) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo((x1 + x2) / 2 + wob, (y1 + y2) / 2 + 10 + wob, x2, y2);
        ctx.stroke();
    }
}
