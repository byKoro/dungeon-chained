import { FRAME } from './PixelButton.js';
import { drawText, measureText } from './PixelFont.js';
import { BOSS_BAR } from '../config/BossBarConfig.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Barra de vida do chefe em coordenadas de tela. `getState()` devolve { name, hp, max, phaseAt? } enquanto
// houver um encontro ativo e null caso contrário (o Game decide); esta classe só desenha e anima.
export class BossHealthBar {
    constructor({ getState, config = BOSS_BAR }) {
        this.getState = getState;
        this.config = config;
        this._buf = null;
        this.reset();
    }

    reset() {
        this.visible = false;
        this.alpha = 0;
        this.name = '';
        this.hp = 0;
        this.max = 1;
        this.ratio = 1;
        this.trail = 1;
        this.phaseAt = null;
    }

    update(dt) {
        const s = this.getState();
        if (!s) { this.reset(); return; }
        const first = !this.visible;
        this.visible = true;
        this.name = s.name;
        this.hp = Math.max(0, s.hp);
        this.max = Math.max(1, s.max);
        this.phaseAt = s.phaseAt ?? null;
        this.ratio = clamp01(this.hp / this.max);
        if (first) this.trail = this.ratio;
        const step = Math.max(0, dt);
        this.alpha = clamp01(this.alpha + step / this.config.fadeSeconds);
        if (this.trail > this.ratio) this.trail = Math.max(this.ratio, this.trail - step / this.config.trailSeconds);
        else this.trail = this.ratio;
    }

    // Dados puros do layout, separados do desenho para poderem ser testados sem canvas.
    layout(W, H, span = null) {
        const c = this.config;
        const S = Math.max(c.minScale, Math.round(H / c.scaleDivisor));
        const hL = c.barHeight + c.padding * 2;
        const hPx = hL * S;
        const margin = Math.round(Math.max(10, S * 1.5));
        const free = span || { left: margin, right: W - margin, top: H };
        let x0 = free.left + c.sideGap * S, x1 = free.right - c.sideGap * S;
        let y = H - margin - hPx;
        if (x1 - x0 < c.minWidth) {
            // Sem espaço entre os retratos (janela estreita): a barra sobe para acima do HUD.
            const w = Math.min(c.minWidth, W - margin * 2);
            x0 = (W - w) / 2;
            x1 = x0 + w;
            y = free.top - hPx - c.sideGap * S;
        }
        const wPx = Math.min(c.maxWidth, x1 - x0);
        const x = Math.round(x0 + ((x1 - x0) - wPx) / 2);
        return { S, x, y: Math.round(y), wL: Math.max(1, Math.floor(wPx / S)), hL };
    }

    draw(ctx, W, H, span = null) {
        if (!this.visible || this.alpha <= 0) return;
        const c = this.config;
        const { S, x, y, wL, hL } = this.layout(W, H, span);
        if (!this._buf) this._buf = document.createElement('canvas');
        const buf = this._buf;
        if (buf.width !== wL || buf.height !== hL) { buf.width = wL; buf.height = hL; }
        const g = buf.getContext('2d');
        g.clearRect(0, 0, wL, hL);
        const rect = (rx, ry, w, h, color) => { g.fillStyle = color; g.fillRect(rx, ry, w, h); };

        rect(0, 0, wL, hL, FRAME.outline);
        rect(1, 1, wL - 2, hL - 2, FRAME.stone);
        rect(1, 1, wL - 2, 1, FRAME.stoneLight);
        rect(1, hL - 2, wL - 2, 1, FRAME.stoneDark);

        const pad = c.padding;
        const wellX = pad, wellY = pad, wellW = wL - pad * 2, wellH = hL - pad * 2;
        rect(wellX, wellY, wellW, wellH, c.colors.well);

        // Nome à esquerda; se a barra for estreita, corta o texto para sobrar espaço para a vida.
        const maxChars = Math.max(0, Math.floor((wellW - 24) / 6));
        const text = this.name.length > maxChars ? this.name.slice(0, maxChars) : this.name;
        const labelW = text ? measureText(text) + 1 : 0;
        if (text) drawText(g, text, wellX + 2, wellY + Math.max(0, Math.floor((wellH - 7) / 2)), c.colors.text);

        const trackX = wellX + (labelW ? labelW + c.labelGap + 2 : 1);
        const trackW = wellX + wellW - 1 - trackX;
        const trackY = wellY + 1, trackH = wellH - 2;
        if (trackW > 2) {
            rect(trackX, trackY, trackW, trackH, c.colors.fillDark);
            const trailW = Math.round(trackW * this.trail);
            const fillW = Math.round(trackW * this.ratio);
            if (trailW > fillW) rect(trackX + fillW, trackY, trailW - fillW, trackH, c.colors.trail);
            if (fillW > 0) {
                rect(trackX, trackY, fillW, trackH, c.colors.fill);
                rect(trackX, trackY, fillW, 1, c.colors.fillLight);
                rect(trackX, trackY + trackH - 1, fillW, 1, c.colors.fillDark);
            }
            if (this.phaseAt != null && this.phaseAt > 0 && this.phaseAt < 1) {
                rect(trackX + Math.round(trackW * this.phaseAt), trackY, 1, trackH, c.colors.phaseMark);
            }
        }

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = this.alpha;
        ctx.globalCompositeOperation = 'source-over';
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buf, 0, 0, wL, hL, x, y, wL * S, hL * S);
        ctx.restore();
    }
}
