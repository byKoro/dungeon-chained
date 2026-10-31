import { drawText, measureText } from './PixelFont.js';
import { FRAME, pixelScale } from './PixelButton.js';
import { promptFor, samePrompt, promptWidth, drawPrompt } from './ButtonPrompt.js';
import { BUTTON_PROMPT } from '../config/ButtonPromptConfig.js';
import { t } from '../i18n/I18n.js';

// Tutorial rápido que salta ao ganhar uma habilidade (ex.: o dash, ao pegar as botas). Painel de pedra no estilo do
// menu da bigorna, no topo-centro da tela. Não pausa o jogo: some sozinho depois do hold ou ao usar a habilidade.
// Corpo: um "vídeo" (sala do jogo renderizada ao vivo por uma demo do kit do trailer) ou, sem demo, texto.
// Embaixo, o botão da ação no dispositivo de cada jogador; ele afunda junto com a ação do vídeo.
// Novo tutorial = uma entrada em CARDS (+ uma demo com `restart/update/render/size/scaleFor/pressed`).
const CARDS = {
    "ability.dash": { action: "dash", demo: () => import('./DashDemo.js').then(m => m.DashDemo) }
};

const COLORS = { text: "#efe3c2", gold: "#ffd166", shadow: "#000" };
const PAD = 6;
const TITLE_Y = 6;
const BODY_Y = 18;
const WELL_Y = 16;          // topo do poço do vídeo (px de arte do painel)
const ROW_GAP = 4;          // entre o corpo e a linha do botão
const TAG_GAP = 3;          // entre "P1" e o botão
const GROUP_GAP = 10;       // entre os botões de P1 e P2
const TEXT_HOLD_MS = 4000;
const VIDEO_HOLD_MS = 9500;  // dá tempo de ver o loop do vídeo duas vezes
const FADE_MS = 260;

export class AbilityCard {
    constructor({ getDevice = () => "keyboard", now = () => performance.now(), assets = null,
        playerColors = BUTTON_PROMPT.playerColors } = {}) {
        this.getDevice = getDevice;
        this.now = now;
        this.assets = assets;
        this.playerColors = playerColors;
        this._canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
        this._demos = new Map();
        this._loading = new Set();
        this.reset();
    }

    reset() {
        this.active = false;
        this.key = null;
        this.shownAt = -Infinity;
        this.dismissedAt = -Infinity;
        this._lastDraw = null;
    }

    show(key) {
        this.active = true;
        this.key = key;
        this.shownAt = this.now();
        this.dismissedAt = -Infinity;
        this._lastDraw = null;
        if (this._hasVideo) { this._ensureDemo(); this._demo?.restart(); }
    }

    dismiss() {
        if (this.active && this.dismissedAt === -Infinity) this.dismissedAt = this.now();
    }

    get _card() { return CARDS[this.key] ?? null; }
    get _hasVideo() { return !!this._card?.demo && !!this.assets; }
    get _demo() { return this._demos.get(this.key) ?? null; }

    // Botões a mostrar: um só se os dois jogadores apertam o mesmo; senão um por jogador (com etiqueta P1/P2).
    prompts() {
        const action = this._card?.action;
        if (!action) return [];
        const [a, b] = [0, 1].map(i => promptFor(action, this.getDevice(i), i));
        if (!a) return [];
        return samePrompt(a, b) ? [{ player: null, prompt: a }] : [{ player: 0, prompt: a }, { player: 1, prompt: b }];
    }

    // Só no navegador: carrega a demo sob demanda (os testes em node não precisam do kit do trailer).
    _ensureDemo() {
        const key = this.key;
        if (this._demos.has(key) || this._loading.has(key) || typeof document === "undefined") return;
        this._loading.add(key);
        this._card.demo().then(Demo => {
            this._demos.set(key, new Demo(this.assets));
        }).catch(err => console.error(err)).finally(() => this._loading.delete(key));
    }

    _alpha() {
        const now = this.now();
        if (this.dismissedAt !== -Infinity) {
            const k = 1 - (now - this.dismissedAt) / FADE_MS;
            if (k <= 0) { this.active = false; return 0; }
            return k;
        }
        const age = now - this.shownAt;
        if (age >= (this._hasVideo ? VIDEO_HOLD_MS : TEXT_HOLD_MS)) { this.dismissedAt = now; return 1; }
        return Math.min(1, age / 120);
    }

