import { RoomTiles } from '../../../core/RoomTiles.js';
import { Physics } from '../../../core/Physics.js';
import { BloodCanvas } from '../../../particles/BloodCanvas.js';
import { ParticleSystem } from '../../../particles/ParticleSystem.js';
import { CombatSystem } from '../../../combat/CombatSystem.js';
import { SpawnSystem } from '../../../systems/SpawnSystem.js';
import { ScreenGore } from '../../../systems/ScreenGore.js';
import { PostProcessor } from '../../../systems/PostProcessor.js';
import { WindSystem } from '../../../systems/WindSystem.js';
import {
    TILE, BACKGROUND_TILE, DOOR_STUB_TILES, BLOOD_COLORS, BLOOD_PIXEL, MAX_ACTIVE_GIBS,
    PLAYER_LIGHT_RADIUS, LIGHT_PIXEL_SCALE, TORCHES, WIND
} from '../../../config/GameConfig.js';
import { buildFrenzyBeats, HORDE } from './FrenzyBeats.js';
import { HordeDirector } from './HordeDirector.js';
import { LensSplatter } from '../../fx/LensSplatter.js';

const COLS = 22, ROWS = 13;
const ROPE_LEN = 230;
const BUMP_DIST = 34;
const CAM_CLOSE = 1.3;
const HOLD_DIST = 250;

const lerp = (a, b, t) => a + (b - a) * t;

const SOFT = [
    { offset: 0.0, alpha: 1.0 }, { offset: 0.3, alpha: 0.62 },
    { offset: 0.55, alpha: 0.32 }, { offset: 0.8, alpha: 0.12 }, { offset: 1.0, alpha: 0 }
];
const LIGHT = {
    player: { color: '255, 214, 160', falloff: SOFT },
    fill: { color: '104, 86, 140', falloff: [{ offset: 0, alpha: 0.36 }, { offset: 0.6, alpha: 0.16 }, { offset: 1, alpha: 0 }], flickerBase: 1, flickerSine: 0, flickerNoise: 0 },
    saw: { color: '150, 196, 255', falloff: SOFT, flickerBase: 1, flickerSine: 0.05, flickerNoise: 0.02 },
    hell: { color: '255, 86, 48', falloff: [{ offset: 0, alpha: 0.95 }, { offset: 0.35, alpha: 0.55 }, { offset: 0.7, alpha: 0.2 }, { offset: 1, alpha: 0 }], flickerBase: 1, flickerSine: 0.12, flickerNoise: 0.08 },
    kill: { color: '255, 70, 50', falloff: SOFT, flickerBase: 1, flickerSine: 0, flickerNoise: 0.1 },
};

export class FrenzyScene {
    constructor(host) {
        this.host = host;
        const { assets, renderer, canvas, ctx } = host;

        this.doors = { N: true, S: true, E: true, W: true };
        this.tiles = new RoomTiles(COLS, ROWS, this.doors, 11, true);
        this.rect = { x: 0, y: 0, w: COLS * TILE, h: ROWS * TILE };
        const b = this.bounds = { minX: TILE, minY: TILE, maxX: this.rect.w - TILE, maxY: this.rect.h - TILE };
        this.doorHalf = TILE;
        const midC = (COLS / 2) | 0, midR = (ROWS / 2) | 0;
        this.doorList = [
            { dir: 'N', x: midC * TILE, y: b.minY },
            { dir: 'S', x: midC * TILE, y: b.maxY },
            { dir: 'E', x: b.maxX, y: midR * TILE },
            { dir: 'W', x: b.minX, y: midR * TILE },
        ];
        this.door = { x: b.maxX, y: midR * TILE };
        this._decorate();

        this.bloodCanvas = new BloodCanvas(this.rect.w, this.rect.h, BLOOD_COLORS, BLOOD_PIXEL);
        this.particles = new ParticleSystem(this.bloodCanvas);
        this.combat = new CombatSystem({ renderer, particleSystem: this.particles });
        this.spawner = new SpawnSystem({ assets, bloodCanvas: this.bloodCanvas });
        this.screenGore = new ScreenGore(canvas);
        this.lens = new LensSplatter(canvas);

        this.post = new PostProcessor(canvas, ctx, {
            lighting: { ambient: '44, 36, 54' },
            vignette: { strength: 0.72 }
        });

        this.wind = new WindSystem({ ...WIND, count: 140 });

        const S = this;
        this.targets = [host.p1, host.p2].map(p => ({
            get x() { return S.aimRope ? (host.p1.x + host.p2.x) / 2 : p.x; },
            get y() { return S.aimRope ? (host.p1.y + host.p2.y) / 2 + (p === host.p1 ? -20 : 20) : p.y; },
            takeDamage: () => false
        }));

        this.horde = new HordeDirector(this);
        this.beats = buildFrenzyBeats(this);
        this.reset();
    }

