import { FACE_H, LIP, drawStoneFrame } from './PixelButton.js';
import { drawText, measureText } from './PixelFont.js';
import { BOSS_BAR } from '../config/BossBarConfig.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));

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

    // Cores da face da vida: vermelho do RESUME na fase 1, lava na fase 2.
    palette() {
        return this.config.colors.face[this.phase >= 2 ? 1 : 0];
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
        const hL = plateH + c.plateGap + c.barHeight + c.padding * 2 + c.dripRoom;
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

    _pulse(hz, offset = 0) {
        return 0.5 + 0.5 * Math.sin(this.time * Math.PI * 2 * hz + offset);
    }

    // Face da vida no mesmo desenho do botão RESUME (brilho, sombra, reflexo e lábio), cortada no HP.
    _drawFace(g, rect, x0, y0, w) {
        const c = this.config, f = this.palette();
        const fillW = Math.round(w * this.ratio);
        const trailW = Math.round(w * this.trail);
        if (trailW > fillW) rect(x0 + fillW, y0, trailW - fillW, FACE_H, c.colors.trail);
        if (fillW > 0) {
            rect(x0, y0, fillW, FACE_H, f.base);
            rect(x0, y0, fillW, 1, f.light);
            rect(x0, y0 + 1, 1, FACE_H - 2, f.light);
            rect(x0, y0 + FACE_H - 1, fillW, 1, f.dark);
            if (fillW > 1) rect(x0 + fillW - 1, y0 + 1, 1, FACE_H - 1, f.dark);
            for (const [sx, sy] of [[1, 1], [2, 1], [1, 2]]) if (sx < fillW - 1) rect(x0 + sx, y0 + sy, 1, 1, f.spec);
            if (this.phase >= 2 && fillW > 2) {
                g.globalAlpha = 0.25 * this._pulse(c.pulseHz);
                rect(x0 + 1, y0 + 3, fillW - 2, 1, f.spec);
                g.globalAlpha = 1;
            }
            rect(x0, y0 + FACE_H, fillW, LIP, f.lip);
        }
        g.globalAlpha = 0.45;
        for (let t = c.tickEvery; t < 1 - 1e-6; t += c.tickEvery) rect(x0 + Math.round(w * t), y0, 1, FACE_H, c.colors.tick);
        g.globalAlpha = 1;
        if (this.phaseAt != null && this.phaseAt > 0 && this.phaseAt < 1) {
            const mx = x0 + Math.round(w * this.phaseAt);
            rect(mx - 1, y0 - 1, 3, FACE_H + LIP + 2, c.colors.phaseMark);
            rect(mx, y0 - 1, 1, FACE_H + LIP + 2, f.light);
        }
    }

    // Pingos de lava pendurados na borda de baixo da moldura (no lugar dos pingos de sangue do RESUME).
    // A ponta brilha devagar, cada pingo fora de fase com os outros.
    _drawDrips(g, rect, W, H) {
        const c = this.config, d = c.colors.drip;
        c.drips.forEach(([at, len], i) => {
            const dx = Math.floor(W * at);
            rect(dx, H - 1, 1, 1, d.base);
            if (len > 1) rect(dx, H, 1, len - 1, d.body);
            rect(dx, H - 1 + len, 1, 1, d.body);
            g.globalAlpha = this._pulse(c.dripPulseHz, i * 1.7);
            rect(dx, H - 1 + len, 1, 1, d.tip);
            g.globalAlpha = 1;
        });
    }

    draw(ctx, W, H, span = null) {
        if (!this.visible || this.alpha <= 0) return;
        const c = this.config;
        const { S, x, y, wL, hL, barTop } = this.layout(W, H, span);
        if (!this._buf) this._buf = document.createElement('canvas');
        const buf = this._buf;
        if (buf.width !== wL || buf.height !== hL) { buf.width = wL; buf.height = hL; }
        const g = buf.getContext('2d');
        g.clearRect(0, 0, wL, hL);
        const rect = (rx, ry, w, h, color) => { g.fillStyle = color; g.fillRect(rx, ry, w, h); };

        const text = this.name.toUpperCase();
        const maxChars = Math.max(0, Math.floor((wL - 4) / (6 * c.nameScale)));
        const shown = text.length > maxChars ? text.slice(0, maxChars) : text;
        if (shown) this._drawName(g, shown, wL / 2, 1);

        // Moldura do RESUME (largura - 1: a sombra cai 1 px à direita e abaixo).
        const fw = wL - 1, fh = c.barHeight + c.padding * 2;
        g.save();
        g.translate(0, barTop);
        drawStoneFrame(g, fw, fh);
        this._drawFace(g, rect, 3, 3, fw - 6);
        this._drawDrips(g, rect, fw, fh);
        g.restore();

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = this.alpha;
        ctx.globalCompositeOperation = 'source-over';
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(buf, 0, 0, wL, hL, x, y, wL * S, hL * S);
        ctx.restore();
    }
}
