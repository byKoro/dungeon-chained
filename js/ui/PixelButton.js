/**
 * PixelButton — botão em pixel art compartilhado pelas telas de menu (morte,
 * pausa): moldura de pedra chanfrada com juntas de tijolo, rebites de ferro,
 * um poço escuro onde a FACE assenta e o texto na fonte do balão de fala do
 * trailer (PixelFont).
 *
 * O botão é um <button> de verdade (foco, Enter/Espaço, leitor de tela) cujo
 * conteúdo é um canvas pequeno em resolução de ARTE (1 px = 1 pixel de arte),
 * ampliado sem suavização por uma escala inteira. Três quadros: normal,
 * destaque (hover/foco) e apertado (a face afunda no poço).
 *
 * Faces: 'red' (ação principal, sangue, com gotas escorrendo), 'stone'
 * (ação secundária, pedra cinza) e 'gold' (SKIP do trailer, amarelo).
 */
import { drawText, measureText } from './PixelFont.js';
import { playUi } from './UiSound.js';

export const FRAME = {
    outline: '#0b0910',
    stone: '#4a4458',
    stoneLight: '#6e6684',
    stoneDark: '#2b2735',
    seam: '#1f1b28',
    well: '#16131d',
    iron: '#7d8696',
    ironLight: '#c9d1dc',
    ironDark: '#454b57',
};

// Paletas da face (normal / destaque) + texto.
export const FACES = {
    red: {
        base: '#8a1424', baseHover: '#a3192b',
        light: '#c22a3c', lightHover: '#e0384b',
        dark: '#6e0f1c', spec: '#ff6b7a', lip: '#3d0710',
        text: '#efe3c2', textHover: '#fff6dc', textShadow: '#3a0610',
        drips: true,
    },
    // Ouro velho (botão SKIP do trailer): texto escuro gravado na face clara.
    gold: {
        base: '#c99a2e', baseHover: '#e2b63f',
        light: '#f2cf5b', lightHover: '#ffe27a',
        dark: '#8a6414', spec: '#fff2b0', lip: '#4a330a',
        text: '#2b1d08', textHover: '#1a1004', textShadow: '#f7dc7a',
        drips: false,
    },
    stone: {
        base: '#3a3446', baseHover: '#4a4458',
        light: '#5a5370', lightHover: '#6e6684',
        dark: '#2b2735', spec: '#8a82a3', lip: '#121018',
        text: '#c9c2d6', textHover: '#efe3c2', textShadow: '#0b0910',
        drips: false,
    },
};

export const PAD_X = 7;   // respiro lateral do texto dentro da face
export const FACE_H = 11; // altura da face (texto de 5 px + respiro)
export const LIP = 2;     // "espessura" da face (some quando apertada)
export const DRIPS = 4;   // linhas extras abaixo para as gotas de sangue

/** Largura/altura (px de arte) do corpo de um controle com texto de largura T. */
export function controlSize(T) {
    return { W: T + PAD_X * 2 + 6, H: 1 + 2 + FACE_H + LIP + 2 + 1 };
}

/**
 * Sombra + moldura de pedra chanfrada (bisel, juntas de tijolo, rebites) +
 * poço escuro — a base comum dos botões e do slider.
 */
export function drawStoneFrame(ctx, W, H) {
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    const chamfer = (x, y, w, h, c) => { rect(x + 1, y, w - 2, h, c); rect(x, y + 1, w, h - 2, c); };
    ctx.globalAlpha = 0.5;
    chamfer(1, 1, W, H, '#000');
    ctx.globalAlpha = 1;
    chamfer(0, 0, W, H, FRAME.outline);
    chamfer(1, 1, W - 2, H - 2, FRAME.stone);
    rect(2, 1, W - 4, 1, FRAME.stoneLight);
    rect(1, 2, 1, H - 4, FRAME.stoneLight);
    rect(2, H - 2, W - 4, 1, FRAME.stoneDark);
    rect(W - 2, 2, 1, H - 4, FRAME.stoneDark);
    for (let x = 8, i = 0; x < W - 7; x += 9 + (i++ % 3)) {
        px(x, 1, FRAME.seam);
        px(x + 1, 1, FRAME.stoneLight);
    }
    for (let x = 12, i = 0; x < W - 7; x += 8 + (i++ % 4)) px(x, H - 2, FRAME.seam);
    rect(3, 3, W - 6, FACE_H + LIP, FRAME.well);
    const rivet = (x, y) => {
        px(x, y, FRAME.ironLight); px(x + 1, y, FRAME.iron);
        px(x, y + 1, FRAME.iron); px(x + 1, y + 1, FRAME.ironDark);
    };
    rivet(1, 1); rivet(W - 3, 1); rivet(1, H - 3); rivet(W - 3, H - 3);
}

/** Escala inteira (px de tela por px de arte) a partir da altura da janela. */
export function pixelScale() {
    return Math.max(3, Math.min(9, Math.round(window.innerHeight / 140)));
}

/**
 * Desenha o botão em resolução de arte.
 * @param {string} text
 * @param {'idle'|'hover'|'pressed'} state
 * @param {HTMLCanvasElement} [canvas]
 * @param {{face?: 'red'|'stone', minTextW?: number}} [opts]
 *   minTextW: largura mínima do texto (px de arte) — iguala botões empilhados.
 * @returns {HTMLCanvasElement}
 */
