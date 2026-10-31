import { ROPE_CHEST } from '../config/EventsConfig.js';
import { ANIMATED_PROPS } from '../config/PropConfig.js';
import { StakeRopeArt, sawGap, impactBurst, drawChestDrop, clamp01 } from './StakeRope.js';

// Cordas com baú (interativo `chestRope`) de qualquer sala do Editor 2.0. A estaca guarda o ponto de queda
// (`drop:{col,row}`, escolhido no editor; sem ele, cai na própria estaca). Um disco girando na estaca corta a corda
// e um baú gerado pelo sistema cai nesse tile, fechado, para abrir com interagir (moedas no padrão). O corte
// sobrevive à morte da dupla.
export class RopeChests {
    constructor({ api, rng = Math.random, cfg = ROPE_CHEST }) {
        Object.assign(this, { api, rng, cfg });
        this.art = new StakeRopeArt(cfg, () => api.assets);
        this._pulse = 0;
        this.ropes = (api.authored.interactives || []).filter(o => o.type === "chestRope").map(o => {
            const dropCell = this._dropCell(o);
            const at = api.tileCenter(dropCell.col, dropCell.row);
            // Baú gerado (não autorado): entra na lista viva da sala, fica escondido até pousar.
            const chest = { type: "chest", col: dropCell.col, row: dropCell.row, generated: true, ropeChest: o.id };
            const rope = {
                id: o.id, col: o.col, row: o.row, ...api.tileCenter(o.col, o.row),
                chest, dropCell, chestX: at.x, chestY: at.y, cut: false, cutT: 0, flash: 0, drop: null
            };
            api.addProp?.(chest);
            // Corte já salvo (sobreviveu à morte): o baú já está no chão, visível.
            if (api.isCompleted(this._key(rope))) { rope.cut = true; rope.cutT = 1; }
            else api.chests?.setHidden(api.room.key, chest, true);
            return rope;
        });
    }

    // Tile onde o baú cai: `drop` autorado, senão a própria estaca.
    _dropCell(o) {
        const d = o.drop;
        return d && Number.isInteger(d.col) && Number.isInteger(d.row) ? { col: d.col, row: d.row } : { col: o.col, row: o.row };
    }

    get valid() {
        return this.ropes.length > 0;
    }

    _key(r) {
        return `rope:${r.id}`;
    }

    _near(r) {
        return r.cut ? 0 : clamp01(1 - sawGap(this.api.chain, this.api.getPlayers(), this.art.stakePoint(r)) / this.cfg.nearRadius);
    }

    update() {
        this._pulse++;
        for (const r of this.ropes) {
            if (r.cut && r.cutT < 1) r.cutT = Math.min(1, r.cutT + this.cfg.retractSpeed);
            if (r.flash > 0) r.flash--;
            if (!r.cut && sawGap(this.api.chain, this.api.getPlayers(), this.art.stakePoint(r)) < this.cfg.stakeRadius) this._cut(r);
            if (r.drop) this._updateDrop(r);
        }
    }

    _cut(r) {
        const c = this.cfg.cut, s = this.art.stakePoint(r);
        r.cut = true;
        r.cutT = 0;
        r.flash = c.stakeFlashSteps;
        this.api.complete(this._key(r));
        this.api.audio?.play("sawSnap", { rateMultiplier: 1.15 });
        this.api.audio?.play("sawHit", { rateMultiplier: 0.75, volumeMultiplier: 0.6 });
        this.api.renderer?.triggerShake(c.shake);
        this.api.renderer?.triggerZoomPunch?.(c.zoomPunch);
        this.api.hitStop?.(c.hitStop);
        this.api.particleSystem?.triggerSparkBurst?.(s.x, s.y, 14, c.sparks, 1.1);
        this.api.particleSystem?.triggerFlash?.(s.x, s.y, 8, 0.9);
        r.drop = { t: -this.cfg.chest.delay, phase: "wait", x: r.chestX, ground: r.chestY + this.cfg.chestGround, col: r.chest.col, row: r.chest.row };
    }

    _updateDrop(r) {
        const d = r.drop, c = this.cfg.chest;
        d.t++;
        if (d.phase === "wait" && d.t >= 0) { d.phase = "warn"; d.t = 0; }
        else if (d.phase === "warn") {
            if (d.t % this.cfg.ceilingDustEvery === 0) {
                this.api.particleSystem?.triggerDust?.(d.x + (this.rng() - 0.5) * this.cfg.width, d.ground - this.cfg.fallHeight * 0.4, 0, 1, 1);
            }
            if (d.t >= c.warnSteps) { d.phase = "fall"; d.t = 0; }
        } else if (d.phase === "fall" && d.t >= c.fallSteps) {
            d.phase = "landed"; d.t = 0;
            this.api.audio?.play("forgeHammer", { rateMultiplier: 0.7 });
            this.api.audio?.play("sawLand", { rateMultiplier: 0.55 });
            impactBurst(this.api, d.x, d.ground, c);
        } else if (d.phase === "landed" && d.t >= c.squashSteps) {
            this._land(r);
        }
    }

    _land(r) {
        r.drop = null;
        this.api.chests?.setHidden(this.api.room.key, r.chest, false);
    }

    // Morte no meio da queda: o baú termina de cair (o corte já está salvo).
    onDeath() {
        for (const r of this.ropes) if (r.drop) this._land(r);
    }

    lights() {
        const L = this.cfg.light, out = [];
        for (const r of this.ropes) {
            if (r.cut) continue;
            const pulse = 0.85 + 0.15 * Math.sin(this._pulse * 0.08 + r.x);
            out.push({ ...this.art.stakePoint(r), radius: (L.idleRadius + (L.nearRadius - L.idleRadius) * this._near(r)) * pulse });
            const knot = this.art.knot(r), top = this._top(r);
            for (const f of L.ropeAt) out.push({ x: knot.x + (top.x - knot.x) * f, y: knot.y + (top.y - knot.y) * f, radius: L.ropeRadius });
        }
        return out;
    }

    solidCircles() {
        return this.ropes.map(r => this.art.solidCircle(r));
    }

    drawables() {
        return this.art.drawables(this.ropes, r => this._near(r), this._pulse);
    }

    drawFloor(ctx) {
        // O anel "passe a serra aqui" só aparece quando a dupla já tem a serra.
        const hasSaw = !!this.api.chain?.hasSaw;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const r of this.ropes) {
            if (!r.cut && hasSaw) this.art.ring(ctx, r, this._near(r), this._pulse);
            const d = r.drop;
            if (d && (d.phase === "warn" || d.phase === "fall")) {
                this.art.shadow(ctx, d.x, d.ground, this.art.fallK(d, this.cfg.chest.warnSteps, this.cfg.chest.fallSteps));
            }
        }
        ctx.restore();
    }

    // Alto da corda: acima do ponto de queda.
    _top(r) {
        const knot = this.art.knot(r);
        return { x: r.chestX, y: Math.min(knot.y, r.chestY) - this.cfg.ropeUp };
    }

    drawAir(ctx) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const r of this.ropes) {
            this.art.rope(ctx, r, this._top(r), this._pulse);
            if (r.drop) drawChestDrop(ctx, this.api, r.chest, r.drop, this.cfg.chest);
        }
        ctx.restore();
    }
}
