import { drawText, measureText } from './PixelFont.js';
import { FRAME } from './PixelButton.js';

const MAX_LIVES = 3;
const HEART_FRAME = { FULL: 0, EMPTY: 1, HALF_L: 2, HALF_R: 3 };
const HEART_ART = 16;

const BELOW_EDGE_ROWS = 6;

const REDUCED_MOTION = typeof window !== 'undefined' && !!window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const MOTION = REDUCED_MOTION ? 0.35 : 1;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class Spring {
    constructor(value, k, c) {
        this.x = value; this.v = 0; this.target = value; this.k = k; this.c = c;
    }
    update(dt) {
        const a = -this.k * (this.x - this.target) - this.c * this.v;
        this.v += a * dt;
        this.x += this.v * dt;
    }
    kick(v) { this.v += v; }
    set(x) { this.x = x; }
}

class Portrait {

    constructor({ side, sprite, walk, expressions }) {
        this.side = side;

        this.flip = side === 'right';
        this.towardCenter = side === 'left' ? 1 : -1;
        this.sprite = sprite;
        this.walk = walk;
        this.expressions = expressions;
        this.seed = Math.random() * 100;

        this._buf = document.createElement('canvas');
        this._buf.width = sprite.cropW;
        this._buf.height = sprite.cropH;
        this._bctx = this._buf.getContext('2d');

        this.reset();
    }

    reset() {
        this.t = 0;
        this.base = 'neutro';
        this.seq = [];
        this.seqT = 0;
        this.idleWait = rand(1.2, 2.6);
        this.blinkT = rand(1.5, 4);
        this.blinking = 0;
        this.flashT = 0;
        this.redT = 0;
        this.trauma = 0;
        this.pending = [];
        this.dead = false;
        this.paused = false;

        this.squash = new Spring(1, 320, 13);
        this.hop = new Spring(0, 140, 11);
        this.push = new Spring(0, 120, 12);
        this.lean = new Spring(0, 45, 9);
        this.sink = new Spring(0, 30, 9);
        this.walkPhase = 0;
        this.walkAmt = 0;
        this.tilt = 0;
    }

    _play(steps) {
        this.seq = steps.map(s => ({ ...s }));
        this.seqT = 0;
        this.idleWait = rand(1.5, 3);
    }

    _later(t, fn) { this.pending.push({ t, fn }); }

    hurt() {
        this.flashT = 0.1;
        this.redT = 0.45;
        this.trauma = 1;
        this.squash.set(0.74);
        this.squash.kick(-1.5);
        this.hop.kick(30);
        this.push.kick(-this.towardCenter * 40);
        this.blinking = 0;
        this._play([
            { expr: 'assustado', dur: 1.0 },
            { expr: 'preocupado', dur: 0.9 }
        ]);
    }

    partnerHurt() {

        this._later(0.06, () => {
            this.hop.kick(-40);
            this.squash.set(1.12);
            this.lean.kick(this.towardCenter * 3);
            this._play([
                { expr: 'espantado', dur: 0.45, lean: this.towardCenter },
                { look: this.towardCenter, dur: 0.7 }
            ]);
        });
    }

    roomEnter(combat, delay) {
        this._later(delay, () => {

            this.squash.set(0.86);
            this.squash.kick(4.5);
            this.hop.kick(-80);
            this._play(combat
                ? [
                    { expr: 'espantado', dur: 0.5 },
                    { expr: 'desconfiado', dur: 0.55, lean: this.towardCenter },
                    { expr: 'raiva', dur: 1.1 }
                ]
                : [
                    { expr: 'espantado', dur: 0.3 },
                    { look: -1, dur: 0.45 },
                    { look: 1, dur: 0.45 },
                    { look: 'up', dur: 0.4 }
                ]);
        });
    }

    roomCleared(delay) {
        this._later(delay, () => {
            this.hop.kick(-50);
            this.squash.set(1.1);
            this._play([
                { expr: 'olhos_fechados', dur: 0.55 },
                { look: this.towardCenter, dur: 0.5 }
            ]);
        });
    }

    setPaused(paused, delay = 0) {
        if (paused === this.paused) return;
        this.paused = paused;
        this.seq = [];
        this.seqT = 0;
        this.idleWait = rand(1.5, 3);
        this._later(delay, () => {
            this.hop.kick(paused ? -40 : -25);
            this.squash.set(paused ? 1.1 : 0.92);
        });
    }

    healed() {
        this.hop.kick(-35);
        this.squash.set(1.08);
        this._play([{ expr: 'olhos_fechados', dur: 0.35 }]);
    }