    _decorate() {
        const last = COLS - 1, bottom = ROWS - 1;
        const T = [];
        for (const c of [3, 7, 14, 18]) T.push({ col: c, row: 0, side: 'N', type: 'torch' });
        for (const r of [2, 9, bottom - 1]) {
            T.push({ col: 1, row: r, side: 'W', type: 'torch' });
            T.push({ col: last - 1, row: r, side: 'E', type: 'torch' });
        }
        this.tiles.torches = T;
    }

    reset() {
        this.active = false;
        this.enemies = [];
        this.gibs = [];
        this.killFlashes = [];
        this.kills = 0;
        this.beat = 0;
        this.beatT = 0;
        this.timeScale = 1;
        this.slowmoT = 0;
        this._slowScale = 0.3;
        this.doorGlow = 0;
        this._acc = 0;
        this._sparkAcc = 0;
        this.lone = null;
        this.hordeSpawned = 0;
        this.charging = false;
        this.aimRope = false;
        this._cutAt = null;
        this._loneDeadAt = Infinity;
        this.horde.reset(this.door);
        this.lens.clear();
        this.particles.clear();
        this.screenGore.clear();
    }

    start() {
        this.reset();
        this.active = true;
        this._age = 0;
        const { host } = this;
        const { p1, p2, saw, renderer } = host;

        for (let i = 0; i < 8; i++) {
            this.bloodCanvas.stampSplat(lerp(200, 1200, Math.random()), lerp(120, 700, Math.random()), 0.8 + Math.random());
        }

        this._initPlayer(p1, 1150, 330);
        this._initPlayer(p2, 1150, 450);
        p1.vx = p2.vx = -3.4;
        saw.pickup();
        saw.spin = 0.8;
        saw.dragX = saw.dragY = 0;

        this.lone = this.spawner.createEnemy(470, 395, 1, 'demon');
        this.lone.speed = 0;
        this.enemies.push(this.lone);

        const mid = this._mid();
        renderer.camX = mid.x;
        renderer.camY = mid.y;
        renderer.zoom = host._zoomFit() * 2.1 * CAM_CLOSE;
        this._enterBeat(0);
    }

    _initPlayer(p, x, y) {
        Object.assign(p, {
            x, y, vx: 0, vy: 0,
            goal: null,
            accel: 0.1,
            wobble: 0.3,
            wobPhase: Math.random() * 10,
            faceX: null,
            hopZ: 0, hopV: 0,
            shiver: 0,
            stumble: 0,
            tiltKick: 0,
            _faceLock: false,
            walkFrame: 0
        });
    }

    _mid() {
        const { p1, p2 } = this.host;
        return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    }

    _gibsCenter() {
        return this._lastKillPos ?? null;
    }

