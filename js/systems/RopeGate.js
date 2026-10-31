import { ROPE_GATE, BARS } from '../config/EventsConfig.js';
import { StakeRopeArt, sawGap, clamp01 } from './StakeRope.js';

// Cordas com grade (interativo `gateRope`) de qualquer sala do Editor 2.0. A estaca guarda os tiles da grade
// (`gate:[{col,row}]`, escolhidos no editor). Enquanto não cortada, esses tiles são uma grade levadiça fechada
// (sólida, bloqueando a passagem). Um disco girando na estaca corta a corda e a grade sobe, liberando o caminho.
// O corte sobrevive à morte da dupla (igual à corda com baú).
export class RopeGate {
    constructor({ api, cfg = ROPE_GATE } = {}) {
        this.api = api;
        this.cfg = cfg;
        this.art = new StakeRopeArt(cfg, () => api.assets);
        this._pulse = 0;
        this.ropes = (api.authored.interactives || []).filter(o => o.type === "gateRope").map(o => {
            const gate = (Array.isArray(o.gate) ? o.gate : []).filter(t => Number.isInteger(t.col) && Number.isInteger(t.row));
            const rope = {
                id: o.id, col: o.col, row: o.row, ...api.tileCenter(o.col, o.row),
                gate, cut: false, cutT: 0, flash: 0,
                // raise: 0 = grade fechada no chão (sólida), 1 = recolhida na verga (aberta).
                raise: 0
            };
            // Corte já salvo (sobreviveu à morte): grade já aberta.
            if (api.isCompleted(this._key(rope))) { rope.cut = true; rope.cutT = 1; rope.raise = 1; }
            return rope;
        });
    }

    get valid() {
        return this.ropes.length > 0;
    }

    _key(r) {
        return `gate:${r.id}`;
    }

    _near(r) {
        return r.cut ? 0 : clamp01(1 - sawGap(this.api.chain, this.api.getPlayers(), this.art.stakePoint(r)) / this.cfg.nearRadius);
    }

    update() {
        this._pulse++;
        for (const r of this.ropes) {
            if (r.cut && r.cutT < 1) r.cutT = Math.min(1, r.cutT + this.cfg.retractSpeed);
            if (r.cut && r.raise < 1) {
                const was = r.raise;
                r.raise = Math.min(1, r.raise + 1 / this.cfg.raiseSteps);
                if (was < 1 && r.raise >= 1) this.api.renderer?.triggerShake(BARS.shake / 3);
            }
            if (r.flash > 0) r.flash--;
            if (!r.cut && sawGap(this.api.chain, this.api.getPlayers(), this.art.stakePoint(r)) < this.cfg.stakeRadius) this._cut(r);
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
        // A grade sobe: rangido grave + clangor leve, como as grades levadiças ao abrir.
        this.api.audio?.play("buttonRelease", { rateMultiplier: 0.5 });
        this.api.audio?.play("forgeHammer", { rateMultiplier: 0.5, volumeMultiplier: 0.4 });
        this.api.renderer?.triggerShake(c.shake);
        this.api.renderer?.triggerZoomPunch?.(c.zoomPunch);
        this.api.hitStop?.(c.hitStop);
        this.api.particleSystem?.triggerSparkBurst?.(s.x, s.y, 14, c.sparks, 1.1);
        this.api.particleSystem?.triggerFlash?.(s.x, s.y, 8, 0.9);
    }

    onDeath() {
        // O corte está salvo em `completed`; nada a desfazer. A grade cortada continua aberta.
    }

    // ---------- colisão ----------

    // A estaca é um poste sólido (fica mesmo depois do corte).
    solidCircles() {
        return this.ropes.map(r => this.art.solidCircle(r));
    }

    // Tiles da grade: sólidos enquanto a grade ainda está baixa o bastante (igual BARS.solidAt, invertido pelo raise).
    solidBoxes() {
        const r = this.api.rect(), T = this.api.tile, boxes = [];
        for (const rope of this.ropes) {
            if (rope.raise >= 1 - BARS.solidAt) continue;
            for (const t of rope.gate) boxes.push({ x: r.x + t.col * T, y: r.y + t.row * T, w: T, h: T });
        }
        return boxes;
    }

    // ---------- luz ----------

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

    // ---------- desenho ----------

    drawFloor(ctx) {
        const hasSaw = !!this.api.chain?.hasSaw;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const r of this.ropes) {
            if (!r.cut && hasSaw) this.art.ring(ctx, r, this._near(r), this._pulse);
        }
        ctx.restore();
    }

    _top(r) {
        const knot = this.art.knot(r);
        return { x: r.x, y: knot.y - this.cfg.ropeUp };
    }

    // Estacas (ordenadas por y com as entidades) + a grade de cada corda.
    drawables() {
        const out = this.art.drawables(this.ropes, r => this._near(r), this._pulse);
        const r = this.api.rect(), T = this.api.tile;
        const all = new Set();
        for (const rope of this.ropes) for (const t of rope.gate) all.add(`${t.col},${t.row}`);
        for (const rope of this.ropes) {
            const lowered = 1 - rope.raise;
            for (const t of rope.gate) {
                const x = r.x + t.col * T, base = r.y + (t.row + 1) * T;
                const left = !all.has(`${t.col - 1},${t.row}`), right = !all.has(`${t.col + 1},${t.row}`);
                const key = left && right ? "barsFrameSingle" : left ? "barsFrameLeft" : right ? "barsFrameRight" : "barsFrameMid";
                out.push({ y: base - 14, feetSortY: base, draw: c => this._drawBar(c, key, x, base, lowered) });
            }
        }
        return out;
    }

    // Fresta no chão → treliça recortada abaixo da verga → moldura por cima. (Mesma arte das grades levadiças.)
    _drawBar(ctx, frameKey, x, base, lowered) {
        const frame = this.api.assets?.get?.(frameKey), gate = this.api.assets?.get?.("barsGate");
        if (!frame?.complete || !frame.naturalWidth || !gate?.complete || !gate.naturalWidth) return;
        const T = this.api.tile, px = T / 16, A = BARS.art;
        const top = base - A.frameH * px, opening = top + A.lintel * px;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = BARS.shadow;
        ctx.globalAlpha = 0.4 + 0.6 * lowered;
        ctx.fillRect(x, base - px, T, px);
        ctx.globalAlpha = 1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, opening, T, base - opening);
        ctx.clip();
        const lift = Math.round((1 - lowered) * A.travel) * px;
        ctx.drawImage(gate, x, base - A.gateH * px - lift, T, A.gateH * px);
        ctx.restore();
        ctx.drawImage(frame, x, top, T, A.frameH * px);
        ctx.restore();
    }

    drawAir(ctx) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const r of this.ropes) this.art.rope(ctx, r, this._top(r), this._pulse);
        ctx.restore();
    }
}