    update(dt, player) {
        this.t += dt;
        const lives = player ? player.lives : MAX_LIVES;
        this.dead = lives <= 0;
        this.base = this.dead ? 'olhos_fechados' : (lives === 1 ? 'preocupado' : 'neutro');

        for (let i = this.pending.length - 1; i >= 0; i--) {
            const p = this.pending[i];
            p.t -= dt;
            if (p.t <= 0) { this.pending.splice(i, 1); p.fn(); }
        }

        if (this.seq.length) {
            this.seqT += dt;
            if (this.seqT >= this.seq[0].dur) {
                this.seq.shift();
                this.seqT = 0;
            }
        } else if (!this.dead && !this.paused) {

            this.idleWait -= dt;
            if (this.idleWait <= 0) {
                const nervous = lives === 1;
                const look = pick([-1, 1, -1, 1, 'up', 'sus']);
                this.seq = look === 'sus'
                    ? [{ expr: 'desconfiado', dur: rand(0.6, 1.1), idle: true }]
                    : [{ look, dur: nervous ? rand(0.3, 0.6) : rand(0.6, 1.3), idle: true }];
                this.seqT = 0;
                this.idleWait = nervous ? rand(0.5, 1.4) : rand(1.6, 4.0);
            }
        }

        if (this.blinking > 0) this.blinking -= dt;
        this.blinkT -= dt;
        if (this.blinkT <= 0) {
            this.blinking = 0.11;
            this.blinkT = Math.random() < 0.2 ? 0.25 : rand(2, 5);
        }

        const step = this.seq[0];
        let leanTarget = 0;
        if (step) {
            if (typeof step.lean === 'number') leanTarget = step.lean;
            else if (step.look === -1 || step.look === 1) leanTarget = step.look;
        }
        this.lean.target = leanTarget;

        const speed = player?.speed || 4.2;
        const live = player && !this.dead && !this.paused;
        const moveAmt = live ? clamp((player.speedMag || 0) / speed, 0, 1) : 0;
        this.walkAmt += (moveAmt - this.walkAmt) * Math.min(1, dt * 8);
        this.walkPhase += dt * (4 + this.walkAmt * 7);
        const tiltTarget = live ? clamp((player.vx || 0) / speed, -1, 1) * 0.1 : 0;
        this.tilt += (tiltTarget - this.tilt) * Math.min(1, dt * 6);

        this.sink.target = this.dead ? 9 : 0;

        this.squash.update(dt);
        this.hop.update(dt);
        this.push.update(dt);
        this.lean.update(dt);
        this.sink.update(dt);

        this.trauma = Math.max(0, this.trauma - dt * 2.2);
        if (this.flashT > 0) this.flashT -= dt;
        if (this.redT > 0) this.redT -= dt;
    }

    _exprName() {
        const step = this.seq[0];
        let name = this.base;

        if (this.paused && !this.dead) name = 'olhando_cima';
        else if (step) {
            if (step.expr) name = step.expr;
            else if (step.look === 'up') name = 'olhando_cima';
            else if (step.look === -1 || step.look === 1) {

                const imgDir = this.flip ? -step.look : step.look;
                name = imgDir < 0 ? 'olhando_esquerda' : 'olhando_direita';
            }
        }
        const noBlink = name === 'espantado' || name === 'assustado' || name === 'olhos_fechados';
        if (this.blinking > 0 && !noBlink) name = 'olhos_fechados';
        return name;
    }

    _sheet(name) {
        const img = this.expressions[name];
        if (img && img.complete && img.naturalWidth > 0) return img;
        return this.walk;
    }

