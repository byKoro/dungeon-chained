import { DIALOGUE } from '../config/DialogueConfig.js';
import { TILE } from '../config/GameConfig.js';
import { t } from '../i18n/I18n.js';
import { renderSpeechBubble } from '../ui/SpeechBubble.js';

const clamp01 = v => Math.max(0, Math.min(1, v));

// Balões de fala acima do jogador que fala. Uma fala por vez, em fila; o texto entra letra a letra,
// avança por tempo e interagir (qualquer jogador) completa o texto ou pula para a próxima.
export class DialogueSystem {
    constructor({ getPlayers, input = null, audio = null, onLineStart = null, onBlip = null, cfg = DIALOGUE, translate = t }) {
        Object.assign(this, { getPlayers, input, audio, onLineStart, onBlip, cfg, translate });
        this._bubble = null;
        this.clear();
    }

    clear() {
        this.queue = [];
        this.line = null;
        this._gap = 0;
        this._held = this.cfg.interactKeys.map(() => true);
    }

    get active() {
        return !!this.line || this.queue.length > 0;
    }

    // `who` = índice do jogador (0 = Amarelo, 1 = Azul) ou o próprio Player.
    say(who, key, { vars = null, expr = this.cfg.defaultExpr } = {}) {
        if (!this.cfg.enabled) return false;
        const index = typeof who === "number" ? who : (this.getPlayers() || []).indexOf(who);
        if (index < 0) return false;
        this.queue.push({ index, key, text: this.translate(key, vars), expr });
        return true;
    }

    _start(item) {
        const len = item.text.length;
        this.line = { ...item, t: 0, shown: 0, typed: false, hold: this.cfg.holdBase + len * this.cfg.holdPerChar, doneAt: null };
        this.onLineStart?.(item.index, item.expr, len / this.cfg.charsPerSecond + this.line.hold);
    }

    _interactTapped() {
        if (!this.input) return false;
        let tapped = false;
        this.cfg.interactKeys.forEach((k, i) => {
            const down = !!this.input.isDown(k);
            if (down && !this._held[i]) tapped = true;
            this._held[i] = down;
        });
        return tapped;
    }

    update(dt) {
        const tapped = this._interactTapped();
        if (!this.line) {
            if (this._gap > 0) { this._gap -= dt; return; }
            if (!this.queue.length) return;
            this._start(this.queue.shift());
        }
        const line = this.line;
        line.t += dt;
        if (tapped) {
            if (!line.typed) {
                // Completar o texto não toca os blips que faltavam (todos no mesmo step).
                line.t = Math.max(line.t, line.text.length / this.cfg.charsPerSecond);
                line.shown = line.text.length;
            } else line.doneAt = -Infinity;
        }
        const n = Math.min(line.text.length, Math.floor(line.t * this.cfg.charsPerSecond));
        for (let i = line.shown; i < n; i++) {
            if (line.text[i] === " " || i % this.cfg.blipEveryChars) continue;
            this._blip(line.index, i);
        }
        line.shown = n;
        if (!line.typed && n >= line.text.length) { line.typed = true; line.doneAt = line.t + line.hold; }
        if (line.typed && line.t >= line.doneAt + this.cfg.fadeOut) {
            this.line = null;
            this._gap = this.cfg.gapSeconds;
        }
    }

    _blip(index, i) {
        const base = this.cfg.blipRates[index] ?? 1;
        const jitter = 1 + this.cfg.blipJitter * ((i * 7) % 3 - 1);
        this.audio?.play("voiceBlip", { rateMultiplier: base * jitter });
        this.onBlip?.(index);
    }

    _alpha(line) {
        const inK = clamp01(line.t / this.cfg.fadeIn);
        const outK = line.doneAt === null ? 1 : clamp01(1 - (line.t - line.doneAt) / this.cfg.fadeOut);
        return { inK, alpha: inK * outK };
    }

    // Espaço de tela, depois da pós-processamento (o balão não escurece com a iluminação).
    draw(ctx, renderer, canvas) {
        const line = this.line;
        const player = line && this.getPlayers()?.[line.index];
        if (!player) return;
        const color = player.color || "#ffd166";
        const key = `${line.text}|${line.shown}|${color}`;
        if (this._bubble?.key !== key) this._bubble = { key, ...renderSpeechBubble(line.text, color, line.shown) };
        const { canvas: art, tipX, tipY } = this._bubble;

        const scr = renderer.worldToScreen(player.x, player.y - this.cfg.headOffset);
        const P = Math.max(2, Math.round((TILE / 16) * scr.zoom));
        const { inK, alpha } = this._alpha(line);
        const dw = art.width * P, dh = art.height * P;
        const rise = Math.round((1 - inK) * 3) * P;
        const dx = Math.round(Math.max(8, Math.min(scr.x - tipX * P, canvas.width - dw - 8)));
        const dy = Math.round(Math.max(8, scr.y - tipY * P + rise));

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(art, dx, dy, dw, dh);
        ctx.restore();
    }
}
