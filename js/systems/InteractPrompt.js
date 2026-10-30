import { INTERACT_PROMPT } from '../config/InteractPromptConfig.js';

const easeOutBack = (k, s) => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
const smooth = k => k * k * (3 - 2 * k);

// Id de um prop interagível numa sala: o mesmo para o alvo do indicador e para a borda do prop.
export const propTargetId = (roomKey, prop) => `${roomKey}/${prop.col},${prop.row}`;

// Círculo flutuante sobre o que pode ser interagido (baú, bigorna). Um por jogador no alcance, na cor dele, com o
// botão do dispositivo que ele usou por último. Só desenha; quem decide o alcance são as fontes (ChestSystem, ForgeSystem),
// que devolvem alvos { id, x, topY, users: [índices], blocked }.
export class InteractPrompt {
    constructor({ sources, getDevice, sheet = null, cfg = INTERACT_PROMPT, isVisible = () => true }) {
        Object.assign(this, { sources, getDevice, sheet, cfg, isVisible });
        this.reset();
    }

    reset() {
        this._shown = new Map();
        this._glow = new Map();
    }

    // Por step: acompanha quem apareceu agora (animação de entrada) e esquece quem saiu.
    // A borda acende e apaga em alguns steps (`_glow`: k 0..1 por alvo).
    update(now) {
        const live = new Map();
        if (this.isVisible()) {
            for (const target of this.targets()) {
                live.set(target.id, target);
                if (!this._shown.has(target.id)) this._shown.set(target.id, now);
            }
        }
        for (const id of [...this._shown.keys()]) if (!live.has(id)) this._shown.delete(id);

        const o = this.cfg.outline;
        for (const [id, target] of live) {
            const g = this._glow.get(id) ?? { k: 0 };
            g.k = Math.min(1, g.k + 1 / o.fadeInSteps);
            g.blocked = !!target.blocked;
            this._glow.set(id, g);
        }
        for (const [id, g] of this._glow) {
            if (live.has(id)) continue;
            g.k -= 1 / o.fadeOutSteps;
            if (g.k <= 0) this._glow.delete(id);
        }
    }

    // Borda pedida ao desenho do prop, ou null. Bloqueado fica com a mesma transparência do ícone.
    outlineFor(id) {
        const g = this._glow.get(id);
        if (!g || !this.isVisible()) return null;
        return { alpha: smooth(g.k) * (g.blocked ? this.cfg.blockedAlpha : 1), color: this.cfg.outline.color };
    }

    targets() {
        return this.sources.flatMap(source => source() || []);
    }

    // Coluna do ícone do jogador na folha (0-7 = normal; +1 = pressionado).
    columnFor(userIndex) {
        const device = this.getDevice(userIndex);
        const name = device === "xbox" || device === "playstation" ? device : (this.cfg.keyboardIcon[userIndex] ?? "keyboardE");
        return this.cfg.columns[name];
    }

    // Quadros pedidos ao desenho, sem tocar no canvas (testável): { x, y, scale, column, row, blocked, alpha }.
    layout(now) {
        const c = this.cfg, out = [];
        if (!this.isVisible()) return out;
        for (const target of this.targets()) {
            const since = this._shown.get(target.id);
            if (since === undefined) continue;
            const k = Math.min(1, (now - since) / c.popMs);
            const scale = k >= 1 ? 1 : easeOutBack(k, c.popOvershoot);
            const bob = Math.sin((now / c.bobPeriodMs) * Math.PI * 2) * c.bobAmplitude;
            const pressed = Math.floor(now / (c.pulsePeriodMs / 2)) % 2 === 1;
            const size = c.cell * c.pixelScale;
            const users = target.users;
            users.forEach((user, i) => {
                const offset = (i - (users.length - 1) / 2) * (size + c.pairSpacing);
                out.push({
                    x: target.x + offset,
                    y: target.topY - c.gap - size / 2 + bob,
                    scale,
                    column: this.columnFor(user) + (pressed && !target.blocked ? 1 : 0),
                    row: user === 0 ? 0 : 1,
                    blocked: !!target.blocked,
                    alpha: target.blocked ? c.blockedAlpha : 1
                });
            });
        }
        return out;
    }

    draw(ctx, now) {
        const img = this.sheet;
        if (!img?.complete || !img.naturalWidth) return;
        const c = this.cfg, size = c.cell * c.pixelScale;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        for (const f of this.layout(now)) {
            const w = Math.round(size * f.scale);
            const dx = Math.round(f.x - w / 2), dy = Math.round(f.y - w / 2);
            ctx.globalAlpha = f.alpha;
            ctx.drawImage(img, f.column * c.cell, f.row * c.cell, c.cell, c.cell, dx, dy, w, w);
            if (f.blocked) {
                ctx.globalAlpha = 1;
                ctx.drawImage(img, c.columns.blocked * c.cell, f.row * c.cell, c.cell, c.cell, dx, dy, w, w);
            }
        }
        ctx.restore();
    }
}
