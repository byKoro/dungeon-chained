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

export const FACES = {
    red: {
        base: '#8a1424', baseHover: '#a3192b',
        light: '#c22a3c', lightHover: '#e0384b',
        dark: '#6e0f1c', spec: '#ff6b7a', lip: '#3d0710',
        text: '#efe3c2', textHover: '#fff6dc', textShadow: '#3a0610',
        drips: true,
    },

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

export const PAD_X = 7;
export const FACE_H = 11;
export const LIP = 2;
export const DRIPS = 4;

export function controlSize(T) {
    return { W: T + PAD_X * 2 + 6, H: 1 + 2 + FACE_H + LIP + 2 + 1 };
}

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

export function pixelScale() {
    return Math.max(3, Math.min(9, Math.round(window.innerHeight / 140)));
}

export function renderPixelButton(text, state = 'idle', canvas = document.createElement('canvas'), opts = {}) {
    const F = FACES[opts.face] || FACES.red;
    const textW = measureText(text);
    const T = Math.max(textW, opts.minTextW || 0);
    const { W, H } = controlSize(T);
    canvas.width = W + 1;
    canvas.height = H + DRIPS + 1;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

    const hover = state === 'hover';
    const pressed = state === 'pressed';

    drawStoneFrame(ctx, W, H);
    const x0 = 3, y0 = 3, w = W - 6;

    const fy = pressed ? y0 + LIP : y0;
    const base = hover ? F.baseHover : F.base;
    const light = hover ? F.lightHover : F.light;
    rect(x0, fy, w, FACE_H, base);
    rect(x0, fy, w, 1, light);
    rect(x0, fy + 1, 1, FACE_H - 2, light);
    rect(x0, fy + FACE_H - 1, w, 1, F.dark);
    rect(x0 + w - 1, fy + 1, 1, FACE_H - 1, F.dark);
    px(x0 + 1, fy + 1, F.spec);
    px(x0 + 2, fy + 1, F.spec);
    px(x0 + 1, fy + 2, F.spec);
    if (!pressed) rect(x0, fy + FACE_H, w, LIP, F.lip);

    const tx = x0 + Math.floor((w - textW) / 2);
    const ty = fy + 3;
    drawText(ctx, text, tx, ty + 1, F.textShadow);
    drawText(ctx, text, tx, ty, hover ? F.textHover : F.text);

    if (F.drips) {
        const drips = [[Math.floor(W * 0.22), 3], [Math.floor(W * 0.27), 1], [Math.floor(W * 0.71), 2]];
        for (const [dx, len] of drips) {
            rect(dx, H - 1, 1, len, F.dark);
            px(dx, H - 1 + len, F.base);
        }
    }

    return canvas;
}

export class PixelButton {

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

        this._pointerFocus = false;
        el.addEventListener('pointerenter', () => {
            if (!this.enabled()) return;
            this._pointerFocus = true;
            el.focus({ preventScroll: true });
            this._pointerFocus = false;
        });
        el.addEventListener('focus', (e) => {

            const fromButton = !!e.relatedTarget?.closest?.('.pixel-btn');
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

            playUi('uiConfirm');
            this.onPress?.();
        });
        this.refresh();
    }

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

    applyScale(s = pixelScale()) {
        this._scale = s;
        this.canvas.style.width = `${this.canvas.width * s}px`;
        this.canvas.style.height = `${this.canvas.height * s}px`;
    }
}
