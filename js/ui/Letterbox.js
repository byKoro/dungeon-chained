import { LETTERBOX } from '../config/LetterboxConfig.js';

const clamp01 = v => Math.max(0, Math.min(1, v));
const easeOut = k => 1 - Math.pow(1 - k, 3);

// 0..1: entra até `inEnd`, fica cheia e sai entre `outStart` e `end`.
export function letterboxAmount(t, inEnd, outStart, end) {
    if (t <= 0) return 0;
    if (t < inEnd) return easeOut(t / inEnd);
    if (t > outStart) return 1 - easeOut(clamp01((t - outStart) / Math.max(1e-6, end - outStart)));
    return 1;
}

export function letterboxHeight(canvasHeight, k, cfg = LETTERBOX) {
    return Math.round(canvasHeight * cfg.barRatio * k);
}

export function drawLetterbox(ctx, canvas, k, cfg = LETTERBOX) {
    const h = letterboxHeight(canvas.height, k, cfg);
    if (h <= 0) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = cfg.color;
    ctx.fillRect(0, 0, canvas.width, h);
    ctx.fillRect(0, canvas.height - h, canvas.width, h);
    ctx.restore();
}