    _pressed(video) {
        if (video) return !!this._demo?.pressed;
        const half = BUTTON_PROMPT.pulsePeriodMs / 2;
        return Math.floor((this.now() - this.shownAt) / half) % 2 === 1;
    }

    draw(ctx, canvas) {
        if (!this.active || !this._canvas) return;
        const alpha = this._alpha();
        if (alpha <= 0) return;
        const now = this.now();
        const dt = this._lastDraw === null ? 0 : (now - this._lastDraw) / 1000;
        this._lastDraw = now;

        const s = pixelScale();
        const video = this._hasVideo ? this._videoFrame(canvas, dt) : null;
        const art = this._render(video, s);
        const dw = art.width * s, dh = art.height * s;
        // Abaixo do contador de sucata (topo-centro).
        const dx = Math.round((canvas.width - dw) / 2), dy = Math.round(canvas.height * 0.1);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(art, dx, dy, dw, dh);
        if (video) {
            const wellW = (art.width - 1 - 8) * s;
            ctx.drawImage(video.img, dx + 4 * s + Math.round((wellW - video.w) / 2), dy + WELL_Y * s, video.w, video.h);
        }
        ctx.restore();
    }

    // Quadro do vídeo: o recorte da sala em escala inteira de arte, ~metade da altura da tela.
    _videoFrame(canvas, dt) {
        const demo = this._demo;
        if (!demo) return null;
        const k = demo.constructor.scaleFor(canvas.width * 0.62, canvas.height * 0.5);
        const { w, h } = demo.size(k);
        demo.update(dt);
        return { img: demo.render(w, h, k), w, h };
    }

    _rowWidth(items) {
        return items.reduce((sum, it, i) => sum + (i ? GROUP_GAP : 0)
            + (it.player === null ? 0 : measureText(`P${it.player + 1}`) + TAG_GAP) + promptWidth(it.prompt), 0);
    }

    _render(video, s) {
        const title = t(`${this.key}.title`);
        const items = this.prompts();
        const rowW = this._rowWidth(items), rowH = items.length ? BUTTON_PROMPT.cell : 0;
        const c = this._canvas;
        let w, h, rowY, body = null;
        if (this._hasVideo) {
            // Sem o quadro ainda (carregando): mantém o tamanho do card estável usando o tamanho padrão.
            const vw = video ? Math.ceil(video.w / s) : 140, vh = video ? Math.ceil(video.h / s) : 82;
            w = Math.max(measureText(title) + PAD * 2, vw + 8, rowW + PAD * 2);
            rowY = WELL_Y + vh + ROW_GAP;
        } else {
            body = t(`${this.key}.body`);
            w = Math.max(measureText(title), measureText(body), rowW) + PAD * 2 + 4;
            rowY = BODY_Y + 10;
        }
        h = rowY + rowH + (rowH ? 3 : 0);
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
        if (this._hasVideo) {
            rect(3, WELL_Y - 1, w - 6, rowY - ROW_GAP - WELL_Y + 2, FRAME.outline);
            rect(4, WELL_Y, w - 8, rowY - ROW_GAP - WELL_Y, FRAME.well);
        } else {
            rect(3, 3, w - 6, rowY - 4, FRAME.well);
        }
        text(title, Math.round((w - measureText(title)) / 2), TITLE_Y, COLORS.gold);
        if (body) text(body, Math.round((w - measureText(body)) / 2), BODY_Y, COLORS.text);

        const sheet = this.assets?.get?.("buttonPrompts");
        const pressed = this._pressed(video);
        let x = Math.round((w - rowW) / 2);
        items.forEach((it, i) => {
            if (i) x += GROUP_GAP;
            if (it.player !== null) {
                const tag = `P${it.player + 1}`;
                text(tag, x, rowY + 5, this.playerColors[it.player] ?? COLORS.text);
                x += measureText(tag) + TAG_GAP;
            }
            x += drawPrompt(g, sheet, it.prompt, x, rowY, pressed);
        });
        return c;
    }
}
