import { CinematicBars } from '../ui/CinematicBars.js';
import { Renderer } from '../core/Renderer.js';
import { SeamlessTileset as Tileset } from './kit/SeamlessTileset.js';
import { Player } from '../entities/Player.js';
import { SawWeapon } from '../weapons/SawWeapon.js';
import { playerConfigs } from '../config/EntityConfig.js';
import { renderSpeechBubble } from '../ui/SpeechBubble.js';
import { BloodScreen } from './fx/BloodScreen.js';
import { TILE, ROOM_COLS, ROOM_ROWS } from '../config/GameConfig.js';
import { clamp01, lerp, easeOut } from './anim.js';
import { hookRendererAudio } from './audio/TrailerAudio.js';

export const TRAILER_EXPRESSIONS = [
    'neutro', 'assustado', 'espantado', 'raiva', 'furia', 'preocupado',
    'desconfiado', 'olhando_esquerda', 'olhando_direita', 'olhando_cima',
    'olhos_fechados'
];

const BUBBLE_PIXEL_RATIO = 0.5;

export class TrailerStage {
    constructor(canvas, assets) {
        this.canvas = canvas;
        this.bars = new CinematicBars();
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.assets = assets;

        this.renderer = new Renderer(canvas, this.ctx);
        this.renderer.setTileset(new Tileset(assets.tileset, 16, 10));
        this.renderer.setAssets(assets);
        this.renderer.setTileWorldSize(TILE);

        const cfgs = playerConfigs(assets);
        this.p1 = new Player(0, 0, cfgs[0].color, cfgs[0].controls, cfgs[0].img, cfgs[0].name, cfgs[0].sprite);
        this.p2 = new Player(0, 0, cfgs[1].color, cfgs[1].controls, cfgs[1].img, cfgs[1].name, cfgs[1].sprite);
        this.redPlayer = this.p1;
        this.bluePlayer = this.p2;
        this._loadExpressions();

        this.logo = assets.get('logo') || assets.load('logo', 'assets/keyart/logo.png');
        this._logoRed = null;

        this.saw = new SawWeapon(assets.saw, assets.cable);

        this.bloodScreen = new BloodScreen(canvas);

        this.speech = null;
        this.overlay = null;
        this._fogPhase = 0;
        this._onResize = () => this.resize();
        this.resize();
    }