    _look(p, x, y = null) {
        if (y !== null && y < p.y - 120 && Math.abs(x - p.x) < 140) { this.host._express(p, 'olhando_cima'); return; }
        const front = (x >= p.x) !== !!p.facingLeft;
        this.host._express(p, front ? 'olhando_direita' : 'olhando_esquerda');
    }
    _face(p, x) { p.faceX = x; }
    _hop(p, v = 4.5) { if (p.hopZ <= 0.5) p.hopV = v; }
    _both(fn) { fn(this.host.p1); fn(this.host.p2); }
    _expr(p, name) { this.host._express(p, name); }
    _blink(p, secs = 0.14) { this.host._expressFor(p, 'olhos_fechados', secs); }
    _slowmo(secs, scale = 0.3) {
        this.slowmoT = secs; this._slowScale = scale;
        this.host.audio?.slowmo(scale, secs);
    }
    _sfx(name, x, y, o = {}) {
        const au = this.host.audio;
        if (!au) return null;
        const s = this.host.renderer.worldToScreen(x, y);
        return au.play(name, { pan: au.panX(s.x, this.host.canvas.width), ...o });
    }

    _stage(t, list) {
        for (let i = 0; i < list.length; i++) {
            if (t >= list[i][0] && !this._fired.has(i)) { this._fired.add(i); list[i][1](); }
        }
    }

    _enterBeat(i) {
        this.beat = i;
        this.beatT = 0;
        this._fired = new Set();
        this.beats[i]?.enter?.();
        const au = this.host.audio;
        const M = [[-6, 5000, 0.6], [-14, 1300, 0.5], [-7, 4000, 0.8], [-3, 12000, 0.6],
            [-4, 9000, 0.4], [-2, 16000, 0.6], [-16, 800, 0.35], [0, 20000, 0.12], [-6, 6000, 1.5]][i];
        if (au && M) au.mood(M[0], M[1], M[2]);
        if (au && i === 2) {
            au.play('roar', { vol: 0.85, rate: 0.85 });
            au.play('boom', { vol: 0.35, rate: 0.6 });
        }
        if (au && i === 6) au.play('riser', { vol: 0.6, delay: 0.4 });
        if (au && i === 7) { au.play('impact', { vol: 0.85 }); au.play('whoosh', { vol: 0.5 }); au.excite(0.6); }
    }

    _camFocus({ lean = null, leanK = 0, zoom = 2.0, lead = 0 } = {}) {
        const { p1, p2 } = this.host;
        const mid = this._mid();
        let x = mid.x, y = mid.y - 14;
        if (lead) {
            const vx = (p1.vx + p2.vx) / 2, vy = (p1.vy + p2.vy) / 2;
            const m = Math.hypot(vx, vy) || 1;
            x += (vx / m) * lead * Math.min(1, m / 4);
            y += (vy / m) * lead * Math.min(1, m / 4);
        }
        if (lean) { leanK *= 0.6; x = lerp(x, lean.x, leanK); y = lerp(y, lean.y, leanK); }

        const host = this.host;
        const W = host.canvas.width, H = host.canvas.height;
        const xs = [p1.x, p2.x], ys = [p1.y, p2.y];
        const fitOf = (px, py) => Math.min(
            (W * host.fitW) / (Math.max(...px.map(v => Math.abs(v - x))) + 70),
            (H * host.fitH) / (Math.max(...py.map(v => Math.abs(v - y))) + 80));
        const fitPlayers = fitOf(xs, ys);
        if (lean && leanK > 0.2) {
            const f = host.portrait ? 0.7 : 1;
            xs.push(lerp(x, lean.x, f)); ys.push(lerp(y, lean.y, f));
        }
        const base = host._zoomFit() * zoom * CAM_CLOSE;
        let z = Math.min(base, fitOf(xs, ys));
        if (host.portrait) {
            const minZ = (H - 2 * host.barH) / (this.rect.h + 80);
            z = Math.max(z, Math.min(minZ, fitPlayers, base));
            y = host.portraitClampY(y, z, -40, this.rect.h + 40);
        }
        return { x, y, zoom: z };
    }

    _camLookAt(pt, k, zoom = 1.55) {
        const a = this._camFocus({ zoom: 2.2 });
        const zb = this.host._zoomFit() * zoom * CAM_CLOSE;
        const z = Math.exp(lerp(Math.log(a.zoom), Math.log(zb), k));
        const y = this.host.portraitClampY(lerp(a.y, pt.y, k), z, -40, this.rect.h + 40);
        return { x: lerp(a.x, pt.x - 40, k), y, zoom: z };
    }

