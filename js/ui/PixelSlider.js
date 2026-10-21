/**
 * PixelSlider — slider de VOLUME em pixel art, no mesmo padrão dos botões
 * (PixelButton): moldura de pedra chanfrada com rebites, poço escuro e uma
 * face de pedra. Na face: alto-falante (1–2 ondas conforme o volume; "x" no
 * mudo), trilho afundado com o preenchimento VERMELHO (cor da ação principal)
 * e um puxador de ferro.
 *
 * É um elemento focável com role="slider" (leitor de tela, teclado):
 *   ← / → (ou A / D): ±10%   ·   Home / End: 0% / 100%   ·   roda do mouse: ±5%
 *   arrastar com o mouse/toque no trilho.
 *
 * Game feel: o puxador "pisca" claro e afunda 1 px enquanto é arrastado; cada
 * passo toca o clique de UI (o próprio clique já sai no volume novo — o
 * jogador OUVE o nível que escolheu).
 */
import { FRAME, FACES, FACE_H, DRIPS, controlSize, drawStoneFrame, pixelScale } from './PixelButton.js';
import { playUi } from './UiSound.js';

const FILL = { base: '#8a1424', light: '#c22a3c', hover: '#e0384b', hoverBase: '#a3192b' };
const TRACK_X0 = 12;   // início do trilho (depois do alto-falante), relativo ao poço
const TRACK_PAD = 4;   // respiro à direita
const KEY_STEP = 0.1;

/** Geometria do trilho (px de arte) para a largura de texto T. */
function trackOf(T) {
    const { W } = controlSize(T);
    const x0 = 3 + TRACK_X0, x1 = 3 + (W - 6) - TRACK_PAD;    // [x0, x1)
    return { x0, x1, len: x1 - x0 - 1 };
}

/**
 * Desenha o slider em resolução de arte.
 * @param {number} value 0..1
 * @param {'idle'|'hover'|'drag'} state
 */
export function renderPixelSlider(value, state = 'idle', canvas = document.createElement('canvas'), opts = {}) {
    const T = Math.max(opts.minTextW || 0, 24);
    const { W, H } = controlSize(T);
    canvas.width = W + 1;
    canvas.height = H + DRIPS + 1;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    const hover = state !== 'idle', drag = state === 'drag';
    const S = FACES.stone;

    drawStoneFrame(ctx, W, H);

    // Face de pedra (não afunda: quem "afunda" é o puxador).
    const x0 = 3, fy = 3, w = W - 6;
    rect(x0, fy, w, FACE_H, hover ? S.baseHover : S.base);
    rect(x0, fy, w, 1, hover ? S.lightHover : S.light);
    rect(x0, fy + 1, 1, FACE_H - 2, hover ? S.lightHover : S.light);
    rect(x0, fy + FACE_H - 1, w, 1, S.dark);
    rect(x0 + w - 1, fy + 1, 1, FACE_H - 1, S.dark);
    px(x0 + 1, fy + 1, S.spec); px(x0 + 2, fy + 1, S.spec); px(x0 + 1, fy + 2, S.spec);
    rect(x0, fy + FACE_H, w, 2, S.lip);

    // Alto-falante + ondas (0–3) ou "x" no mudo.
    const ink = hover ? S.textHover : S.text, shadow = S.textShadow;
    const ix = x0 + 3, iy = fy + 3;
    const icon = [[2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2], [0, 3], [1, 3], [2, 3], [2, 4]];
    const waves = value <= 0.001 ? 0 : value < 0.5 ? 1 : 2;
    const extra = waves === 0
        ? [[4, 1], [6, 1], [5, 2], [4, 3], [6, 3]]                       // mudo: "x"
        : [[4, 1], [5, 2], [4, 3],                                        // onda curta
            ...(waves >= 2 ? [[6, 0], [7, 1], [7, 2], [7, 3], [6, 4]] : [])];   // onda longa
    for (const [dx, dy] of [...icon, ...extra]) px(ix + dx, iy + dy + 1, shadow);
    for (const [dx, dy] of [...icon, ...extra]) px(ix + dx, iy + dy, ink);

    // Trilho afundado + preenchimento vermelho até o valor.
    const tr = trackOf(T);
    const ty = fy + 4, th = 3;
    rect(tr.x0 - 1, ty - 1, tr.x1 - tr.x0 + 2, th + 2, FRAME.outline);
    rect(tr.x0, ty, tr.x1 - tr.x0, th, FRAME.well);
    const kx = tr.x0 + Math.round(value * tr.len);
    if (kx > tr.x0) {
        rect(tr.x0, ty, kx - tr.x0, th, hover ? FILL.hoverBase : FILL.base);
        rect(tr.x0, ty, kx - tr.x0, 1, hover ? FILL.hover : FILL.light);
    }
    // Marcas de 25% sob o trilho.
    for (let q = 1; q < 4; q++) px(tr.x0 + Math.round(q / 4 * tr.len), ty + th + 1, FRAME.seam);

    // Puxador de ferro (5x7); arrastando: clareia e afunda 1 px.
    const ky = fy + 1 + (drag ? 1 : 0);
    rect(kx - 2, ky, 5, 7, FRAME.outline);
    rect(kx - 1, ky + 1, 3, 5, drag ? FRAME.ironLight : FRAME.iron);
    rect(kx - 1, ky + 1, 3, 1, FRAME.ironLight);
    rect(kx - 1, ky + 1, 1, 5, FRAME.ironLight);
    rect(kx + 1, ky + 2, 1, 4, FRAME.ironDark);
    rect(kx - 1, ky + 5, 3, 1, FRAME.ironDark);
    px(kx, ky + 3, drag ? '#ffffff' : FRAME.ironDark);           // sulco central
    return canvas;
}

