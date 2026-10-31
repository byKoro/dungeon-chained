import { POST_PROCESSING } from '../config/GameConfig.js';

export class PostProcessor {

    constructor(canvas, ctx, opts = {}) {
        this.canvas = canvas;
        this.ctx = ctx;

        this.enabled = opts.enabled ?? POST_PROCESSING.enabled;

        this.vignette = { ...POST_PROCESSING.vignette, ...(opts.vignette || {}) };
        this._vgrad = null;
        this._vW = -1; this._vH = -1;

        this.lighting = { ...POST_PROCESSING.lighting, ...(opts.lighting || {}) };

        this._lightCanvas = document.createElement("canvas");
        this._lightCtx = this._lightCanvas.getContext("2d");

        this._loCanvas = document.createElement("canvas");
        this._loCtx = this._loCanvas.getContext("2d");

        this._lights = [];

        this._flicker = 0;

        this._vignetteBreath = 0;
        this._breathPhase = 0;
    }

    setVignetteBreath(level) {
        this._vignetteBreath = Math.max(0, Math.min(1, level || 0));
    }

    addLight(x, y, radius, pixel = 6, flatten = this.lighting.flatten, profile = null) {
        this._lights.push({ kind: "ellipse", x, y, radius, pixel, flatten, profile });
    }

    addWash(rectScreen, dir, profile = null) {

        const x = rectScreen.x + rectScreen.w / 2;
        const y = rectScreen.y + rectScreen.h / 2;
        this._lights.push({ kind: "wash", rect: rectScreen, dir, profile, x, y });
    }

    addSpotLight(x, y, dirX, dirY, length, spread, pixel = 6, profile = null, startDist = 0, alphaScale = 1, startFade = 0) {
        const len = Math.hypot(dirX, dirY) || 1;
        this._lights.push({
            kind: "spot", x, y,
            dx: dirX / len, dy: dirY / len,
            length, spread, pixel, profile,
            startDist,
            alphaScale,
            startFade
        });
    }

    _ensureSize() {
        const w = this.canvas.width, h = this.canvas.height;
        if (this._lightCanvas.width !== w || this._lightCanvas.height !== h) {
            this._lightCanvas.width = w;
            this._lightCanvas.height = h;
        }
        this._lightCtx.imageSmoothingEnabled = false;
    }

    _drawLighting() {
        const w = this.canvas.width, h = this.canvas.height;
        this._ensureSize();
        const lctx = this._lightCtx;

        lctx.globalCompositeOperation = "source-over";
        lctx.fillStyle = `rgb(${this.lighting.ambient})`;
        lctx.fillRect(0, 0, w, h);

        this._flicker += this.lighting.flickerSpeed;

        lctx.globalCompositeOperation = "lighter";
        for (const light of this._lights) {

            const p = light.profile || this.lighting;

            const phase = this._flicker + (light.x + light.y) * 0.01;
            const flick = (p.flickerBase ?? this.lighting.flickerBase)
                + Math.sin(phase) * (p.flickerSine ?? this.lighting.flickerSine)
                + (Math.random() - 0.5) * (p.flickerNoise ?? this.lighting.flickerNoise);
            const color = p.color ?? this.lighting.lightColor;
            if (light.kind === "spot") {
                this._drawPixelSpotLight(light, flick, color);
            } else if (light.kind === "wash") {
                this._drawWash(light, flick, color);
            } else {
                this._drawPixelEllipseLight(light, flick, color);
            }
        }

        const prevOp = this.ctx.globalCompositeOperation;
        this.ctx.globalCompositeOperation = "multiply";
        this.ctx.drawImage(this._lightCanvas, 0, 0);
        this.ctx.globalCompositeOperation = prevOp;
    }

    _drawPixelEllipseLight(light, flick, lc) {
        const px = Math.max(2, light.pixel | 0);

        const rx = Math.max(1, (light.radiusX ?? light.radius) * flick);
        const ry = Math.max(1, (light.radiusY ?? (light.radius * (light.flatten ?? this.lighting.flatten))) * flick);

        const loW = Math.max(1, Math.ceil((rx * 2) / px));
        const loH = Math.max(1, Math.ceil((ry * 2) / px));

        if (this._loCanvas.width < loW || this._loCanvas.height < loH) {
            this._loCanvas.width = Math.max(this._loCanvas.width, loW);
            this._loCanvas.height = Math.max(this._loCanvas.height, loH);
        }
        const loCtx = this._loCtx;
        loCtx.imageSmoothingEnabled = false;
        loCtx.clearRect(0, 0, loW, loH);

        const cxLo = loW / 2, cyLo = loH / 2;
        const rLo = Math.max(loW, loH) / 2;
        loCtx.save();
        loCtx.translate(cxLo, cyLo);
        loCtx.scale(loW / Math.max(loW, loH), loH / Math.max(loW, loH));
        const g = loCtx.createRadialGradient(0, 0, 0, 0, 0, rLo);

        const falloff = (light.profile && light.profile.falloff) || this.lighting.falloff;
        for (const stop of falloff) {
            g.addColorStop(stop.offset, `rgba(${lc}, ${stop.alpha})`);
        }
        loCtx.fillStyle = g;
        loCtx.beginPath();
        loCtx.arc(0, 0, rLo, 0, Math.PI * 2);
        loCtx.fill();
        loCtx.restore();

        const lctx = this._lightCtx;
        lctx.imageSmoothingEnabled = false;
        const dw = loW * px, dh = loH * px;
        const dx = Math.round((light.x - dw / 2) / px) * px;
        const dy = Math.round((light.y - dh / 2) / px) * px;
        lctx.drawImage(this._loCanvas, 0, 0, loW, loH, dx, dy, dw, dh);
    }