    _spawnHorde() {
        const i = this.hordeSpawned++;
        const x = this.door.x + 60 + Math.random() * 140;
        const y = this.door.y + (Math.random() - 0.5) * 80;
        const e = this.spawner.createEnemy(x, y, 3, i % 3 === 2 ? 'bloodMonster' : 'demon');
        e.animTime = (Math.random() * 40) | 0;
        e._horde = true;
        this._sfx('enemySpawn', x, y, { vol: 0.32, rate: 0.85 + Math.random() * 0.3, cool: 0.13 });
        this.enemies.push(e);
        this.horde.add(e);
    }

    get isDone() {
        const charge = this.beats.length - 2;
        return (this.beat === charge && this._cutAt != null && this.beatT >= this._cutAt)
            || this.beat > charge;
    }
    get reachedEnd() {
        return this.beat === this.beats.length - 1 && this.beatT > 3.5;
    }

    update(dt) {
        if (!this.active) return;
        this._age = (this._age ?? 0) + dt;
        if (this.slowmoT > 0) this.slowmoT -= dt;
        const target = this.slowmoT > 0 ? this._slowScale : 1;
        this.timeScale += (target - this.timeScale) * Math.min(1, dt * (target < this.timeScale ? 18 : 4));
        this._acc += dt * 60 * this.timeScale;
        this.host._fogPhase = (this.host._fogPhase ?? 0) + dt * 0.06;
        let steps = 0;
        while (this._acc >= 1 && steps < 4) { this._acc -= 1; steps++; this._step(); }
    }