export class PixelSlider {
    /**
     * @param {HTMLElement} el elemento focável (vira role="slider")
     * @param {object} o
     * @param {string} o.ariaLabel
     * @param {() => number} o.get        valor atual 0..1
     * @param {(v:number) => void} o.set  aplica o valor (ex.: MasterVolume.set)
     * @param {number} [o.minTextW]       iguala a largura aos botões empilhados
     * @param {() => boolean} [o.enabled]
     */
    constructor(el, { ariaLabel = 'Volume', get, set, minTextW = 0, enabled = () => true }) {
        this.el = el;
        this.get = get; this.set = set;
        this.minTextW = minTextW;
        this.enabled = enabled;
        this.canvas = el.querySelector('canvas') || el.appendChild(document.createElement('canvas'));
        el.classList.add('pixel-btn', 'pixel-slider');
        el.tabIndex = 0;
        el.setAttribute('role', 'slider');
        el.setAttribute('aria-label', ariaLabel);
        el.setAttribute('aria-valuemin', '0');
        el.setAttribute('aria-valuemax', '100');
        this._drag = false;
        this._state = null;
        this._lastTick = 0;

        el.addEventListener('pointerenter', () => { if (this.enabled()) el.focus({ preventScroll: true }); });
        el.addEventListener('focus', (e) => {
            // Mesmo som de "mover o foco" dos botões (só vindo de outro controle).
            if (this.enabled() && e.relatedTarget?.closest?.('.pixel-btn')) playUi('uiMove');
            this.refresh();
        });
        el.addEventListener('blur', () => { this._drag = false; this.refresh(true); });
        el.addEventListener('pointerdown', (e) => {
            if (!this.enabled()) return;
            e.preventDefault();
            el.focus({ preventScroll: true });
            this._drag = true;
            try { el.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
            this._fromPointer(e);
        });
        el.addEventListener('pointermove', (e) => { if (this._drag) this._fromPointer(e); });
        const end = () => { if (this._drag) { this._drag = false; this.refresh(true); } };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
        el.addEventListener('wheel', (e) => {
            if (!this.enabled()) return;
            e.preventDefault();
            this.step(e.deltaY < 0 ? 0.05 : -0.05);
        }, { passive: false });
        el.addEventListener('keydown', (e) => {
            if (!this.enabled()) return;
            const k = e.key.toLowerCase();
            if (k === 'arrowleft' || k === 'a') { e.preventDefault(); this.step(-KEY_STEP); }
            else if (k === 'arrowright' || k === 'd') { e.preventDefault(); this.step(KEY_STEP); }
            else if (k === 'home') { e.preventDefault(); this._apply(0); }
            else if (k === 'end') { e.preventDefault(); this._apply(1); }
        });
        this.refresh(true);
    }

    /** Passo relativo (teclado, roda, controle). */
    step(delta) { this._apply(this.get() + delta); }

    _fromPointer(e) {
        const r = this.canvas.getBoundingClientRect();
        const s = r.width / this.canvas.width || 1;           // px de tela por px de arte
        const tr = trackOf(Math.max(this.minTextW, 24));
        const artX = (e.clientX - r.left) / s;
        this._apply((artX - tr.x0) / tr.len);
    }

    _apply(v) {
        const before = this.get();
        this.set(Math.max(0, Math.min(1, v)));
        const now = this.get();
        if (now !== before) {
            // Clique de UI a cada passo (limitado): já soa no volume novo.
            const t = performance.now();
            if (t - this._lastTick > 55) { this._lastTick = t; playUi('uiMove', { rateMultiplier: 0.8 + now * 0.5 }); }
        }
        this.refresh(true);
    }

    refresh(force = false) {
        const focused = document.activeElement === this.el;
        const state = this._drag ? 'drag' : (focused ? 'hover' : 'idle');
        const v = this.get();
        const key = `${state}|${v}`;
        if (!force && key === this._state) return;
        this._state = key;
        this.el.setAttribute('aria-valuenow', String(Math.round(v * 100)));
        this.el.setAttribute('aria-valuetext', `${Math.round(v * 100)}%`);
        renderPixelSlider(v, state, this.canvas, { minTextW: this.minTextW });
        this.applyScale(this._scale);
    }

    applyScale(s = pixelScale()) {
        this._scale = s;
        this.canvas.style.width = `${this.canvas.width * s}px`;
        this.canvas.style.height = `${this.canvas.height * s}px`;
    }

    // Compatível com PixelButton (a tela de pausa chama reset ao abrir).
    reset() { this._drag = false; this.refresh(true); }
}