    draw(ctx, ax, ay, S) {
        const s = this.sprite;
        const img = this._sheet(this._exprName());
        if (!img || !img.complete || !img.naturalWidth) return;

        const b = this._bctx;
        b.globalCompositeOperation = 'source-over';
        b.clearRect(0, 0, s.cropW, s.cropH);
        b.drawImage(img, s.cropX, s.cropY, s.cropW, s.cropH, 0, 0, s.cropW, s.cropH);
        let tint = null;
        if (this.flashT > 0) tint = 'rgba(255,255,255,1)';
        else if (this.redT > 0) tint = `rgba(220,30,50,${(this.redT / 0.45) * 0.55 * MOTION})`;
        else if (this.dead) tint = 'rgba(20,16,28,0.55)';
        if (tint) {
            b.globalCompositeOperation = 'source-atop';
            b.fillStyle = tint;
            b.fillRect(0, 0, s.cropW, s.cropH);
        }

        const t = this.t + this.seed;

        const breathHz = this.base === 'preocupado' ? 1.25 : 0.55;
        const breath = Math.sin(t * Math.PI * 2 * breathHz) * 0.022;
        const sy = this.squash.x * (1 + breath);
        const sx = (1 + (1 - this.squash.x) * 0.8) * (1 - breath * 0.6);

        const tr = this.trauma * this.trauma * MOTION;
        const rot = Math.sin(t * 0.9) * 0.028
            + this.lean.x * 0.07
            + this.tilt
            + Math.sin(this.walkPhase) * 0.05 * this.walkAmt
            + Math.sin(t * 41) * 0.16 * tr;

        const dx = (this.lean.x * 1.2 + this.push.x + Math.sin(t * 57) * 2.2 * tr) * S;
        const bob = Math.abs(Math.sin(this.walkPhase)) * 1.4 * this.walkAmt;
        const dy = (this.hop.x + this.sink.x - bob + Math.sin(t * 0.7) * 0.3) * S;

        const w = s.cropW * S, h = s.cropH * S;
        ctx.save();
        ctx.translate(ax + dx, ay + dy);
        ctx.rotate(rot);
        ctx.scale(sx, sy);
        if (this.flip) ctx.scale(-1, 1);
        ctx.drawImage(this._buf, -w / 2, -h, w, h);
        ctx.restore();
    }
}

class HeartRow {
    constructor(dir) {
        this.dir = dir;
        this.reset(MAX_LIVES);
    }

    reset(lives) {
        this.t = Math.random() * 10;
        this.slots = Array.from({ length: MAX_LIVES }, (_, i) => ({
            full: i < lives,
            scale: new Spring(1, 380, 14),
            shake: 0
        }));
        this.debris = [];
        this.lives = lives;
    }

    setLives(lives) {
        lives = clamp(lives, 0, MAX_LIVES);
        if (lives < this.lives) {
            for (let i = this.lives - 1; i >= lives; i--) this._break(i, this.slotPos(i));
            for (let i = 0; i < lives; i++) this.slots[i].shake = 0.4;
        } else if (lives > this.lives) {
            for (let i = this.lives; i < lives; i++) {
                const sl = this.slots[i];
                sl.full = true;
                sl.scale.set(0.2);
                sl.scale.kick(12);
            }
        }
        this.lives = lives;
    }

    _break(i, p) {
        const sl = this.slots[i];
        sl.full = false;
        sl.scale.set(1.45);
        sl.shake = 0.35;

        for (const [frame, side] of [[HEART_FRAME.HALF_L, -1], [HEART_FRAME.HALF_R, 1]]) {

            this.debris.push({
                frame, x: p.x + side * 2, y: p.y,
                vx: side * rand(25, 45), vy: rand(-95, -70),
                rot: 0, vr: side * rand(4, 7), life: 0.9
            });
        }
    }

    update(dt) {
        this.t += dt;
        for (const sl of this.slots) {
            sl.scale.update(dt);
            if (sl.shake > 0) sl.shake = Math.max(0, sl.shake - dt);
        }
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.vy += 320 * dt;
            d.x += d.vx * dt;
            d.y += d.vy * dt;
            d.rot += d.vr * dt;
            d.life -= dt;
            if (d.life <= 0) this.debris.splice(i, 1);
        }
    }

    slotPos(i) {
        return { x: this.dir * (i * (HEART_ART + 2) + HEART_ART / 2), y: 0 };
    }

    draw(ctx, img, x0, y0, hs) {
        if (!img || !img.complete || !img.naturalWidth) return;
        const size = HEART_ART * hs;
        const step = (HEART_ART + 2) * hs;
        this.slots.forEach((sl, i) => {
            const cx = x0 + this.dir * (i * step + size / 2);

            let cy = y0 + Math.sin(this.t * 2.4 - i * 0.8) * hs * 0.5;
            let sc = sl.scale.x;

            if (sl.full && this.lives === 1) {
                const ph = (this.t * 1.1) % 1;
                const beat = Math.exp(-((ph - 0.08) ** 2) / 0.002) + 0.7 * Math.exp(-((ph - 0.26) ** 2) / 0.002);
                sc += beat * 0.16 * MOTION;
            }
            let rx = 0, rr = 0;
            if (sl.shake > 0) {
                const k = (sl.shake / 0.4) * MOTION;
                rx = Math.sin(this.t * 70 + i) * hs * 1.2 * k;
                rr = Math.sin(this.t * 53 + i) * 0.18 * k;
            }
            ctx.save();
            ctx.translate(Math.round(cx + rx), Math.round(cy));
            ctx.rotate(rr);
            ctx.scale(sc, sc);
            const frame = sl.full ? HEART_FRAME.FULL : HEART_FRAME.EMPTY;
            ctx.drawImage(img, frame * HEART_ART, 0, HEART_ART, HEART_ART, -size / 2, -size / 2, size, size);
            ctx.restore();
        });

        for (const d of this.debris) {
            ctx.save();
            ctx.globalAlpha = clamp(d.life / 0.3, 0, 1);
            ctx.translate(x0 + d.x * hs, y0 + d.y * hs);
            ctx.rotate(d.rot);
            ctx.drawImage(img, d.frame * HEART_ART, 0, HEART_ART, HEART_ART, -size / 2, -size / 2, size, size);
            ctx.restore();
        }
    }
}