    _step() {
        const STEP = 1 / 60;
        const { host } = this;
        const { p1, p2, saw, renderer } = host;
        this.beatT += STEP;

        const beat = this.beats[this.beat];
        beat.update?.(this.beatT);
        const done = beat.until ? beat.until() : false;
        if ((done || this.beatT >= beat.max) && this.beat < this.beats.length - 1) this._enterBeat(this.beat + 1);

        for (const p of [p1, p2]) this._drive(p, STEP);
        this._rope(p1, p2);
        for (const p of [p1, p2]) this._animate(p, STEP);

        saw.update(p1, p2);
        const sawPos = saw.getSawPositions(p1, p2)[0];
        const moving = Math.min(p1.speedMag, p2.speedMag) / p1.speed;
        this._sparkAcc += saw.spin * Math.min(1, moving) * 4;
        const emit = Math.floor(this._sparkAcc);
        if (emit > 0) {
            this._sparkAcc -= emit;
            this.particles.triggerSparks(sawPos.x, sawPos.y, saw.discRadius, saw.spinDir, emit);
        }
        const overBlood = this.bloodCanvas.isBloodZone(sawPos.x, sawPos.y);
        saw.setOnBlood(overBlood);
        if (overBlood && saw.spin > 0.3 && Math.random() < 0.5) {
            const a = Math.random() * Math.PI * 2;
            this.particles.triggerBloodDroplets(sawPos.x + Math.cos(a) * saw.discRadius, sawPos.y + Math.sin(a) * saw.discRadius, 2, 0.6);
        }
        if (saw.isHighSpeed && this.charging) renderer.triggerShake(2);

        this.horde.step();
        this.combat.updateEnemies(this.enemies.filter(e => !e._horde), this.targets);
        const live = this.enemies.filter(e => e.state !== 'dying');
        Physics.resolveEntityCollisions(live);
        for (const e of live) Physics.resolveCircleCollision(e, sawPos.x, sawPos.y, saw.collisionRadius);
        const b = this.bounds;
        for (const e of live) {
            if (e.x < b.maxX - 4) {
                e.x = Math.max(b.minX + 14, Math.min(b.maxX - 14, e.x));
                e.y = Math.max(b.minY + 14, Math.min(b.maxY - 14, e.y));
            } else {
                e.y = Math.max(this.door.y - 50, Math.min(this.door.y + 50, e.y));
            }
        }

        this.combat.resolveWeaponHits(saw, this.enemies, p1, p2, true, (e) => {
            this.kills++;
            this._lastKillPos = { x: e.x, y: e.y };
            this.killFlashes.push({ x: e.x, y: e.y, life: 1 });
            this._sfx('sawHit', e.x, e.y, { vol: 0.8, cool: 0.035 });
            this._sfx('splat', e.x, e.y, { vol: 0.45, cool: 0.05 });
            this.host.audio?.excite(0.15);
            this.beats[this.beat].onKill?.(e);
        });

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.readyToGib) continue;
            this.particles.triggerBlood(e.x, e.y, 26, 1.35);
            this.particles.triggerBloodPool(e.x, e.y, 1.2);
            this.gibs.push(...e.explodeIntoGibs());
            while (this.gibs.length > MAX_ACTIVE_GIBS) this.gibs.shift();
            this.enemies.splice(i, 1);
            renderer.triggerShake(8);
            this.screenGore.trigger(this.charging ? 0.3 : 0.6);
            this._sfx('splat', e.x, e.y, { vol: 0.65, rate: 0.85, cool: 0.04 });
            const s = renderer.worldToScreen(e.x, e.y);
            this.lens.trigger(s.x, s.y, this.charging ? 0.6 : 1);
        }
        for (let i = this.gibs.length - 1; i >= 0; i--) {
            this._updateGib(this.gibs[i]);
            if (this.gibs[i].done) this.gibs.splice(i, 1);
        }
        this.lens.update(STEP);

        for (let i = this.killFlashes.length - 1; i >= 0; i--) {
            this.killFlashes[i].life -= STEP * 2.2;
            if (this.killFlashes[i].life <= 0) this.killFlashes.splice(i, 1);
        }

        this.particles.update([p1, p2], this.bounds);
        this.wind.update(this.bounds);
        this.screenGore.update();

        const cam = beat.cam ? beat.cam() : this._camFocus();
        host._camTo(cam.x, cam.y, cam.zoom, 0.09);
    }

    _drive(p, STEP) {
        let tvx = 0, tvy = 0;
        const g = p.goal;
        if (g && g.speed !== undefined) {
            const dx = g.x - p.x, dy = g.y - p.y, d = Math.hypot(dx, dy);
            const sp = Math.min(g.speed, d * 0.08);
            if (d > 1) { tvx = dx / d * sp; tvy = dy / d * sp; }
        } else if (g) {
            tvx = g.vx; tvy = g.vy;
            if (g.holdY !== undefined) tvy += (g.holdY - p.y) * 0.08;
        }
        const m = Math.hypot(tvx, tvy);
        if (m > 0.5 && p.wobble > 0) {
            p.wobPhase += STEP * 9;
            const w = Math.sin(p.wobPhase) * p.wobble * m;
            tvx += (-tvy / m) * w; tvy += (tvx / m) * w * 0.5;
        }
        if (p.stumble > 0) { p.stumble -= STEP; tvx *= 0.3; tvy *= 0.3; p.tiltKick = 0.3; }

        const k = g ? p.accel : 0.06;
        p.vx += (tvx - p.vx) * k;
        p.vy += (tvy - p.vy) * k;
        p.x += p.vx;
        p.y += p.vy;
        const b = this.bounds;
        p.x = Math.max(b.minX + 10, Math.min(b.maxX + 40, p.x));
        p.y = Math.max(b.minY + 10, Math.min(b.maxY - 6, p.y));
    }

    _rope(p1, p2) {
        let dx = p2.x - p1.x, dy = p2.y - p1.y;
        const d = Math.hypot(dx, dy) || 1;
        const nx = dx / d, ny = dy / d;
        const vrel = (p2.vx - p1.vx) * nx + (p2.vy - p1.vy) * ny;
        if (d > ROPE_LEN) {
            const ex = (d - ROPE_LEN) / 2;
            p1.x += nx * ex; p1.y += ny * ex; p2.x -= nx * ex; p2.y -= ny * ex;
            if (vrel > 0) {
                const j = vrel * 0.85;
                p1.vx += nx * j; p1.vy += ny * j; p2.vx -= nx * j; p2.vy -= ny * j;
                if (vrel > 3) {
                    this._sfx('rope', (p1.x + p2.x) / 2, (p1.y + p2.y) / 2, { vol: Math.min(0.8, vrel / 8), cool: 0.25 });
                    this.beats[this.beat].onYank?.();
                }
            }
        } else if (d < BUMP_DIST) {
            const ex = (BUMP_DIST - d) / 2;
            p1.x -= nx * ex; p1.y -= ny * ex; p2.x += nx * ex; p2.y += ny * ex;
            if (vrel < 0) {
                const j = -vrel * 0.9;
                p1.vx -= nx * j; p1.vy -= ny * j; p2.vx += nx * j; p2.vy += ny * j;
                if (-vrel > 2.5) {
                    this.particles.triggerDust((p1.x + p2.x) / 2, (p1.y + p2.y) / 2 + 14, 0, -1, 12);
                    this._sfx('thud', (p1.x + p2.x) / 2, (p1.y + p2.y) / 2, { vol: 0.7, rate: 1.15, cool: 0.3 });
                    this.beats[this.beat].onBump?.();
                }
            }
        }
    }

    _animate(p, STEP) {
        const sp = p.speedMag;
        if (sp > 0.25) p.walkFrame += sp * 0.2;
        else p.walkFrame = 0;
        p.bobPhase += 0.12 + sp * 0.07;
        p.tiltKick *= 0.9;
        const tiltTarget = Math.max(-1, Math.min(1, p.vx / p.speed)) * 0.24 + p.tiltKick;
        p.tilt += (tiltTarget - p.tilt) * 0.18;
        if (p.faceX !== null && sp < 3.2) p.facingLeft = p.faceX < p.x;
        else if (p.vx < -0.4) p.facingLeft = true;
        else if (p.vx > 0.4) p.facingLeft = false;
        p.hopV -= 0.55;
        p.hopZ = Math.max(0, p.hopZ + p.hopV);
        if (p.hopZ === 0 && p.hopV < 0) p.hopV = 0;
    }

    _updateGib(g) {
        g.update(null);
        const s = this.host.renderer.worldToScreen(g.x, g.y);
        const { width: W, height: H } = this.host.canvas;
        if (s.y > H + 60 || s.x < -60 || s.x > W + 60) g.done = true;
    }

    render() {
        const { host } = this;
        const { ctx, renderer, p1, p2, saw } = host;

        renderer.beginFrame();
        this._worldTf = ctx.getTransform();
        renderer.drawBackground(BACKGROUND_TILE, TILE);

        const stub = DOOR_STUB_TILES * TILE;
        ctx.save();
        ctx.beginPath();
        ctx.rect(-stub, -stub, this.rect.w + stub * 2, this.rect.h + stub * 2);
        ctx.clip();

        renderer.drawRoom(this.rect, this.bounds, this.tiles, TILE, true, this.doorList, this.doorHalf);
        renderer.drawDoorStubs(this.rect, this.doorList, TILE, this.doorHalf, DOOR_STUB_TILES);
        renderer.drawDoorGradients(this.doorList, this.doorHalf, TILE, DOOR_STUB_TILES);

        this.particles.drawFloor(ctx, this.bounds);
        this.particles.drawSmoke(ctx);

        for (const p of [p1, p2]) renderer.drawRoundShadow(p.x, p.y, 14 - Math.min(6, p.hopZ * 0.6), 0);
        for (const e of this.enemies) if (!e.isHidden) renderer.drawRoundShadow(e.x, e.y, 13, 0);

        saw.drawChain(ctx, p1, p2);
        const sawPos = saw.getSawPositions(p1, p2)[0];
        const drawables = [p1, p2, ...this.enemies].sort((a, b) => a.y - b.y);
        const drawEnt = (e) => {
            if (e === p1 || e === p2) {
                const ox = e.shiver ? (Math.random() - 0.5) * e.shiver * 2 : 0;
                const oy = -e.hopZ;
                e.x += ox; e.y += oy; e.draw(ctx); e.x -= ox; e.y -= oy;
            } else e.draw(ctx);
        };
        drawables.filter(e => e.y <= sawPos.y).forEach(drawEnt);
        this.particles.drawSparks(ctx);
        drawables.filter(e => e.y > sawPos.y).forEach(drawEnt);

        this.particles.drawFlames(ctx);
        renderer.drawFrontWall(this.rect, this.tiles, TILE, true, this.doorList, this.doorHalf, DOOR_STUB_TILES);
        for (const g of this.gibs) g.draw(ctx);
        this.particles.drawAir(ctx);
        this.wind.draw(ctx);

        ctx.restore();
        renderer.endFrame();

        this._renderLights(sawPos);
        this.post.draw();
        host._drawFog();
        this.screenGore.draw(ctx);
        this.lens.draw(ctx);

        if (this._age < 0.6) {
            const { width: W, height: H } = host.canvas;
            ctx.save();
            ctx.fillStyle = `rgba(150, 0, 18, ${0.4 * (1 - this._age / 0.6)})`;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }

        ctx.save();
        ctx.setTransform(this._worldTf);
        host._drawSawGlow(ctx, sawPos);
        saw.draw(ctx, p1, p2);
        ctx.restore();
    }

    _renderLights(sawPos) {
        const pp = this.post;
        const r = this.host.renderer;
        const { p1, p2, saw } = this.host;
        const pix = (zoom, s = LIGHT_PIXEL_SCALE) => Math.max(2, Math.round((TILE / 16) * zoom * s));
        const ws = (x, y) => r.worldToScreen(x, y);

        const c = ws(this.rect.w / 2, this.rect.h / 2);
        pp.addLight(c.x, c.y, this.rect.w * 0.75 * c.zoom, pix(c.zoom, 1.4), 0.7, LIGHT.fill);

        if (TORCHES.enabled) {
            const tl = TORCHES.light, area = tl.area;
            const glow = { ...tl, falloff: tl.glow.falloff };
            const areaP = { ...tl, falloff: area.falloff };
            for (const t of this.tiles.torches) {
                let wx = t.col * TILE + TILE / 2, wy = t.row * TILE + TILE / 2, ax = 0, ay = 0;
                if (t.side === 'N') { wy += tl.offsetY; ay = area.pushIn; }
                else if (t.side === 'W') { wx += tl.offsetX; ax = area.pushIn; }
                else if (t.side === 'E') { wx -= tl.offsetX; ax = -area.pushIn; }
                const s = ws(wx, wy);
                const px = pix(s.zoom, tl.pixelScale);
                pp.addLight(s.x, s.y, tl.glow.radius * s.zoom, px, tl.glow.flatten, glow);
                const a = ws(wx + ax, wy + ay);
                pp.addLight(a.x, a.y, area.radius * 1.15 * s.zoom, px, area.flatten, areaP);
            }
        }

        for (const p of [p1, p2]) {
            const s = ws(p.x, p.y);
            pp.addLight(s.x, s.y, PLAYER_LIGHT_RADIUS * 1.35 * s.zoom, pix(s.zoom), 1, LIGHT.player);
        }

        const ss = ws(sawPos.x, sawPos.y);
        pp.addLight(ss.x, ss.y, (70 + saw.spin * 40) * ss.zoom, pix(ss.zoom), 1, LIGHT.saw);

        if (this.doorGlow > 0.01) {
            const d = ws(this.door.x + 30, this.door.y);
            const pulse = 0.8 + 0.2 * Math.sin(performance.now() / 140);
            pp.addSpotLight(d.x, d.y, -1, 0, 620 * d.zoom, 0.5, pix(d.zoom), LIGHT.hell, 0, this.doorGlow * pulse, 0.1);
            pp.addLight(d.x, d.y, 150 * d.zoom * this.doorGlow, pix(d.zoom), 0.9, LIGHT.hell);
        }

        for (const f of this.killFlashes) {
            const s = ws(f.x, f.y);
            pp.addLight(s.x, s.y, 130 * f.life * s.zoom, pix(s.zoom), 0.8, LIGHT.kill);
        }
    }
}

export { HORDE };
