/**
 * PixelLabel — texto solto dos menus (títulos e mensagens de status) na
 * fonte pixel art (PixelFont), no mesmo esquema dos botões: canvas pequeno em
 * resolução de arte ampliado por uma escala inteira, sem suavização.
 *
 * Leitor de tela: o texto também vai num <span class="sr-only"> (e o
 * elemento pode ser aria-live para status que mudam).
 */
import { drawText, measureText } from './PixelFont.js';
import { pixelScale } from './PixelButton.js';

// Tons: tinta + sombra de 1 px (mesmas cores dos botões e da pausa).
export const LABEL_TONES = {
    title: { ink: '#efe3c2', shadow: '#0b0910' },
    muted: { ink: '#8a82a3', shadow: '#0b0910' },
    gold: { ink: '#f2cf5b', shadow: '#3a2606' },
    error: { ink: '#e0384b', shadow: '#3a0610' },
};

const TOP = 3; // espaço para acentos das maiúsculas (PixelFont)

/** Desenha o texto em resolução de arte. */
export function renderPixelLabel(text, tone = 'title', canvas = document.createElement('canvas')) {
    const T = LABEL_TONES[tone] || LABEL_TONES.title;
    canvas.width = Math.max(1, measureText(text) + 1);   // +1 da sombra
    canvas.height = TOP + 6 + 1;                          // maiúsculas + descendente + sombra
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawText(ctx, text, 0, TOP + 1, T.shadow);
    drawText(ctx, text, 0, TOP, T.ink);
    return canvas;
}

export class PixelLabel {
    /**
     * @param {HTMLElement} el
     * @param {object} [o]
     * @param {string} [o.text]
     * @param {keyof LABEL_TONES} [o.tone]
     * @param {number} [o.scaleDelta]  escala relativa à dos botões (ex.: -1)
     * @param {boolean} [o.live]       anuncia mudanças (status)
     */
    constructor(el, { text = '', tone = 'title', scaleDelta = 0, live = false } = {}) {
        this.el = el;
        this.scaleDelta = scaleDelta;
        el.classList.add('pixel-label');
        this.canvas = el.querySelector('canvas') || el.appendChild(document.createElement('canvas'));
        this.canvas.setAttribute('aria-hidden', 'true');
        this.sr = el.querySelector('.sr-only') || el.appendChild(document.createElement('span'));
        this.sr.className = 'sr-only';
        if (live) { el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite'); }
        this._key = null;
        this.set(text, tone);
    }

    /** Troca texto e/ou tom (não redesenha se nada mudou). */
    set(text, tone = this.tone) {
        const key = `${tone}|${text}`;
        if (key === this._key) return;
        this._key = key;
        this.text = text;
        this.tone = tone;
        this.sr.textContent = text;
        this.el.classList.toggle('empty', !text);
        renderPixelLabel(text || ' ', tone, this.canvas);
        this.applyScale(this._base);
    }

    applyScale(s = pixelScale()) {
        this._base = s;
        const k = Math.max(2, s + this.scaleDelta);
        this.canvas.style.width = `${this.canvas.width * k}px`;
        this.canvas.style.height = `${this.canvas.height * k}px`;
    }
}