// Barra de dash: mesma linguagem da barra de loading (moldura de pedra chanfrada,
// poço escuro, células com brilho em cima e sombra embaixo), em miniatura ao lado do rótulo.
const DASH_SEGMENTS = 5;
const DASH_SEG_W = 5;
const DASH_SEG_H = 3;
const DASH_GLYPH_W = 4;
const DASH_INNER_W = 1 + DASH_GLYPH_W + 1 + 1 + DASH_SEGMENTS * DASH_SEG_W + (DASH_SEGMENTS - 1);
const DASH_W = DASH_INNER_W + 4;
const DASH_H = DASH_SEG_H + 4;
const DASH_SEG_FLASH = 0.16;
const DASH_GLINT_PERIOD = 1.8;

const DASH_RAMPS = [
    { base: '#c99a2e', light: '#f2cf5b', dark: '#8a6414', spec: '#fff2b0', flash: '#fff6dc' },
    { base: '#3d7fb0', light: '#6bb4db', dark: '#22506f', spec: '#cdeeff', flash: '#f2fbff' }
];

class DashBar {
    constructor(dir, ramp) {
        this.dir = dir;
        this.ramp = ramp;
        this._buf = document.createElement('canvas');
        this._buf.width = DASH_W;
        this._buf.height = DASH_H;
        this._bctx = this._buf.getContext('2d');
        this.reset();
    }

    reset() {
        this.visible = false;
        this.t = 0;
        this.lit = DASH_SEGMENTS;
        this.litAt = new Array(DASH_SEGMENTS).fill(-1e9);
        this.readyT = 0;
        this.shake = 0;
        this.pop = new Spring(1, 380, 14);
    }

    hide() {
        this.visible = false;
    }

    update(dt, charge) {
        this.t += dt;
        const lit = Math.floor(clamp(charge, 0, 1) * DASH_SEGMENTS + 1e-6);
        if (!this.visible) {
            this.visible = true;
            this.lit = lit;
            this.readyT = this.t - DASH_SEG_FLASH;
            this.pop.set(0.35);
            this.pop.kick(10);
        }
        if (lit < this.lit) {
            this.shake = 0.25;
            this.pop.set(0.9);
        } else if (lit > this.lit) {
            for (let i = this.lit; i < lit; i++) this.litAt[i] = this.t + (i - this.lit) * 0.04;
            if (lit === DASH_SEGMENTS) {
                this.readyT = this.t;
                this.pop.set(1.25);
                this.pop.kick(-4);
            }
        }
        this.lit = lit;
        this.charge = clamp(charge, 0, 1);
        this.pop.update(dt);
        if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    }

