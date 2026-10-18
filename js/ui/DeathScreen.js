/**
 * DeathScreen — tela de morte: escurece a cena com um véu vermelho-sangue e
 * mostra SÓ o botão REINICIAR no centro, em pixel art (mesma fonte do balão de
 * fala do trailer — PixelFont — e a mesma linguagem de pedra/ferro/sangue).
 *
 * O botão é um <button> de verdade (foco, Enter/Espaço, leitor de tela) cujo
 * conteúdo é um canvas pequeno em resolução de ARTE (1 px = 1 pixel de arte),
 * ampliado sem suavização por uma escala inteira. Três quadros: normal,
 * destaque (hover/foco) e apertado (a face afunda no poço de pedra).
 *
 * Game feel: o véu entra com atraso (deixa o golpe final ler), o botão nasce
 * com um pop elástico e depois "respira" em degraus de 1 pixel de arte.
 */
import { drawText, measureText } from './PixelFont.js';

const PAL = {
    outline: '#0b0910',
    stone: '#4a4458',
    stoneLight: '#6e6684',
    stoneDark: '#2b2735',
    seam: '#1f1b28',
    well: '#16131d',
    iron: '#7d8696',
    ironLight: '#c9d1dc',
    ironDark: '#454b57',
    // Face vermelha (paleta de sangue do jogo).
    red: '#8a1424',
    redHover: '#a3192b',
    redLight: '#c22a3c',
    redLightHover: '#e0384b',
    redDark: '#6e0f1c',
    redSpec: '#ff6b7a',
    lip: '#3d0710',
    text: '#efe3c2',
    textHover: '#fff6dc',
    textShadow: '#3a0610',
};

const PAD_X = 7;   // respiro lateral do texto dentro da face
const FACE_H = 11; // altura da face (texto de 5 px + respiro)
const LIP = 2;     // "espessura" da face (some quando apertada)
const DRIPS = 4;   // linhas extras abaixo para as gotas de sangue

/**
 * Desenha o botão em resolução de arte.
 * @param {string} text
 * @param {'idle'|'hover'|'pressed'} state
 * @returns {HTMLCanvasElement}
 */
export function renderPixelButton(text, state = 'idle', canvas = document.createElement('canvas')) {
    const T = measureText(text);
    const W = T + PAD_X * 2 + 6;               // contorno(1) + pedra(2) por lado
    const H = 1 + 2 + FACE_H + LIP + 2 + 1;
    canvas.width = W + 1;                       // +1 da sombra projetada
    canvas.height = H + DRIPS + 1;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    const chamfer = (x, y, w, h, c) => { rect(x + 1, y, w - 2, h, c); rect(x, y + 1, w, h - 2, c); };

    const hover = state === 'hover';
    const pressed = state === 'pressed';

    // --- Sombra projetada ---
    ctx.globalAlpha = 0.5;
    chamfer(1, 1, W, H, '#000');
    ctx.globalAlpha = 1;

    // --- Moldura de pedra chanfrada com bisel ---
    chamfer(0, 0, W, H, PAL.outline);
    chamfer(1, 1, W - 2, H - 2, PAL.stone);
    rect(2, 1, W - 4, 1, PAL.stoneLight);
    rect(1, 2, 1, H - 4, PAL.stoneLight);
    rect(2, H - 2, W - 4, 1, PAL.stoneDark);
    rect(W - 2, 2, 1, H - 4, PAL.stoneDark);
    // Juntas dos tijolos (topo/base).
    for (let x = 8, i = 0; x < W - 7; x += 9 + (i++ % 3)) {
        px(x, 1, PAL.seam);
        px(x + 1, 1, PAL.stoneLight);
    }
    for (let x = 12, i = 0; x < W - 7; x += 8 + (i++ % 4)) px(x, H - 2, PAL.seam);

    // --- Poço escuro onde a face assenta ---
    const x0 = 3, y0 = 3, w = W - 6, h = FACE_H + LIP;
    rect(x0, y0, w, h, PAL.well);

    // --- Face vermelha (afunda LIP px quando apertada) ---
    const fy = pressed ? y0 + LIP : y0;
    const base = hover ? PAL.redHover : PAL.red;
    const light = hover ? PAL.redLightHover : PAL.redLight;
    rect(x0, fy, w, FACE_H, base);
    rect(x0, fy, w, 1, light);                 // luz em cima
    rect(x0, fy + 1, 1, FACE_H - 2, light);    // luz à esquerda
    rect(x0, fy + FACE_H - 1, w, 1, PAL.redDark);
    rect(x0 + w - 1, fy + 1, 1, FACE_H - 1, PAL.redDark);
    px(x0 + 1, fy + 1, PAL.redSpec);            // brilho de canto
    px(x0 + 2, fy + 1, PAL.redSpec);
    px(x0 + 1, fy + 2, PAL.redSpec);
    if (!pressed) rect(x0, fy + FACE_H, w, LIP, PAL.lip); // espessura da face

    // --- Rebites de ferro nos 4 cantos da moldura ---
    const rivet = (x, y) => {
        px(x, y, PAL.ironLight); px(x + 1, y, PAL.iron);
        px(x, y + 1, PAL.iron); px(x + 1, y + 1, PAL.ironDark);
    };
    rivet(1, 1); rivet(W - 3, 1); rivet(1, H - 3); rivet(W - 3, H - 3);

    // --- Texto (PixelFont) com sombra de 1 px ---
    const tx = x0 + Math.floor((w - T) / 2);
    const ty = fy + 3;
    drawText(ctx, text, tx, ty + 1, PAL.textShadow);
    drawText(ctx, text, tx, ty, hover ? PAL.textHover : PAL.text);

    // --- Gotas de sangue escorrendo da base (detalhe de masmorra) ---
    const drips = [[Math.floor(W * 0.22), 3], [Math.floor(W * 0.27), 1], [Math.floor(W * 0.71), 2]];
    for (const [dx, len] of drips) {
        rect(dx, H - 1, 1, len, PAL.redDark);
        px(dx, H - 1 + len, PAL.red);
    }

    return canvas;
}