    _drawWash(light, flick, lc) {
        const r = light.rect;
        const lctx = this._lightCtx;
        const falloff = (light.profile && light.profile.falloff) || this.lighting.falloff;

        let x0 = r.x, y0 = r.y, x1 = r.x, y1 = r.y;
        if (light.dir === "N") { y1 = r.y + r.h; }
        else if (light.dir === "S") { y0 = r.y + r.h; }
        else if (light.dir === "W") { x1 = r.x + r.w; }
        else if (light.dir === "E") { x0 = r.x + r.w; }

        const g = lctx.createLinearGradient(x0, y0, x1, y1);
        for (const stop of falloff) {

            const a = Math.max(0, Math.min(1, stop.alpha * flick));
            g.addColorStop(stop.offset, `rgba(${lc}, ${a})`);
        }
        lctx.save();
        lctx.fillStyle = g;
        lctx.fillRect(r.x, r.y, r.w, r.h);
        lctx.restore();
    }

    _drawPixelSpotLight(light, flick, lc) {
        const px = Math.max(2, light.pixel | 0);
        const len = Math.max(1, light.length * flick);
        const spread = Math.max(0.05, light.spread);

        const start = Math.max(0, Math.min(light.startDist || 0, len - 1));

        const halfH = len * Math.sin(spread);
        const pad = px * 2;
        const visLen = len - start;
        const loW = Math.max(1, Math.ceil((visLen + pad * 2) / px));
        const loH = Math.max(1, Math.ceil((halfH * 2 + pad * 2) / px));

        if (this._loCanvas.width < loW || this._loCanvas.height < loH) {
            this._loCanvas.width = Math.max(this._loCanvas.width, loW);
            this._loCanvas.height = Math.max(this._loCanvas.height, loH);
        }
        const loCtx = this._loCtx;
        loCtx.imageSmoothingEnabled = false;
        loCtx.clearRect(0, 0, loW, loH);

        const sc = 1 / px;
        const lenLo = len * sc;
        const startLo = start * sc;

        const originXLo = pad * sc;
        const apexYLo = loH / 2;

        loCtx.save();
        loCtx.filter = "blur(0.8px)";

        loCtx.translate(originXLo - startLo, apexYLo);

        loCtx.beginPath();
        loCtx.rect(startLo, -halfH * sc, lenLo - startLo, halfH * 2 * sc);
        loCtx.clip();

        const g = loCtx.createRadialGradient(0, 0, startLo, 0, 0, lenLo);
        const falloff = (light.profile && light.profile.falloff) || this.lighting.falloff;
        const aScale = light.alphaScale ?? 1;

        const fadeFrac = Math.min(0.9, Math.max(0, light.startFade ?? 0));
        const peak = falloff.length ? falloff[0].alpha : 0.9;
        if (fadeFrac > 0.001) {

            const RAMP_STEPS = 4;
            for (let i = 0; i <= RAMP_STEPS; i++) {
                const u = i / RAMP_STEPS;
                const off = u * fadeFrac;
                const a = peak * (u * u) * aScale;
                g.addColorStop(off, `rgba(${lc}, ${a})`);
            }

            for (const stop of falloff) {
                const off = fadeFrac + stop.offset * (1 - fadeFrac);
                g.addColorStop(off, `rgba(${lc}, ${stop.alpha * aScale})`);
            }
        } else {
            for (const stop of falloff) {
                g.addColorStop(stop.offset, `rgba(${lc}, ${stop.alpha * aScale})`);
            }
        }
        loCtx.fillStyle = g;
        loCtx.beginPath();
        loCtx.moveTo(0, 0);
        loCtx.arc(0, 0, lenLo, -spread, spread);
        loCtx.closePath();
        loCtx.fill();
        loCtx.restore();

        const lctx = this._lightCtx;
        lctx.imageSmoothingEnabled = false;
        const ang = Math.atan2(light.dy, light.dx);
        lctx.save();

        const mouthX = light.x + light.dx * start;
        const mouthY = light.y + light.dy * start;
        lctx.translate(mouthX, mouthY);
        lctx.rotate(ang);

        lctx.drawImage(
            this._loCanvas, 0, 0, loW, loH,
            -pad, -(loH * px) / 2, loW * px, loH * px
        );
        lctx.restore();
    }

    _buildVignette() {
        const w = this.canvas.width, h = this.canvas.height;
        const cx = w / 2, cy = h / 2;
        const outer = Math.hypot(cx, cy);
        const inner = outer * this.vignette.innerRadius;
        const col = this.vignette.color, s = this.vignette.strength;

        const g = this.ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
        g.addColorStop(0, `rgba(${col}, 0)`);
        g.addColorStop(this.vignette.midStop, `rgba(${col}, ${s * this.vignette.midAlphaFactor})`);
        g.addColorStop(1, `rgba(${col}, ${s})`);
        this._vgrad = g;
        this._vW = w; this._vH = h;
    }

    _drawVignette() {
        const { ctx, canvas } = this;
        if (!this._vgrad || this._vW !== canvas.width || this._vH !== canvas.height) {
            this._buildVignette();
        }

        this._breathPhase += 0.04 + this._vignetteBreath * 0.1;
        const amp = 0.35 * this._vignetteBreath;
        const breath = 1 + Math.sin(this._breathPhase) * amp;

        const prevOp = ctx.globalCompositeOperation;
        const prevAlpha = ctx.globalAlpha;
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha = Math.max(0, Math.min(1, breath));
        ctx.fillStyle = this._vgrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = prevOp;
        ctx.globalAlpha = prevAlpha;
    }

    draw() {
        if (this.enabled) {
            if (this.lighting.enabled) this._drawLighting();
            if (this.vignette.enabled) this._drawVignette();
        }

        this._lights.length = 0;
    }
}