export function renderPixelButton(text, state = 'idle', canvas = document.createElement('canvas'), opts = {}) {
    const F = FACES[opts.face] || FACES.red;
    const textW = measureText(text);
    const T = Math.max(textW, opts.minTextW || 0);
    const { W, H } = controlSize(T);           // contorno(1) + pedra(2) por lado
    canvas.width = W + 1;                       // +1 da sombra projetada
    canvas.height = H + DRIPS + 1;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

    const hover = state === 'hover';
    const pressed = state === 'pressed';

    // --- Sombra, moldura de pedra, rebites e poço (comum ao slider) ---
    drawStoneFrame(ctx, W, H);
    const x0 = 3, y0 = 3, w = W - 6;

    // --- Face (afunda LIP px quando apertada) ---
    const fy = pressed ? y0 + LIP : y0;
    const base = hover ? F.baseHover : F.base;
    const light = hover ? F.lightHover : F.light;
    rect(x0, fy, w, FACE_H, base);
    rect(x0, fy, w, 1, light);                 // luz em cima
    rect(x0, fy + 1, 1, FACE_H - 2, light);    // luz à esquerda
    rect(x0, fy + FACE_H - 1, w, 1, F.dark);
    rect(x0 + w - 1, fy + 1, 1, FACE_H - 1, F.dark);
    px(x0 + 1, fy + 1, F.spec);                 // brilho de canto
    px(x0 + 2, fy + 1, F.spec);
    px(x0 + 1, fy + 2, F.spec);
    if (!pressed) rect(x0, fy + FACE_H, w, LIP, F.lip); // espessura da face

    // --- Texto (PixelFont) com sombra de 1 px, centrado na face ---
    const tx = x0 + Math.floor((w - textW) / 2);
    const ty = fy + 3;
    drawText(ctx, text, tx, ty + 1, F.textShadow);
    drawText(ctx, text, tx, ty, hover ? F.textHover : F.text);

    // --- Gotas de sangue escorrendo da base (só na face vermelha) ---
    if (F.drips) {
        const drips = [[Math.floor(W * 0.22), 3], [Math.floor(W * 0.27), 1], [Math.floor(W * 0.71), 2]];
        for (const [dx, len] of drips) {
            rect(dx, H - 1, 1, len, F.dark);
            px(dx, H - 1 + len, F.base);
        }
    }

    return canvas;
}

/**
 * Liga um <button> (com um <canvas> dentro) ao desenho pixel art e aos
 * estados de interação. Mouse em cima = FOCO (um único destaque para mouse,
 * teclado e controle).
 */
export class PixelButton {
    /**
     * @param {HTMLButtonElement} el
     * @param {object} o
     * @param {string} o.label             texto desenhado
     * @param {string} [o.ariaLabel]       nome acessível
     * @param {'red'|'stone'} [o.face]
     * @param {number} [o.minTextW]
     * @param {() => boolean} [o.enabled]  se false, ignora cliques
     * @param {() => void} [o.onPress]
     */
    constructor(el, { label, ariaLabel, face = 'red', minTextW = 0, enabled = () => true, onPress = null }) {
        this.el = el;
        this.label = label;
        this.face = face;
        this.minTextW = minTextW;
        this.enabled = enabled;
        this.onPress = onPress;
        this.canvas = el.querySelector('canvas') || el.appendChild(document.createElement('canvas'));
        el.type = 'button';
        el.classList.add('pixel-btn');
        el.setAttribute('aria-label', ariaLabel || label);
        this._state = null;
        this._pressed = false;

        // Som de UI. "uiMove" só quando o FOCO muda por ação do jogador (mouse
        // entrando, ou foco vindo de outro botão via teclado/controle) — o
        // foco automático ao abrir uma tela não toca nada (quem abre a tela
        // já tem som próprio). "uiConfirm" ao acionar.
        this._pointerFocus = false;
        el.addEventListener('pointerenter', () => {
            if (!this.enabled()) return;
            this._pointerFocus = true;
            el.focus({ preventScroll: true });
            this._pointerFocus = false;
        });
        el.addEventListener('focus', (e) => {
            const fromButton = e.relatedTarget?.classList?.contains('pixel-btn');
            if (this.enabled() && (this._pointerFocus || fromButton)) playUi('uiMove');
        });
        el.addEventListener('pointerleave', () => { this._pressed = false; this.refresh(); });
        el.addEventListener('pointerdown', () => { this._pressed = true; this.refresh(); });
        el.addEventListener('pointerup', () => { this._pressed = false; this.refresh(); });
        el.addEventListener('focus', () => this.refresh());
        el.addEventListener('blur', () => { this._pressed = false; this.refresh(); });
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { this._pressed = true; this.refresh(); }
        });
        el.addEventListener('keyup', () => { this._pressed = false; this.refresh(); });
        el.addEventListener('click', () => {
            if (!this.enabled()) return;
            this.showPressed();
            // Som no MESMO instante do quadro "apertado" (antes da ação, que
            // pode trocar de tela/pausar e cortar efeitos em curso).
            playUi('uiConfirm');
            this.onPress?.();
        });
        this.refresh();
    }

    // Mostra o quadro apertado (ex.: durante o fade de saída da tela).
    showPressed() {
        this._pressed = true;
        this.refresh();
    }

    reset() {
        this._pressed = false;
        this.refresh();
    }

    refresh() {
        const focused = document.activeElement === this.el;
        const state = this._pressed ? 'pressed' : (focused ? 'hover' : 'idle');
        if (state === this._state) return;
        this._state = state;
        renderPixelButton(this.label, state, this.canvas, { face: this.face, minTextW: this.minTextW });
        this.applyScale(this._scale);
    }

    // Escala inteira do botão; a última escolhida é mantida nos redesenhos.
    applyScale(s = pixelScale()) {
        this._scale = s;
        this.canvas.style.width = `${this.canvas.width * s}px`;
        this.canvas.style.height = `${this.canvas.height * s}px`;
    }
}
