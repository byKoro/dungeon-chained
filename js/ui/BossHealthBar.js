import { FRAME } from './PixelButton.js';
import { drawText, measureText } from './PixelFont.js';
import { BOSS_BAR } from '../config/BossBarConfig.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// Chama de pixel (o = laranja, y = amarelo, d = contorno escuro, . = vazio).
const FLAME = [
    '...d...',
    '..dod..',
    '..doo.d',
    '.dooood',
    '.dooyod',
    'doooyyod',
    'doyyyyod',
    '.dyyyyd.',
    '..dyyd..'
].map(row => row.padEnd(8, '.'));

// Barra de vida do chefe em coordenadas de tela. `getState()` devolve { name, hp, max, phase, phaseAt? } enquanto
// houver um encontro ativo e null caso contrário (o Game decide); esta classe só desenha e anima.
export class BossHealthBar {
    constructor({ getState, config = BOSS_BAR }) {
        this.getState = getState;
        this.config = config;
        this._buf = null;
        this._textBuf = null;
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
        this.phase = 1;
        this.phaseAt = null;
        this.time = 0;
    }

    update(dt) {
        const s = this.getState();
        if (!s) { this.reset(); return; }
        const first = !this.visible;
        this.visible = true;
        this.name = s.name;
        this.hp = Math.max(0, s.hp);
        this.max = Math.max(1, s.max);
        this.phase = s.phase ?? 1;
        this.phaseAt = s.phaseAt ?? null;
        this.ratio = clamp01(this.hp / this.max);
        if (first) this.trail = this.ratio;
        const step = Math.max(0, dt);
        this.time += step;
        this.alpha = clamp01(this.alpha + step / this.config.fadeSeconds);
        if (this.trail > this.ratio) this.trail = Math.max(this.ratio, this.trail - step / this.config.trailSeconds);
        else this.trail = this.ratio;
    }

    // Paleta do preenchimento: a fase 2 usa o degradê mais quente.
    palette() {
        return this.config.colors.fill[this.phase >= 2 ? 1 : 0];
    }

    // Altura da placa de nome em pixels lógicos (texto de 7 px na escala do nome, mais respiro).
    plateHeight() {
        return 7 * this.config.nameScale + 4;
    }

    // Dados puros do layout, separados do desenho para poderem ser testados sem canvas.
    layout(W, H, span = null) {
        const c = this.config;
        const S = Math.max(c.minScale, Math.round(H / c.scaleDivisor));
        const plateH = this.plateHeight();
        const hL = plateH + c.plateGap + c.barHeight + c.padding * 2;
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
        return { S, x, y: Math.round(y), wL: Math.max(1, Math.floor(wPx / S)), hL, plateH, barTop: plateH + c.plateGap };
    }

