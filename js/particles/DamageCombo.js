import { DAMAGE_COMBO } from '../config/CombatFeelConfig.js';
import { drawText, measureText } from '../ui/PixelFont.js';

export function comboColor(total, ramp = DAMAGE_COMBO.ramp) {
    let color = ramp[0][1];
    for (const [min, c] of ramp) if (total >= min) color = c;
    return color;
}

// Total de dano dos golpes seguidos num inimigo. Acompanha o inimigo enquanto o combo está aberto; ao fechar
// (janela vencida ou morte do inimigo) fica parado, espera e some. Tempo em passos de simulação.
export class DamageCombo {
    constructor(target, top, amount, opts = {}) {
        this.target = target;
        this.dy = top - (target?.y ?? top);
        this.x = target?.x ?? 0;
        this.y = top - DAMAGE_COMBO.offsetY;
        this.total = 0;
        this.hits = 0;
        this.idle = 0;
        this.closedFor = -1;
        this.popAge = DAMAGE_COMBO.popSteps;
        this.add(amount, top, opts);
    }

    get open() {
        return this.closedFor < 0;
    }

    get visible() {
        return this.hits >= DAMAGE_COMBO.minHits;
    }

    get done() {
        const c = DAMAGE_COMBO;
        return !this.open && (!this.visible || this.closedFor >= c.holdSteps + c.fadeSteps);
    }

    get color() {
        return comboColor(this.total);
    }

    add(amount, top, { killed = false } = {}) {
        this.total += Math.max(0, Math.round(amount));
        this.hits++;
        this.idle = 0;
        this.popAge = 0;
        this.dy = top - (this.target?.y ?? top);
        this._follow();
        if (killed) this.close();
    }

    close() {
        if (this.open) this.closedFor = 0;
    }

    _follow() {
        if (!this.target) return;
        this.x = this.target.x;
        this.y = this.target.y + this.dy - DAMAGE_COMBO.offsetY;
    }

    update() {
        this.popAge++;
        if (this.open) {
            this._follow();
            if (++this.idle >= DAMAGE_COMBO.windowSteps) this.close();
        } else this.closedFor++;
    }

    draw(ctx) {
        if (!this.visible) return;
        const c = DAMAGE_COMBO;
        const fading = this.open ? 0 : Math.max(0, this.closedFor - c.holdSteps);
        const alpha = Math.max(0, 1 - fading / c.fadeSteps);
        if (alpha <= 0) return;
        const pop = this.popAge < c.popSteps ? 1 + (c.popScale - 1) * (1 - this.popAge / c.popSteps) : 1;
        const text = String(this.total);
        const w = measureText(text);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(Math.round(this.x), Math.round(this.y));
        ctx.scale(c.pixel * pop, c.pixel * pop);
        const x = -Math.floor(w / 2);
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            drawText(ctx, text, x + ox, oy, c.outline);
        }
        drawText(ctx, text, x, 0, this.color);
        ctx.restore();
    }
}
