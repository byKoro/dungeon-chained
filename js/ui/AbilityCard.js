import { drawText, measureText } from './PixelFont.js';
import { FRAME, pixelScale } from './PixelButton.js';
import { t } from '../i18n/I18n.js';

// Telinha curta que salta ao ganhar uma habilidade (ex.: o dash, ao pegar as botas). Painel de pedra no estilo
// do menu da bigorna, no topo-centro da tela. Não pausa o jogo: some sozinha depois de `holdMs` ou ao usar a
// habilidade (dismiss()). Texto mínimo: título + uma linha com o botão do dispositivo resolvido em `{btn}`.
const COLORS = { text: "#efe3c2", gold: "#ffd166", shadow: "#000" };
const PAD = 6;
const TITLE_Y = 6;
const BODY_Y = 18;
const HOLD_MS = 4000;
const FADE_MS = 260;

// Rótulo curto do botão de dash por dispositivo (P1/P2 no teclado usam teclas diferentes).
function dashButtonLabel(device, playerIndex) {
    if (device === "xbox") return "A";
    if (device === "playstation") return "X";
    return playerIndex === 1 ? "Enter" : "Espaço";
}

export class AbilityCard {
    constructor({ getDevice = () => "keyboard", now = () => performance.now() } = {}) {
        this.getDevice = getDevice;
        this.now = now;
        this._canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
        this.reset();
    }

    reset() {
        this.active = false;
        this.key = null;
        this.btn = "";
        this.shownAt = -Infinity;
        this.dismissedAt = -Infinity;
    }

    // `key` = prefixo i18n: usa `${key}.title` e `${key}.body` (com {btn}). `playerIndex` escolhe o botão do dispositivo.
    show(key, playerIndex = 0) {
        this.active = true;
        this.key = key;
        this.btn = dashButtonLabel(this.getDevice(playerIndex), playerIndex);
        this.shownAt = this.now();
        this.dismissedAt = -Infinity;
    }

    // Usar a habilidade fecha o card (ex.: primeiro dash).
    dismiss() {
        if (this.active && this.dismissedAt === -Infinity) this.dismissedAt = this.now();
    }

    // 0..1 de opacidade; 0 = encerrou (desativa).
    _alpha() {
        const now = this.now();
        if (this.dismissedAt !== -Infinity) {
            const k = 1 - (now - this.dismissedAt) / FADE_MS;
            if (k <= 0) { this.active = false; return 0; }
            return k;
        }
        const age = now - this.shownAt;
        if (age >= HOLD_MS) { this.dismissedAt = now; return 1; }
        // Pop de entrada rápido.
        return Math.min(1, age / 120);
    }

    draw(ctx, canvas) {
        if (!this.active || !this._canvas) return;
        const alpha = this._alpha();
        if (alpha <= 0) return;
        const art = this._render();
        const s = pixelScale();
        const dw = art.width * s, dh = art.height * s;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(art, Math.round((canvas.width - dw) / 2), Math.round(canvas.height * 0.12), dw, dh);
        ctx.restore();
    }

    _render() {
        const title = t(`${this.key}.title`);
        const body = t(`${this.key}.body`, { btn: this.btn });
        const w = Math.max(measureText(title), measureText(body)) + PAD * 2 + 4;
        const h = BODY_Y + 10;
        const c = this._canvas;
        c.width = w + 1; c.height = h + 1;
        const g = c.getContext("2d");
        g.clearRect(0, 0, c.width, c.height);
        const rect = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); };
        const chamfer = (x, y, ww, hh, col) => { rect(x + 1, y, ww - 2, hh, col); rect(x, y + 1, ww, hh - 2, col); };
        const text = (str, x, y, col) => { drawText(g, str, x, y + 1, COLORS.shadow); drawText(g, str, x, y, col); };

        g.globalAlpha = 0.5; chamfer(1, 1, w, h, "#000"); g.globalAlpha = 1;
        chamfer(0, 0, w, h, FRAME.outline);
        chamfer(1, 1, w - 2, h - 2, FRAME.stone);
        rect(2, 1, w - 4, 1, FRAME.stoneLight);
        rect(2, h - 2, w - 4, 1, FRAME.stoneDark);
        rect(3, 3, w - 6, h - 6, FRAME.well);

        text(title, Math.round((w - measureText(title)) / 2), TITLE_Y, COLORS.gold);
        text(body, Math.round((w - measureText(body)) / 2), BODY_Y, COLORS.text);
        return c;
    }
}
