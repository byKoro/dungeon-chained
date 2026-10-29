import { CAGE } from '../config/EventsConfig.js';
import { Physics } from '../core/Physics.js';
import { ANIMATED_PROPS } from '../config/PropConfig.js';

const easeIn = k => k * k;

// Distância entre dois segmentos (0 se cruzam).
function segDist(ax, ay, bx, by, cx, cy, dx, dy) {
    const o = (px, py, qx, qy, rx, ry) => Math.sign((qx - px) * (ry - py) - (qy - py) * (rx - px));
    if (o(ax, ay, bx, by, cx, cy) !== o(ax, ay, bx, by, dx, dy) && o(cx, cy, dx, dy, ax, ay) !== o(cx, cy, dx, dy, bx, by)) return 0;
    return Math.min(
        Physics.distToSegment(ax, ay, cx, cy, dx, dy), Physics.distToSegment(bx, by, cx, cy, dx, dy),
        Physics.distToSegment(cx, cy, ax, ay, bx, by), Physics.distToSegment(dx, dy, ax, ay, bx, by)
    );
}

// Cordas verticais amarradas em estacas no chão, cada uma segurando uma gaiola lá no alto (fora da tela).
// Os dois entram na zona → a corda `auto` arrebenta sozinha e as grades descem. Cortar uma corda (cabo ou disco
// passando pelo trecho de baixo dela) solta a gaiola daquele ponto: ela despenca, estilhaça no chão e a leva do
// número do corte sai dos destroços. Todas as cordas cortadas e nenhum inimigo vivo → o baú do encontro abre e as
// grades sobem.
export class CageEncounter {
    constructor({ api, zoneId, encounterId, rng = Math.random, cfg = CAGE }) {
        Object.assign(this, { api, zoneId, encounterId, rng, cfg });
        const objs = api.authored.interactives || [];
        this.ropeDefs = objs.filter(o => o.type === "rope").map(o => ({ ...api.tileCenter(o.col, o.row), auto: !!o.auto }));
        if (this.ropeDefs.length && !this.ropeDefs.some(r => r.auto)) this.ropeDefs[0].auto = true;
        // Baú do encontro: prop com `encounter` igual ao id; fica escondido até o fim.
        this.chest = (api.authored.props || []).find(p => ANIMATED_PROPS[p.type]?.opens && p.encounter === encounterId) || null;
        this._restore();
        if (api.isCompleted(encounterId)) this._finishState();
    }

    get valid() {
        return this.ropeDefs.length > 0 && !!this.api.encounter(this.encounterId);
    }

    _restore() {
        this.phase = "idle";
        this.ropes = this.ropeDefs.map(r => ({ ...r, cut: false, cutT: 0, cage: null, wave: -1 }));
        this.cuts = 0;
        this.spawned = [];
        this.lastAlive = 0;
        this._pulse = 0;
        if (this.chest) this.api.chests?.setHidden(this.api.room.key, this.chest, true);
    }

    _finishState() {
        this.phase = "done";
        this.ropes.forEach(r => { r.cut = true; r.cutT = 1; });
        if (this.chest) this.api.chests?.setHidden(this.api.room.key, this.chest, false);
    }

    _alive() {
        return this.spawned.filter(e => this.api.room.enemies.includes(e) && e.state !== "dying");
    }

    get _falling() {
        return this.ropes.some(r => r.cage && !r.cage.landed);
    }

    update() {
        if (!this.valid || this.phase === "done") return;
        this._pulse++;
        for (const r of this.ropes) {
            if (r.cut && r.cutT < 1) r.cutT = Math.min(1, r.cutT + this.cfg.retractSpeed);
            if (r.cage) this._updateCage(r);
        }
        this._updateDrops();

        if (this.phase === "idle") {
            if (!this.api.bothInZone(this.zoneId)) return;
            this._start();
        }
        if (this.phase === "active") this._checkCuts();

        const alive = this._alive().length + (this._falling ? 1 : 0);
        if (this.lastAlive > 0 && alive === 0) {
            this.api.scrap?.vacuum();
            if (this.cuts === 1) this.api.dialogue?.say(1, "talk.wave1Clear");
        }
        this.lastAlive = alive;
        if (this.ropes.every(r => r.cut) && alive === 0) this._win();
    }

    _start() {
        this.phase = "active";
        this.api.setBars(true);
        this._cut(this.ropes.find(r => r.auto), { snapped: true });
        this.api.dialogue?.say(0, "talk.rope1");
    }