export class DeathScreen {
    /**
     * @param {object} o
     * @param {() => void} o.onRestart  chamado ao clicar/apertar REINICIAR
     * @param {string} [o.label]
     */
    constructor({ onRestart, label = 'REINICIAR' }) {
        this.onRestart = onRestart;
        this.label = label;
        this.root = document.getElementById('death-screen') || this._createRoot();
        this.button = this.root.querySelector('.death-btn');
        this.canvas = this.button.querySelector('canvas') || this.button.appendChild(document.createElement('canvas'));
        this.button.setAttribute('aria-label', label.charAt(0) + label.slice(1).toLowerCase());
        this._state = null;
        this._pressed = false;
        this._hover = false;

        const b = this.button;
        b.addEventListener('pointerenter', () => { this._hover = true; this._refresh(); });
        b.addEventListener('pointerleave', () => { this._hover = false; this._pressed = false; this._refresh(); });
        b.addEventListener('pointerdown', () => { this._pressed = true; this._refresh(); });
        b.addEventListener('pointerup', () => { this._pressed = false; this._refresh(); });
        b.addEventListener('focus', () => this._refresh());
        b.addEventListener('blur', () => this._refresh());
        b.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { this._pressed = true; this._refresh(); }
        });
        b.addEventListener('click', () => {
            if (!this.visible) return;
            // Mostra o quadro apertado durante o fade de saída.
            this._pressed = true;
            this._refresh();
            this.onRestart?.();
        });

        this._onResize = () => this._applyScale();
        window.addEventListener('resize', this._onResize);
        this._refresh();
    }

    _createRoot() {
        const root = document.createElement('div');
        root.id = 'death-screen';
        root.innerHTML = '<button class="death-btn" type="button"><canvas></canvas></button>';
        document.body.appendChild(root);
        return root;
    }

    get visible() { return this.root.classList.contains('visible'); }

    show() {
        if (this.visible) return;
        this._pressed = false;
        this._hover = false;
        this._refresh();
        this.root.classList.add('visible');
        this.root.setAttribute('aria-hidden', 'false');
        // Foco no botão: Enter/Espaço (e controle via START) já reiniciam.
        setTimeout(() => { if (this.visible) this.button.focus({ preventScroll: true }); }, 400);
    }

    hide() {
        if (!this.visible) return;
        this.root.classList.remove('visible');
        this.root.setAttribute('aria-hidden', 'true');
        this.button.blur();
    }

    // Quadro conforme o estado (foco conta como destaque, para o teclado).
    _refresh() {
        const focused = document.activeElement === this.button;
        const state = this._pressed ? 'pressed' : (this._hover || focused ? 'hover' : 'idle');
        if (state === this._state) return;
        this._state = state;
        renderPixelButton(this.label, state, this.canvas);
        this._applyScale();
    }

    // Escala INTEIRA (pixels nítidos) a partir da altura da janela.
    _applyScale() {
        const s = Math.max(3, Math.min(9, Math.round(window.innerHeight / 140)));
        this.canvas.style.width = `${this.canvas.width * s}px`;
        this.canvas.style.height = `${this.canvas.height * s}px`;
        this.root.style.setProperty('--px', `${s}px`);
    }
}