    _render() {
        const g = this._bctx, R = this.ramp, F = FRAME;
        const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
        const rect = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
        const chamfer = (x, y, w, h, c) => { rect(x + 1, y, w - 2, h, c); rect(x, y + 1, w, h - 2, c); };
        const W = DASH_W, H = DASH_H;
        g.clearRect(0, 0, W, H);
        chamfer(0, 0, W, H, F.outline);
        chamfer(1, 1, W - 2, H - 2, F.stone);
        rect(2, 1, W - 4, 1, F.stoneLight);
        rect(1, 2, 1, H - 4, F.stoneLight);
        rect(2, H - 2, W - 4, 1, F.stoneDark);
        rect(W - 2, 2, 1, H - 4, F.stoneDark);
        for (let x = 9; x < W - 4; x += 11) px(x, 1, F.seam);
        rect(2, 2, DASH_INNER_W, DASH_SEG_H, F.well);

        const ready = this.lit === DASH_SEGMENTS;
        const sinceReady = this.t - this.readyT;
        const gx = 3, gy = 2;
        const glyphLit = ready && (sinceReady < DASH_SEG_FLASH ? 'flash' : 'on');
        const gc = glyphLit === 'flash' ? R.flash : glyphLit ? R.light : F.ironDark;
        px(gx, gy + 1, gc);
        rect(gx + 2, gy, 1, 3, gc);
        px(gx + 3, gy + 1, gc);

        const sepX = gx + DASH_GLYPH_W + 1;
        rect(sepX, 2, 1, DASH_SEG_H, F.stoneDark);

        const sx0 = sepX + 1;
        const glintX = ready && MOTION === 1
            ? Math.floor(((sinceReady % DASH_GLINT_PERIOD) / DASH_GLINT_PERIOD) * (DASH_SEGMENTS * (DASH_SEG_W + 1)) * 2)
            : -1;
        for (let i = 0; i < DASH_SEGMENTS; i++) {
            const x = sx0 + i * (DASH_SEG_W + 1);
            if (i < this.lit) {
                const age = this.t - this.litAt[i];
                if (age >= 0 && age < DASH_SEG_FLASH * 0.5) {
                    rect(x, 2, DASH_SEG_W, DASH_SEG_H, R.flash);
                    continue;
                }
                const fresh = age >= 0 && age < DASH_SEG_FLASH;
                rect(x, 2, DASH_SEG_W, DASH_SEG_H, fresh ? R.light : R.base);
                rect(x, 2, DASH_SEG_W, 1, fresh ? R.spec : R.light);
                rect(x, 2 + DASH_SEG_H - 1, DASH_SEG_W, 1, R.dark);
                px(x, 2, R.spec);
            } else if (i === this.lit) {
                const part = Math.round((this.charge * DASH_SEGMENTS - i) * DASH_SEG_W);
                if (part > 0) rect(x, 3, part, DASH_SEG_H - 1, R.dark);
            }
        }
        if (glintX >= 0) {
            const gxp = sx0 + glintX;
            if (gxp < sx0 + DASH_SEGMENTS * (DASH_SEG_W + 1) - 1 && (gxp - sx0) % (DASH_SEG_W + 1) !== DASH_SEG_W) {
                rect(gxp, 2, 1, DASH_SEG_H - 1, R.flash);
            }
        }
        return this._buf;
    }

    // x = ponta do lado do rótulo; a barra cresce na direção de `dir`.
    // A sombra fica fora do buffer para continuar caindo à direita/abaixo quando espelhada.
    draw(ctx, x, y, hs) {
        const buf = this._render();
        const w = DASH_W * hs, h = DASH_H * hs;
        const k = this.shake > 0 ? (this.shake / 0.25) * MOTION : 0;
        const sx = Math.sin(this.t * 70) * hs * k;
        ctx.save();
        ctx.translate(Math.round(x + sx), Math.round(y + h / 2));
        ctx.scale(this.pop.x, this.pop.x);
        const left = this.dir > 0 ? 0 : -w;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#000';
        ctx.fillRect(left + 2 * hs, -h / 2 + hs, w - 2 * hs, h);
        ctx.fillRect(left + hs, -h / 2 + 2 * hs, w, h - 2 * hs);
        ctx.globalAlpha = 1;
        if (this.dir < 0) ctx.scale(-1, 1);
        ctx.drawImage(buf, 0, -h / 2, w, h);
        ctx.restore();
    }
}

export class VtuberHud {

    constructor({ assets, getPlayers, spriteConfigs, colors }) {
        this.assets = assets;
        this.getPlayers = getPlayers;
        this.heartImg = assets.get('heart');

        const dirs = ['player_01', 'player_02'];
        const sides = ['left', 'right'];
        this.entries = spriteConfigs.map((sprite, i) => {
            const expressions = {};
            for (const [key, img] of Object.entries(assets.images)) {
                const prefix = `${dirs[i]}_expr_`;
                if (key.startsWith(prefix)) expressions[key.slice(prefix.length)] = img;
            }
            const side = sides[i];
            return {
                side,
                color: colors[i],
                label: this._makeLabel(`P${i + 1}`, colors[i]),
                portrait: new Portrait({ side, sprite, walk: assets.get(i === 0 ? 'p1' : 'p2'), expressions }),
                hearts: new HeartRow(side === 'left' ? 1 : -1),
                dash: new DashBar(side === 'left' ? 1 : -1, DASH_RAMPS[i] ?? DASH_RAMPS[0]),
                player: null,
                seen: MAX_LIVES,
                layout: null
            };
        });
        this._last = null;
    }

