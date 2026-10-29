import { ARAUTO_INTRO } from '../config/ArautoIntroConfig.js';

// Glifo "E" 3x5 em pixels de arte.
const GLYPH_E = ['###', '#..', '##.', '#..', '###'];

// Segurar uma tecla para pular a cinemática: o anel em volta da tecla enche enquanto ela fica apertada.
// Só conta depois de a tecla ser solta uma vez (quem entrou segurando não pula sem querer).
export class HoldToSkip {
    constructor({ isHeld, cfg = ARAUTO_INTRO.skip }) {
        this.isHeld = isHeld;
        this.cfg = cfg;
        this.reset();
    }

    reset() {
        this.progress = 0;
        this.armed = false;
        this.done = false;
        this.held = false;
    }

    update(dt) {
        if (this.done) return;
        this.held = !!this.isHeld();
        if (!this.held) this.armed = true;
        if (this.held && this.armed) this.progress = Math.min(1, this.progress + dt / this.cfg.holdSeconds);
        else this.progress = Math.max(0, this.progress - dt / this.cfg.drainSeconds);
        if (this.progress >= 1) this.done = true;
    }

    // `bottomInset` = altura da faixa preta de baixo; a tecla fica logo acima dela, no canto direito.
    draw(ctx, canvas, scale, bottomInset = 0) {
        const c = this.cfg, s = Math.max(1, Math.round(scale));
        const ring = (c.ringRadius + c.ringWidth) * s;
        const cx = Math.round(canvas.width - c.margin * s - ring);
        const cy = Math.round(canvas.height - bottomInset - c.margin * s - ring);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = this.held || this.progress > 0 ? 1 : c.idleAlpha;

        const r = (c.ringRadius + c.ringWidth / 2) * s;
        ctx.lineWidth = c.ringWidth * s;
        ctx.strokeStyle = c.ringBack;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        if (this.progress > 0) {
            ctx.strokeStyle = c.ringColor;
            ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.progress); ctx.stroke();
        }

        const k = c.keySize, x = Math.round(cx - k * s / 2), y = Math.round(cy - k * s / 2);
        const px = (ax, ay, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x + ax * s, y + ay * s, w * s, h * s); };
        px(1, 0, k - 2, k, c.keyOutline);
        px(0, 1, k, k - 2, c.keyOutline);
        px(1, 1, k - 2, k - 2, c.keyDark);
        px(1, 1, k - 2, k - 3, c.keyFace);
        px(1, 1, k - 2, 1, c.keyLight);
        const gx = Math.floor((k - 3) / 2), gy = Math.floor((k - 5) / 2);
        GLYPH_E.forEach((line, row) => [...line].forEach((ch, col) => {
            if (ch === '#') px(gx + col, gy + row, 1, 1, c.keyText);
        }));
        ctx.restore();
    }
}