    // Nome em maiúsculas, 2x, com contorno escuro e degradê creme → âmbar.
    _drawName(g, text, centerX, top) {
        const c = this.config, k = c.nameScale;
        const w = measureText(text) + 3, h = 9;
        if (!this._textBuf) this._textBuf = document.createElement('canvas');
        const tb = this._textBuf;
        if (tb.width !== w || tb.height !== h) { tb.width = w; tb.height = h; }
        const t = tb.getContext('2d');
        t.clearRect(0, 0, w, h);
        for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1]]) drawText(t, text, 1 + ox, 1 + oy, c.colors.textOutline);
        // as 3 linhas de cima em creme e o resto em âmbar (degradê de brasa)
        t.save();
        t.beginPath(); t.rect(0, 0, w, 4); t.clip();
        drawText(t, text, 1, 1, c.colors.text);
        t.restore();
        t.save();
        t.beginPath(); t.rect(0, 4, w, h - 4); t.clip();
        drawText(t, text, 1, 1, c.colors.textLow);
        t.restore();

        g.imageSmoothingEnabled = false;
        const dx = Math.round(centerX - (w * k) / 2);
        g.drawImage(tb, 0, 0, w, h, dx, top, w * k, h * k);
        return { left: dx, right: dx + w * k };
    }

    _drawFlame(g, x, y, flip = false) {
        const c = this.config.colors.flame;
        for (let r = 0; r < FLAME.length; r++) {
            for (let col = 0; col < FLAME[r].length; col++) {
                const ch = FLAME[r][flip ? FLAME[r].length - 1 - col : col];
                if (ch === '.') continue;
                g.fillStyle = c[ch];
                g.fillRect(x + col, y + r, 1, 1);
            }
        }
    }

    draw(ctx, W, H, span = null) {
        if (!this.visible || this.alpha <= 0) return;
        const c = this.config;
        const { S, x, y, wL, hL, plateH, barTop } = this.layout(W, H, span);
        if (!this._buf) this._buf = document.createElement('canvas');
        const buf = this._buf;
        if (buf.width !== wL || buf.height !== hL) { buf.width = wL; buf.height = hL; }
        const g = buf.getContext('2d');
        g.clearRect(0, 0, wL, hL);
        const rect = (rx, ry, w, h, color) => { g.fillStyle = color; g.fillRect(rx, ry, w, h); };

        // --- placa de nome, centralizada, com chamas dos dois lados ---
        const text = this.name.toUpperCase();
        const maxChars = Math.max(0, Math.floor((wL - 28) / (6 * c.nameScale)));
        const shown = text.length > maxChars ? text.slice(0, maxChars) : text;
        if (shown) {
            const span2 = this._drawName(g, shown, wL / 2, 1);
            const fy = Math.round((plateH - FLAME.length) / 2);
            this._drawFlame(g, span2.left - 12, fy);
            this._drawFlame(g, span2.right + 4, fy, true);
        }

        // --- moldura de pedra da barra ---
        const bh = hL - barTop;
        rect(0, barTop, wL, bh, FRAME.outline);
        rect(1, barTop + 1, wL - 2, bh - 2, FRAME.stone);
        rect(1, barTop + 1, wL - 2, 1, FRAME.stoneLight);
        rect(1, barTop + bh - 2, wL - 2, 1, FRAME.stoneDark);
        rect(1, barTop + 1, 1, bh - 2, FRAME.stoneLight);
        rect(wL - 2, barTop + 1, 1, bh - 2, FRAME.stoneDark);
        // rebites nos cantos
        for (const [rx, ry] of [[2, barTop + 2], [wL - 4, barTop + 2], [2, barTop + bh - 4], [wL - 4, barTop + bh - 4]]) {
            rect(rx, ry, 2, 2, FRAME.iron);
            rect(rx, ry, 1, 1, FRAME.ironLight);
        }

        const pad = c.padding;
        const wellX = pad + 1, wellY = barTop + pad, wellW = wL - (pad + 1) * 2, wellH = bh - pad * 2;
        rect(wellX, wellY, wellW, wellH, c.colors.well);

        // emblema de chama na ponta esquerda, num disco de pedra escura
        const em = c.emblemSize;
        const emX = wellX + 1, emY = wellY + Math.floor((wellH - em) / 2);
        rect(emX, emY, em, em, c.colors.emblemBack);
        rect(emX, emY, em, 1, FRAME.stoneDark);
        rect(emX, emY + em - 1, em, 1, FRAME.stoneLight);
        this._drawFlame(g, emX + Math.floor((em - 8) / 2) + 1, emY + Math.floor((em - FLAME.length) / 2));

        // --- trilho de vida ---
        const trackX = emX + em + 2, trackY = wellY + 1, trackH = wellH - 2;
        const trackW = wellX + wellW - 1 - trackX;
        if (trackW > 4) {
            const [light, mid, dark] = this.palette();
            rect(trackX, trackY, trackW, trackH, c.colors.trackBack);
            const trailW = Math.round(trackW * this.trail);
            const fillW = Math.round(trackW * this.ratio);
            if (trailW > fillW) rect(trackX + fillW, trackY, trailW - fillW, trackH, c.colors.trail);
            if (fillW > 0) {
                const band = Math.max(1, Math.floor(trackH / 4));
                rect(trackX, trackY, fillW, trackH, mid);
                rect(trackX, trackY, fillW, band, light);
                rect(trackX, trackY + trackH - band, fillW, band, dark);
                // brilho que corre na fase 2 (pulso)
                if (this.phase >= 2) {
                    const pulse = 0.5 + 0.5 * Math.sin(this.time * Math.PI * 2 * c.pulseHz);
                    g.globalAlpha = 0.25 * pulse;
                    rect(trackX, trackY + band, fillW, 1, '#fff2c4');
                    g.globalAlpha = 1;
                }
                // ponta da vida com brasa acesa
                rect(trackX + fillW - 1, trackY, 1, trackH, light);
            }
            // marcações de 10% em 10%
            g.globalAlpha = 0.45;
            for (let t = c.tickEvery; t < 1 - 1e-6; t += c.tickEvery) rect(trackX + Math.round(trackW * t), trackY, 1, trackH, c.colors.tick);
            g.globalAlpha = 1;
            if (this.phaseAt != null && this.phaseAt > 0 && this.phaseAt < 1) {
                rect(trackX + Math.round(trackW * this.phaseAt) - 1, trackY - 1, 3, trackH + 2, c.colors.phaseMark);
                rect(trackX + Math.round(trackW * this.phaseAt), trackY - 1, 1, trackH + 2, this.palette()[0]);
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