    // Trecho de baixo da corda (o que o cabo no chão alcança).
    _cutSegment(r) {
        const k = this._knot(r);
        return [k.x, k.y - this.cfg.cutReach, k.x, k.y];
    }

    _touches(r, radius) {
        const chain = this.api.chain, [p1, p2] = this.api.getPlayers();
        const w = chain.weapon;
        const [ax, ay, bx, by] = this._cutSegment(r);
        if (chain.isConnected) {
            if (segDist(ax, ay, bx, by, p1.x, p1.y, p2.x, p2.y) < radius) return true;
            const disc = w.discRadius ?? 0;
            return (w.getSawPositions?.(p1, p2) || []).some(s => Physics.distToSegment(s.x, s.y, ax, ay, bx, by) < radius + disc);
        }
        return !!w.thrown && Physics.distToSegment(w.dropX, w.dropY, ax, ay, bx, by) < radius + (w.discRadius ?? 0);
    }

    _checkCuts() {
        for (const r of this.ropes) {
            if (!r.cut && this._touches(r, this.cfg.cutRadius)) { this._cut(r); break; }
        }
    }

    _cut(rope, { snapped = false } = {}) {
        if (!rope || rope.cut) return;
        rope.cut = true;
        rope.cutT = 0;
        this.cuts++;
        rope.wave = this.cuts - 1;
        rope.cage = { t: 0, landed: false, debrisT: 0, spin: (this.rng() - 0.5) * this.cfg.fallSpin };
        const k = this._knot(rope);
        this.api.audio?.play("sawSnap", { rateMultiplier: snapped ? 0.8 : 1.1 });
        this.api.renderer?.triggerShake(snapped ? this.cfg.snapShake : this.cfg.cutShake);
        this.api.particleSystem?.triggerSparkBurst?.(k.x, k.y - this.cfg.cutReach * 0.5, 12, 8, 0.9);
    }

    _updateCage(r) {
        const c = r.cage;
        if (!c.landed) {
            c.t++;
            if (c.t >= this.cfg.fallSteps) this._impact(r);
        } else if (c.debrisT > 0) c.debrisT--;
    }

    _ground(r) {
        return { x: r.x, y: r.y + this.cfg.sprite.groundOffset };
    }

    // A gaiola bate no chão e estilhaça; os monstros saem dos destroços.
    _impact(r) {
        const c = r.cage, g = this._ground(r), ps = this.api.particleSystem;
        c.landed = true;
        c.debrisT = this.cfg.debrisSteps;
        this.api.renderer?.triggerShake(this.cfg.impactShake);
        this.api.audio?.play("sawSnap", { rateMultiplier: 0.6 });
        this.api.audio?.play("sawLand", { rateMultiplier: 0.7 });
        ps?.triggerSparkBurst?.(g.x, g.y - 20, 30, 16, 1.2);
        ps?.triggerFlash?.(g.x, g.y - 20, 12, 0.8);
        for (let i = 0; i < this.cfg.landDust; i++) {
            const a = (i / this.cfg.landDust) * Math.PI * 2;
            ps?.triggerDust?.(g.x + Math.cos(a) * 30, g.y + Math.sin(a) * 12, Math.cos(a), Math.sin(a), 2);
        }
        this.api.scrap?.spawnBurst(g.x, g.y - 16, this.cfg.brokenScrap);
        this._spawnWave(r.wave, r);
    }

    _spawnWave(index, at) {
        const wave = this.api.encounter(this.encounterId)?.waves?.[index];
        if (!wave) return;
        let n = 0;
        for (const group of wave) {
            for (let i = 0; i < group.count; i++, n++) {
                const a = this.rng() * Math.PI * 2;
                const d = this.cfg.landMin + this.rng() * (this.cfg.landMax - this.cfg.landMin);
                const e = this.api.spawnEnemy(group.type, at.x + Math.cos(a) * d, at.y + Math.sin(a) * d * 0.7, n * this.cfg.dropStagger);
                if (e) this.spawned.push(e);
            }
        }
    }