    _makeLabel(text, color) {
        const c = document.createElement('canvas');
        c.width = measureText(text) + 1;
        c.height = 7;
        const g = c.getContext('2d');
        drawText(g, text, 1, 2, '#0b0910');
        drawText(g, text, 0, 1, color);
        return c;
    }

    reset() {
        const players = this.getPlayers() || [];
        this.entries.forEach((e, i) => {
            const p = players[i];
            e.player = p || null;
            e.seen = p ? p.lives : MAX_LIVES;
            e.portrait.reset();
            e.hearts.reset(e.seen);
            e.dash.reset();
        });
    }

    onRoomEnter(combat) {
        this.entries.forEach((e, i) => e.portrait.roomEnter(combat, i * 0.09));
    }

    setPaused(paused) {
        this.entries.forEach((e, i) => e.portrait.setPaused(!!paused, i * 0.07));
    }

    onRoomCleared() {
        this.entries.forEach((e, i) => e.portrait.roomCleared(0.15 + i * 0.1));
    }

    _layout(W, H) {
        const ref = Math.min(H, W * 0.6);
        const S = Math.max(4, Math.round((ref * 0.3) / 23));
        const hs = Math.max(2, Math.round(S * 0.38));
        const margin = Math.round(Math.max(10, S * 1.5));
        return { S, hs, margin };
    }

    draw(ctx, W, H) {
        const now = performance.now();
        const dt = this._last === null ? 0 : Math.min(0.05, (now - this._last) / 1000);
        this._last = now;

        const players = this.getPlayers() || [];
        const { S, hs, margin } = this._layout(W, H);

        this.entries.forEach((e, i) => {
            const p = players[i];
            if (p !== e.player) {
                e.player = p || null;
                e.seen = p ? p.lives : MAX_LIVES;
                e.portrait.reset();
                e.hearts.reset(e.seen);
                e.dash.reset();
            }
        });
        this.entries.forEach((e, i) => {
            const p = e.player;
            if (!p) return;
            const lives = clamp(p.lives, 0, MAX_LIVES);
            if (lives !== e.seen) {
                if (lives < e.seen) {
                    e.portrait.hurt();
                    this.entries[1 - i]?.portrait.partnerHurt();
                } else {
                    e.portrait.healed();
                }
                e.hearts.setLives(lives);
                e.seen = lives;
            }
        });

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.imageSmoothingEnabled = false;

        for (const e of this.entries) {
            e.portrait.update(dt, e.player);
            e.hearts.update(dt);

            const sp = e.portrait.sprite;
            const bustW = sp.cropW * S;
            const left = e.side === 'left';
            const ax = left ? margin + bustW / 2 : W - margin - bustW / 2;
            const ay = H + BELOW_EDGE_ROWS * S;

            const gx = ax, gy = H - 8 * S, gr = 22 * S;
            const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
            grad.addColorStop(0, 'rgba(5,4,10,0.6)');
            grad.addColorStop(0.55, 'rgba(5,4,10,0.35)');
            grad.addColorStop(1, 'rgba(5,4,10,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
            const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr * 0.7);
            glow.addColorStop(0, hexA(e.color, 0.22));
            glow.addColorStop(1, hexA(e.color, 0));
            ctx.fillStyle = glow;
            ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);

            e.portrait.draw(ctx, ax, ay, S);

            const gap = 2 * S;
            const x0 = left ? ax + bustW / 2 + gap : ax - bustW / 2 - gap;
            const y0 = H - margin - (HEART_ART * hs) / 2 - S * 2;
            e.hearts.draw(ctx, this.heartImg, x0, y0, hs);

            const lw = e.label.width * hs, lh = e.label.height * hs;
            const lx = left ? x0 : x0 - lw;
            const ly = y0 - (HEART_ART * hs) / 2 - lh - hs;
            ctx.drawImage(e.label, Math.round(lx), Math.round(ly), lw, lh);

            if (e.player?.dashEnabled) {
                e.dash.update(dt, e.player.dashCharge);
                const bx = left ? lx + lw + 2 * hs : lx - 2 * hs;
                e.dash.draw(ctx, bx, ly, hs);
            } else {
                e.dash.hide();
            }
        }
        ctx.restore();
    }
}

function hexA(hex, a) {
    const n = parseInt(String(hex).slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