    _loadExpressions() {
        for (const [p, dir] of [[this.p1, 'player_01'], [this.p2, 'player_02']]) {
            const s = p.sprite;
            s.expressions = {};
            for (const name of TRAILER_EXPRESSIONS) {
                const key = `${dir}_expr_${name}`;
                s.expressions[name] = {
                    img: this.assets.get(key) || this.assets.load(key, `assets/${dir}/expressions/${name}.png`),
                    frameCount: s.frameCount, cellSize: s.cellSize,
                    cropX: s.cropX, cropY: s.cropY, cropW: s.cropW, cropH: s.cropH
                };
            }
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.imageSmoothingEnabled = false;
    }
    attach() { window.addEventListener('resize', this._onResize); this.resize(); }
    detach() { window.removeEventListener('resize', this._onResize); }

    resetActors() {
        for (const p of [this.p1, this.p2]) {
            p.expression = null; p._exprBase = null; p._exprTimer = 0;
            p.scaredTimer = 0; p.hurtTimer = 0; p._faceLock = false;
            p.vx = p.vy = 0;
        }
        const s = this.saw;
        s.spin = 0; s.rotation = 0; s.dragX = s.dragY = 0;
        s.dropped = false;
        this.speech = null;
        this._fogPhase = 0;
        this.bloodScreen.reset();
        this.overlay = null;
        this.renderer.screenShake = 0;
        this.renderer.setIntroZoomFactor(1);
        this.renderer.resetSway?.();
    }

    _express(p, name) {
        p.expression = name;
        p._exprBase = name;
        p._exprTimer = 0;
    }
    _expressFor(p, name, seconds) {
        p._exprBase = p._exprBase ?? p.expression ?? null;
        p.expression = name;
        p._exprTimer = seconds;
    }
    _bothExpressFor(name, seconds) {
        this._expressFor(this.p1, name, seconds);
        this._expressFor(this.p2, name, seconds);
    }
    _tickExpressions(dt) {
        for (const p of [this.p1, this.p2]) {
            if (p._exprTimer > 0) {
                p._exprTimer -= dt;
                if (p._exprTimer <= 0) p.expression = p._exprBase ?? null;
            }
        }
    }

    get portrait() { return this.canvas.height > this.canvas.width; }
    get refSize() { return Math.min(this.canvas.width, this.canvas.height); }
    get barH() { return this.bars.inset(this.canvas.height); }
    get fitW() { return this.portrait ? 0.45 : 0.5; }
    get fitH() { return this.portrait ? 0.36 : 0.4; }
    get fitDown() { return this.portrait ? 0.30 : this.fitH; }

    portraitClampY(y, zoom, top, bottom, { w = this.canvas.width, h = this.canvas.height, inset = this.barH, rot = 0 } = {}) {
        if (!this.portrait || !(zoom > 0)) return y;
        const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
        const half = ((w / 2) * s + (h / 2 - inset) * c) / zoom;
        const lo = top + half, hi = bottom - half;
        return lo <= hi ? Math.max(lo, Math.min(hi, y)) : (lo + hi) / 2;
    }

    _zoomFit() {
        const margin = 90;
        if (this.portrait) return this.refSize / (ROOM_ROWS * TILE + margin * 2);
        return Math.min(
            this.canvas.width / (ROOM_COLS * TILE + margin * 2),
            this.canvas.height / (ROOM_ROWS * TILE + margin * 2)
        );
    }
    _camTo(x, y, zoom, lerpK = 0.12) {
        const r = this.renderer;
        r.camX += (x - r.camX) * lerpK;
        r.camY += (y - r.camY) * lerpK;
        r.zoom += (zoom - r.zoom) * (lerpK * 0.8);
    }

    _drawSawGlow(ctx, pos) {
        if (!pos) return;
        const spin = this.saw.spin ?? 0;
        const r = (this.saw.discRadius ?? 32);
        const intensity = 0.22 + spin * 0.45;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 1.9);
        g.addColorStop(0, `rgba(150, 196, 255, ${0.5 * intensity})`);
        g.addColorStop(0.5, `rgba(120, 170, 255, ${0.22 * intensity})`);
        g.addColorStop(1, 'rgba(120, 170, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 1.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(210, 230, 255, ${0.3 * intensity})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    tickFog(dt) { this._fogPhase += dt * 0.06; }

    _drawFog() {
        this.drawFogOn(this.ctx, this.canvas.width, this.canvas.height, this._fogPhase);
    }

    drawFogOn(ctx, w, h, ph = this._fogPhase) {
        const banks = [
            { cy: h * 0.82, r: h * 0.55, color: '70, 60, 95', base: 0.16, n: 4, speed: 1.0, drift: w * 0.5 },
            { cy: h * 0.35, r: h * 0.45, color: '60, 70, 110', base: 0.08, n: 3, speed: 0.6, drift: w * 0.6 }
        ];
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (const bank of banks) {
            for (let i = 0; i < bank.n; i++) {
                const phase = ph * bank.speed + (i / bank.n) * Math.PI * 2;
                const cx = w * 0.5 + Math.sin(phase) * bank.drift;
                const cy = bank.cy + Math.cos(phase * 0.7) * (h * 0.05);
                const a = bank.base * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(phase * 1.3)));
                const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, bank.r);
                g.addColorStop(0, `rgba(${bank.color}, ${a})`);
                g.addColorStop(0.6, `rgba(${bank.color}, ${a * 0.4})`);
                g.addColorStop(1, `rgba(${bank.color}, 0)`);
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, w, h);
            }
        }
        ctx.restore();
    }

    drawLetterbox() {
        this.bars.draw(this.ctx, this.canvas.width, this.canvas.height);
    }

    logoScale() {
        const img = this.logo;
        if (!img?.naturalWidth) return 0;
        const { width: W, height: H } = this.canvas;
        const wk = this.portrait ? 0.86 : 0.5;
        return Math.max(1, Math.floor(Math.min(W * wk / img.naturalWidth, H * 0.4 / img.naturalHeight)));
    }

    drawTitleLogo(red = 0, alpha = 1, cy = this.canvas.height / 2) {
        const { ctx, canvas } = this;
        const img = this.logo;
        const s = this.logoScale();
        if (!s) return null;
        const w = img.naturalWidth * s, h = img.naturalHeight * s;
        const jx = red > 0 ? Math.round((Math.random() - 0.5) * 6 * red) : 0;
        const jy = red > 0 ? Math.round((Math.random() - 0.5) * 4 * red) : 0;
        const x = Math.round((canvas.width - w) / 2) + jx;
        const y = Math.round(cy - h / 2) + jy;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = alpha;
        ctx.drawImage(red > 0.5 ? this._redLogo() : img, x, y, w, h);
        ctx.restore();
        return { x, y, w, h };
    }

    _redLogo() {
        if (this._logoRed) return this._logoRed;
        const img = this.logo;
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const data = g.getImageData(0, 0, c.width, c.height);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
            const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            d[i] = Math.min(255, 40 + l * 1.05);
            d[i + 1] = l * 0.2;
            d[i + 2] = l * 0.27;
        }
        g.putImageData(data, 0, 0);
        return (this._logoRed = c);
    }

    _speak(who, text, dur) { this.speech = { who, text, t: 0, dur, shown: 0 }; }
    tickSpeech(dt) {
        if (!this.speech) return;
        const sp = this.speech;
        sp.t += dt;
        const n = Math.min(sp.text.length, Math.floor(sp.t * 40));
        for (let i = sp.shown; i < n; i++) {
            if (sp.text[i] === ' ') continue;
            const red = sp.who === this.redPlayer;
            this.audio?.play('blip', { vol: 0.22, rate: (red ? 0.92 : 1.18) * (1 + 0.05 * ((i * 7) % 3 - 1)), cool: 0.018, jitter: 0, noSlow: true });
        }
        sp.shown = n;
        if (sp.t >= sp.dur) this.speech = null;
    }

    hookAudio() { hookRendererAudio(this.renderer, () => this.audio); }
    drawSpeech() {
        if (!this.speech) return;
        const { ctx, renderer, canvas } = this;
        const who = this.speech.who;
        const scr = renderer.worldToScreen(who.x, who.y - 46);

        const inK = easeOut(clamp01(this.speech.t / 0.18));
        const outK = this.speech.t > this.speech.dur - 0.2
            ? clamp01((this.speech.dur - this.speech.t) / 0.2) : 1;
        const alpha = inK * outK;
        const scale = lerp(0.8, 1, inK);

        const text = this.speech.text;
        const chars = Math.floor(this.speech.t * 40);
        const key = `${text}|${chars}|${who.color}`;
        if (!this._bubbleCache || this._bubbleCache.key !== key) {
            this._bubbleCache = { key, ...renderSpeechBubble(text, who.color, chars) };
        }
        const { canvas: art, tipX, tipY } = this._bubbleCache;

        const gamePx = (TILE / 16) * scr.zoom;
        const maxP = Math.floor((canvas.width * (this.portrait ? 0.86 : 0.55)) / art.width);
        const baseP = Math.max(2, Math.min(Math.round(gamePx * BUBBLE_PIXEL_RATIO), maxP));
        const P = baseP * scale;
        const dw = Math.round(art.width * P);
        const dh = Math.round(art.height * P);
        const rise = (1 - inK) * 4 * P;
        let dx = Math.round(scr.x - tipX * P);
        let dy = Math.round(scr.y - 6 - tipY * P + rise);
        const margin = this.barH + 8;
        dx = Math.max(8, Math.min(dx, canvas.width - dw - 8));
        dy = Math.max(margin, dy);

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(art, dx, dy, dw, dh);
        ctx.restore();
    }
}