    // Os monstros surgem dos destroços (revelação de baixo para cima) e depois voltam a agir.
    _updateDrops() {
        for (const e of this.spawned) {
            if (e.justAppeared) {
                const ps = this.api.particleSystem;
                for (let i = 0; i < 4; i++) {
                    const a = (i / 4) * Math.PI * 2;
                    ps?.triggerDust?.(e.x + Math.cos(a) * 12, (e.footY ?? e.y + 20) + Math.sin(a) * 5, Math.cos(a), Math.sin(a), 1);
                }
            }
            if (e.frozen && !e.isHidden && !(e.spawnFx > 0)) e.unfreeze?.();
        }
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

    // Onde a corda sai da estaca (nas voltas de corda do sprite).
    _knot(r) {
        const A = this.cfg.art, s = this.cfg.sprite;
        return { x: r.x, y: r.y + s.stakeFoot - (s.stakeH - s.knotY) * A };
    }

    drawFloor(ctx) {
        if (!this.valid) return;
        const A = this.cfg.art, s = this.cfg.sprite, col = this.cfg.colors;
        const stake = this._img("ropeStake"), broken = this._img("cageBroken");
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const r of this.ropes) {
            const g = this._ground(r), cage = r.cage;
            if (cage && !cage.landed) {
                const k = easeIn(cage.t / this.cfg.fallSteps);
                ctx.fillStyle = col.shadow;
                ctx.beginPath();
                ctx.ellipse(g.x, g.y, this.cfg.width * (0.15 + k * 0.32), this.cfg.width * (0.06 + k * 0.12), 0, 0, Math.PI * 2);
                ctx.fill();
            }
            if (!cage?.landed && stake) {
                ctx.drawImage(stake, Math.round(r.x - s.stakeW * A / 2), Math.round(r.y + s.stakeFoot - s.stakeH * A), s.stakeW * A, s.stakeH * A);
                if (r.cut) this._ropeEnd(ctx, this._knot(r), 0);
            }
            if (cage?.landed && cage.debrisT > 0 && broken) {
                ctx.globalAlpha = Math.min(1, cage.debrisT / 60);
                const w = broken.naturalWidth * A, h = broken.naturalHeight * A;
                ctx.drawImage(broken, Math.round(g.x - w / 2), Math.round(g.y - h + 8), w, h);
                ctx.globalAlpha = 1;
            }
        }
        ctx.restore();
    }

    // Cordas subindo para fora da tela e gaiolas caindo: por cima de tudo (no passe acima da escuridão).
    drawAir(ctx) {
        if (!this.valid || this.phase === "done") return;
        const A = this.cfg.art, s = this.cfg.sprite;
        const img = this._img("cageHang");
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const r of this.ropes) {
            const knot = this._knot(r);
            const top = { x: r.x, y: knot.y - this.cfg.ropeUp };
            if (!r.cut) {
                const sway = Math.sin(this._pulse * 0.03 + r.x * 0.01) * this.cfg.swayAmp;
                const near = this.phase === "active" && this._touches(r, this.cfg.nearRadius);
                const wob = sway + (near ? Math.sin(this._pulse * 0.9) * 3 : 0);
                if (near) {
                    ctx.strokeStyle = this.cfg.colors.glow;
                    ctx.lineWidth = s.ropeThick + 8;
                    ctx.lineCap = "round";
                    ctx.beginPath();
                    ctx.moveTo(knot.x, knot.y);
                    ctx.lineTo(knot.x, knot.y - this.cfg.cutReach);
                    ctx.stroke();
                }
                this._ropeAlong(ctx, knot, top, wob, this.cfg.ropeFade);
            } else if (r.cutT < 1) {
                // A parte de cima chicoteia para o alto e some.
                const end = { x: r.x, y: knot.y - this.cfg.cutReach * 0.5 - this.cfg.ropeUp * easeIn(r.cutT) };
                this._ropeAlong(ctx, end, top, 0, Math.max(0, (this.cfg.ropeFade * this.cfg.ropeUp - (knot.y - end.y)) / Math.max(1, end.y - top.y)));
                this._ropeEnd(ctx, end, 0);
            }
            if (r.cage && !r.cage.landed && img) {
                const k = r.cage.t / this.cfg.fallSteps;
                const g = this._ground(r);
                const bottom = g.y - this.cfg.fallHeight * (1 - easeIn(k));
                ctx.save();
                ctx.translate(g.x, bottom - s.bodyBottom * A / 2);
                ctx.rotate(r.cage.spin * k);
                ctx.drawImage(img, -s.w * A / 2, -s.bodyBottom * A / 2, s.w * A, img.naturalHeight * A);
                ctx.restore();
            }
        }
        ctx.restore();
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
