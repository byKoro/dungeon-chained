import { HAZARDS } from '../config/GameConfig.js';

const FRAME_UP = 0;
const FRAME_DOWN = 1;

const ART_PX = 4;
const BASE_BOTTOM = 24;
const BASE_HALF_W = 32;

export class PressureButton {

    constructor(x, y, opts = {}) {
        this.x = x;
        this.y = y;
        this.hitRadius = 0;
        this.cfg = opts.cfg || HAZARDS.button;
        this.sprite = opts.sprite || null;

        this.pressed = false;
        this.justPressed = false;
        this.justReleased = false;
        this.press = 0;
        this.pulse = 0;

        this.squash = 0;
        this.squashV = 0;

        this.glow = 0;
        this.flash = 0;
        this.ringT = 0;
    }

    get capX() { return this.x; }
    get capY() { return this.y + (this.cfg.capOffsetY ?? -4); }

    _feet(p) {
        return { x: p.x, y: p.y + (this.cfg.footOffset ?? 15) };
    }

    _feetDist(p) {
        const f = this._feet(p);
        const ySquash = this.cfg.pressYScale ?? 1.5;
        return Math.hypot(f.x - this.capX, (f.y - this.capY) * ySquash);
    }

    covers(x, y) {
        const dx = (x - this.x) / (BASE_HALF_W - 2);
        const dy = (y - (this.y + 2)) / 22;
        return dx * dx + dy * dy <= 1;
    }

    update(players) {
        const cfg = this.cfg;
        const live = players.filter(p => !p.falling && p.lives > 0);

        for (const p of live) this._assist(p);

        const was = this.pressed;
        this.pressed = live.some(p => this._feetDist(p) < cfg.pressRadius);
        this.justPressed = this.pressed && !was;
        this.justReleased = !this.pressed && was;

        if (this.justPressed) {

            this.squash = cfg.pressSquash ?? 0.24;
            this.squashV = 0;
            this.flash = 1;
            this.ringT = 1;
        } else if (this.justReleased) {

            this.squash = -(cfg.releaseStretch ?? 0.14);
            this.squashV = 0;
        }

        const k = cfg.springK ?? 0.28, d = cfg.springDamp ?? 0.34;
        this.squashV += -k * this.squash - d * this.squashV;
        this.squash += this.squashV;
        if (Math.abs(this.squash) < 0.002 && Math.abs(this.squashV) < 0.002) {
            this.squash = 0; this.squashV = 0;
        }

        const gTarget = this.pressed ? 1 : 0;
        this.glow += (gTarget - this.glow) * (this.pressed ? 0.25 : 0.08);
        this.flash = Math.max(0, this.flash - 0.06);
        this.ringT = Math.max(0, this.ringT - 0.07);

        const target = this.pressed ? 1 : 0;
        this.press += (target - this.press) * 0.3;
        this.pulse += cfg.pulseSpeed;
    }

    _assist(p) {
        const cfg = this.cfg;
        const R = cfg.assistRadius ?? 46;
        const f = this._feet(p);
        const dx = this.capX - f.x;
        const dy = this.capY - f.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= R || dist < 0.5) return;

        const near = 1 - dist / R;
        let k = (cfg.assistStrength ?? 0.12) * (0.35 + 0.65 * near);

        const mx = p.moveX ?? 0, my = p.moveY ?? 0;
        const mLen = Math.hypot(mx, my);
        if (mLen > 0) {
            const align = (mx * dx + my * dy) / (mLen * dist);
            if (align < -0.2) return;
            k *= 0.45 + 0.55 * Math.max(0, align);
        } else {
            k *= 1.4;
        }

        p.x += dx * k;
        p.y += dy * k;
    }

    _scale() {
        const sy = 1 - this.squash;
        const sx = 1 + this.squash * 0.6;
        return { sx, sy };
    }

    draw(ctx) {
        const img = this.sprite;
        this._drawRing(ctx);
        if (img && img.complete && img.naturalWidth > 0) {
            this._drawSprite(ctx, img);
            return;
        }
        this._drawFallback(ctx);
    }

    _drawSprite(ctx, img) {
        const fs = this.cfg.frameSize ?? 16;
        const size = this.cfg.drawSize ?? 64;
        const frame = this.pressed ? FRAME_DOWN : FRAME_UP;
        const { sx, sy } = this._scale();
        const baseY = this.y + BASE_BOTTOM;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(Math.round(this.x), Math.round(baseY));
        ctx.scale(sx, sy);
        ctx.drawImage(img, frame * fs, 0, fs, fs, -size / 2, -size / 2 - BASE_BOTTOM, size, size);

        const lit = Math.min(1, this.glow * 0.18 + this.flash * 0.35);
        if (lit > 0.01) {
            ctx.globalCompositeOperation = "lighter";
            ctx.globalAlpha = lit;
            ctx.fillStyle = "#cf686d";

            ctx.fillRect(-5 * ART_PX, -BASE_BOTTOM - 32 + 6 * ART_PX, 10 * ART_PX, 3 * ART_PX);
        }
        ctx.restore();
    }

    _drawRing(ctx) {
        if (this.ringT <= 0) return;
        const t = 1 - this.ringT;
        const e = 1 - Math.pow(1 - t, 3);
        const rx = BASE_HALF_W + e * 26;
        const ry = rx * 0.5;
        const cy = this.y + 12;
        const n = 22;
        ctx.save();
        ctx.globalAlpha = this.ringT * 0.7;
        ctx.fillStyle = "#adb2be";
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const px = Math.round((this.x + Math.cos(a) * rx) / ART_PX) * ART_PX;
            const py = Math.round((cy + Math.sin(a) * ry) / ART_PX) * ART_PX;
            ctx.fillRect(px - ART_PX / 2, py - ART_PX / 2, ART_PX, ART_PX);
        }
        ctx.restore();
    }

    drawOcclusion(ctx, entities) {
        if (!this.occludes(entities)) return;
        this.draw(ctx);
    }

    get sortY() {
        return this.capY - (this.cfg.footOffset ?? 15) - (this.cfg.pressRadius * 0.5);
    }

    occludes(entities) {
        for (const e of entities) {
            if (e.y >= this.sortY) continue;
            if (Math.abs(e.x - this.x) > BASE_HALF_W + 8) continue;
            const feetY = e.y + (this.cfg.footOffset ?? 15);
            if (feetY < this.y - 36) continue;
            if (e.lives !== undefined && this._feetDist(e) < this.cfg.pressRadius) continue;
            return true;
        }
        return false;
    }

    _drawFallback(ctx) {
        const cfg = this.cfg;
        const R = cfg.radius;

        ctx.save();

        ctx.fillStyle = cfg.baseColor;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, R, R * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = cfg.ringColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y, R, R * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();

        const lift = (1 - this.press) * 6;
        const topR = R * 0.62;
        const color = this.pressed ? cfg.pressedColor : cfg.idleColor;

        const glow = this.pressed ? 1 : 0.75 + 0.25 * Math.abs(Math.sin(this.pulse));
        ctx.globalAlpha = glow;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - lift, topR, topR * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#1b1620";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(this.x, this.y - lift, topR, topR * 0.6, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}
