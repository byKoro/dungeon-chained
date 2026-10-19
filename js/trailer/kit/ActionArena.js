/**
 * ActionArena — "set de filmagem" reutilizável para as cenas de ação do
 * trailer (montagem do frenesi, tela dividida...).
 *
 * Cada arena é autossuficiente e renderiza num CANVAS PRÓPRIO (assim duas
 * arenas podem dividir a tela): sala, dois jogadores (clones dos do palco,
 * com as mesmas expressões), serra + corda, inimigos dirigidos por roteiro,
 * sangue/gibs do jogo, flechas, iluminação, névoa, ventania e respingos.
 *
 * Câmera "DRONE": posição, zoom E rotação (gira em volta do centro da tela);
 * as luzes acompanham a rotação. O desenho mora em ./arenaRender.js.
 *
 * Simulação em passos fixos de 60 Hz com câmera lenta. O roteiro entra por
 * `arena.script = (t) => {...}` (t = tempo de simulação), a cada passo.
 */
import { Renderer } from '../../core/Renderer.js';
import { SeamlessTileset as Tileset } from './SeamlessTileset.js';
import { RoomTiles } from '../../core/RoomTiles.js';
import { Physics } from '../../core/Physics.js';
import { Player } from '../../entities/Player.js';
import { SawWeapon } from '../../weapons/SawWeapon.js';
import { BloodCanvas } from '../../particles/BloodCanvas.js';
import { ParticleSystem } from '../../particles/ParticleSystem.js';
import { CombatSystem } from '../../combat/CombatSystem.js';
import { SpawnSystem } from '../../systems/SpawnSystem.js';
import { ScreenGore } from '../../systems/ScreenGore.js';
import { PostProcessor } from '../../systems/PostProcessor.js';
import { WindSystem } from '../../systems/WindSystem.js';
import { TILE, ROOM_ROWS, BLOOD_COLORS, BLOOD_PIXEL, MAX_ACTIVE_GIBS, WIND } from '../../config/GameConfig.js';
import { LensSplatter } from '../fx/LensSplatter.js';
import { renderArena } from './arenaRender.js';
import { hookRendererAudio } from '../audio/TrailerAudio.js';

const STEP = 1 / 60;
const BUMP_DIST = 34;

export class ActionArena {
    /** @param {object} opts { cols, rows, doors, seed, ambient, vignette, ropeLen, torches } */
    constructor(stage, opts = {}) {
        this.stage = stage;
        const { assets } = stage;
        this.cols = opts.cols ?? 18;
        this.rows = opts.rows ?? 11;
        this.doors = { N: false, S: false, E: false, W: false, ...(opts.doors || {}) };

        this.canvas = document.createElement('canvas');
        this.canvas.width = 2; this.canvas.height = 2;
        this.ctx = this.canvas.getContext('2d');
        this.renderer = new Renderer(this.canvas, this.ctx);
        this.renderer.setTileset(new Tileset(assets.tileset, 16, 10));
        this.renderer.setAssets(assets);
        this.renderer.setTileWorldSize(TILE);
        // Zoom contínuo (sem degraus de 1px por tile): o SeamlessTileset já
        // evita as frestas, então mergulhos/zooms rápidos ficam lisos.
        if (opts.smoothZoom) this.renderer._quantizeZoom = (z) => z;

        this.tiles = new RoomTiles(this.cols, this.rows, this.doors, opts.seed ?? 5, true);
        this.rect = { x: 0, y: 0, w: this.cols * TILE, h: this.rows * TILE };
        const b = this.bounds = { minX: TILE, minY: TILE, maxX: this.rect.w - TILE, maxY: this.rect.h - TILE };
        this.doorHalf = TILE;
        const midC = (this.cols / 2) | 0, midR = (this.rows / 2) | 0;
        this.doorList = [];
        if (this.doors.N) this.doorList.push({ dir: 'N', x: midC * TILE, y: b.minY });
        if (this.doors.S) this.doorList.push({ dir: 'S', x: midC * TILE, y: b.maxY });
        if (this.doors.E) this.doorList.push({ dir: 'E', x: b.maxX, y: midR * TILE });
        if (this.doors.W) this.doorList.push({ dir: 'W', x: b.minX, y: midR * TILE });
        this.tiles.torches = opts.torches ?? this._defaultTorches();
        this.center = { x: this.rect.w / 2, y: this.rect.h / 2 };

        // Atores próprios (clones dos jogadores do palco: mesmas folhas e
        // expressões), para que duas arenas rodem ao mesmo tempo.
        const s1 = stage.p1, s2 = stage.p2;
        this.p1 = new Player(0, 0, s1.color, s1.controls, s1.img, s1.name, s1.sprite);
        this.p2 = new Player(0, 0, s2.color, s2.controls, s2.img, s2.name, s2.sprite);
        this.saw = new SawWeapon(assets.saw, assets.cable);
        this.arrowSprite = assets.arrow;

        this.bloodCanvas = new BloodCanvas(this.rect.w, this.rect.h, BLOOD_COLORS, BLOOD_PIXEL);
        this.particles = new ParticleSystem(this.bloodCanvas);
        this.combat = new CombatSystem({ renderer: this.renderer, particleSystem: this.particles });
        this.spawner = new SpawnSystem({ assets, bloodCanvas: this.bloodCanvas });
        this.screenGore = new ScreenGore(this.canvas);
        this.lens = new LensSplatter(this.canvas);
        this.post = new PostProcessor(this.canvas, this.ctx, {
            lighting: { ambient: opts.ambient ?? '44, 36, 54' },
            vignette: { strength: opts.vignette ?? 0.72 }
        });
        this.wind = new WindSystem({ ...WIND, count: Math.round(60 * (this.cols * this.rows) / (14 * 9)) });

        this.targets = [this.p1, this.p2].map(p => ({
            get x() { return p.x; }, get y() { return p.y; }, takeDamage: () => false
        }));
        const A = this;
        this.midTarget = { get x() { return (A.p1.x + A.p2.x) / 2; }, get y() { return (A.p1.y + A.p2.y) / 2; } };

        this.ropeLen = opts.ropeLen ?? 230;
        // Aproxima todos os enquadramentos (focus/snapCamera) desta arena.
        this.camClose = opts.camClose ?? 1.3;
        // Som: tremores/zoom do renderer e viés de pan (tela dividida).
        this.panBias = opts.panBias ?? 0;
        hookRendererAudio(this.renderer, () => this.stage.audio);
        this.reset();
    }

    // Efeito sonoro posicionado (pan pela posição na tela desta arena).
    sfx(name, x, y, o = {}) {
        const au = this.stage.audio;
        if (!au) return null;
        const s = this.ws(x, y);
        return au.play(name, { pan: au.panX(s.x, this.canvas.width, this.panBias), ...o });
    }

    _defaultTorches() {
        const last = this.cols - 1, bottom = this.rows - 1;
        const T = [];
        for (let c = 3; c < last - 1; c += 5) T.push({ col: c, row: 0, side: 'N', type: 'torch' });
        for (let r = 2; r < bottom; r += 4) {
            T.push({ col: 1, row: r, side: 'W', type: 'torch' });
            T.push({ col: last - 1, row: r, side: 'E', type: 'torch' });
        }
        return T;
    }

    // Marca tiles de piso como buraco (-1). cells = [[col,row], ...]
    setHoles(cells) {
        for (const [c, r] of cells) if (this.tiles.floor[r]) this.tiles.floor[r][c] = -1;
        this.holeCells = cells;
        this._holeSet = new Set(cells.map(([c, r]) => r * this.cols + c));
        const set = new Set(cells.map(([c, r]) => `${c},${r}`));
        this.tiles.props = (this.tiles.props || []).filter(p => !set.has(`${p.col},${p.row}`));
    }

    reset() {
        this.t = 0;
        this.enemies = [];
        this.gibs = [];
        this.arrows = [];
        this.killFlashes = [];
        this.kills = 0;
        this.timeScale = 1;
        this.slowmoT = 0;
        this._slowScale = 0.3;
        this._acc = 0;
        this._sparkAcc = 0;
        this.connected = true;
        this.sawVisible = true;
        this.chainReveal = 1;
        this.connectFlash = 0;
        this.impactFlash = 0;
        this.minSpin = 0;
        this.rot = 0;
        this.camGoal = null;
        this.script = null;
        this.onKill = this.onWallHit = this.onYank = this.onBump = null;
        this.onDrawFloor = this.onDrawTop = null;   // ganchos de desenho (mundo)
        this.onDrawOver = null;  // desenho emissivo (mundo) depois da luz
        this.onLights = null;    // (pp, ws, pix) luzes extras
        this.freeSaw = null;     // {x,y,vx,vy}: serra solta, voando sozinha
        this.sawScale = 1;       // serra gigante (>1)
        this.arrowsKill = false; // flechas perfuram inimigos
        this.red = 0;            // clima vermelho (luz + vinheta pulsando) 0..1
        this.redHz = 1.6;
        this.doorOpen = {};      // dir -> 0..1 (ausente = aberta)
        const s = this.saw;
        s.spin = 0; s.rotation = 0; s.dragX = s.dragY = 0; s.dropped = false; s.bloodTimer = 0;
        this.particles.clear();
        this.screenGore.clear();
        this.lens.clear();
        for (const p of [this.p1, this.p2]) this.initPlayer(p, this.center.x, this.center.y);
    }

    initPlayer(p, x, y, vx = 0, vy = 0) {
        Object.assign(p, {
            x, y, vx, vy,
            goal: null,      // {vx,vy,holdX?,holdY?} | {x,y,speed} | {follow:true,x,y,gain,max}
            accel: 0.1, wobble: 0.3, wobPhase: Math.random() * 10,
            faceX: null, hopZ: 0, hopV: 0, shiver: 0, stumble: 0, tiltKick: 0,
            airborne: false, swerveT: 0, swerveVX: 0, swerveVY: 0, brakeT: 0,
            expression: null, _exprBase: null, _exprTimer: 0,
            hurtTimer: 0, scaredTimer: 0, invulnerableTimer: 0,
            walkFrame: 0, facingLeft: false, _faceLock: false
        });
    }

    // ---- Tamanho / câmera ----
    ensureSize(w, h) {
        w = Math.max(2, w | 0); h = Math.max(2, h | 0);
        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w; this.canvas.height = h;
            this.ctx.imageSmoothingEnabled = false;
        }
    }
    // Zoom de referência pela ALTURA (igual em tela cheia e meia tela).
    get zoomRef() { return this.canvas.height / (ROOM_ROWS * TILE + 180); }
    get mid() { return { x: (this.p1.x + this.p2.x) / 2, y: (this.p1.y + this.p2.y) / 2 }; }
    get sawPos() {
        if (this.freeSaw) return this.freeSaw;
        return this.connected ? this.saw.getSawPositions(this.p1, this.p2)[0]
            : { x: this.saw.dropX, y: this.saw.dropY };
    }

    snapCamera(x, y, zoom, rot = 0) {
        const r = this.renderer;
        r.camX = x; r.camY = y; r.zoom = zoom * this.camClose; this.rot = rot;
        this.camGoal = null;
    }
    // Câmera posta direto (zoom ABSOLUTO, sem camClose): mergulhos roteirizados.
    setCam(x, y, zoom, rot = 0) {
        const r = this.renderer;
        r.camX = x; r.camY = y; r.zoom = zoom; this.rot = rot;
        this.camGoal = null;
    }

    // Mata um inimigo pelo roteiro (serra solta, serra gigante, flecha).
    killEnemy(e, shake = 10) {
        if (e.state === 'dying' || e.isHidden) return false;
        if (e.frozen) { e.unfreeze(); e.spawnFx = 0; }
        e.startDying();
        this.saw.onHit?.();
        this.renderer.triggerShake(shake);
        this.particles.triggerBlood(e.x, e.y, 10, 0.9);
        this.kills++;
        this.killFlashes.push({ x: e.x, y: e.y, life: 1 });
        this._killSound(e);
        this.onKill?.(e);
        return true;
    }
    _killSound(e) {
        this.sfx('sawHit', e.x, e.y, { vol: 0.75, cool: 0.035 });
        this.sfx('splat', e.x, e.y, { vol: 0.45, cool: 0.05 });
        this.stage.audio?.excite(0.12);
    }
    // O pé de (x,y) cai num buraco?
    inHole(x, y) {
        if (!this._holeSet) return false;
        const c = Math.floor(x / TILE), r = Math.floor((y + 14) / TILE);
        return this._holeSet.has(r * this.cols + c);
    }

    /**
     * Objetivo de câmera (suave). `fit` = pontos que precisam caber no quadro
     * (limita o zoom, já considerando a rotação). zoom é ×zoomRef.
     */
    focus({ x, y, zoom, rot = 0, k = 0.1, fit = null, pad = 110 }) {
        let z = zoom * this.zoomRef * this.camClose;
        if (fit && fit.length) {
            const W = this.canvas.width, H = this.canvas.height;
            let hw = 0, hh = 0;
            for (const p of fit) { if (!p) continue; hw = Math.max(hw, Math.abs(p.x - x)); hh = Math.max(hh, Math.abs(p.y - y)); }
            const c = Math.abs(Math.cos(rot)), s = Math.abs(Math.sin(rot));
            // Margem reduzida e área útil maior: enquadramento colado nos dois.
            const pd = pad * 0.65;
            const rw = hw * c + hh * s + pd, rh = hw * s + hh * c + pd;
            z = Math.min(z, (W * 0.5) / rw, (H * 0.4) / rh);
        }
        this.camGoal = { x, y, zoom: z, rot, k };
    }

    _applyCam() {
        const g = this.camGoal;
        if (!g) return;
        const r = this.renderer;
        r.camX += (g.x - r.camX) * g.k;
        r.camY += (g.y - r.camY) * g.k;
        r.zoom += (g.zoom - r.zoom) * g.k * 0.8;
        this.rot += (g.rot - this.rot) * g.k * 0.6;
    }

    // Mundo -> tela, incluindo a rotação do drone.
    ws(x, y) {
        const s = this.renderer.worldToScreen(x, y);
        if (!this.rot) return s;
        const cx = this.canvas.width / 2, cy = this.canvas.height / 2;
        const c = Math.cos(this.rot), sn = Math.sin(this.rot);
        const dx = s.x - cx, dy = s.y - cy;
        return { x: cx + dx * c - dy * sn, y: cy + dx * sn + dy * c, zoom: s.zoom };
    }

    // ---- Reações ----
    expr(p, name) { this.stage._express(p, name); }
    exprFor(p, name, secs) { this.stage._expressFor(p, name, secs); }
    blink(p, secs = 0.14) { this.exprFor(p, 'olhos_fechados', secs); }
    hop(p, v = 4.5) { if (p.hopZ <= 0.5) p.hopV = v; }
    both(fn) { fn(this.p1); fn(this.p2); }
    look(p, x) {
        const front = (x >= p.x) !== !!p.facingLeft;
        this.expr(p, front ? 'olhando_direita' : 'olhando_esquerda');
    }
    // Desvio rápido (passo lateral) por `secs`.
    swerve(p, vx, vy, secs = 0.3) { p.swerveT = secs; p.swerveVX = vx; p.swerveVY = vy; }
    slowmo(secs, scale = 0.3) {
        this.slowmoT = secs; this._slowScale = scale;
        if (secs < 50) this.stage.audio?.slowmo(scale, secs);
    }

    // ---- Serra / corda ----
    // Corda arrebenta: a serra cai onde estava, com faíscas e clarão.
    snap() {
        const sp = this.saw.getSawPositions(this.p1, this.p2)[0];
        this.connected = false;
        this.saw.drop(sp.x, sp.y);
        this.particles.triggerSparkBurst(sp.x, sp.y, this.saw.discRadius, 22, 1.5);
        this.particles.triggerFlash(sp.x, sp.y, 14, 1.2);
        this.renderer.triggerShake(16);
        this.impactFlash = 0.6;
        this.sfx('sawSnap', sp.x, sp.y, { vol: 1 });
        this.sfx('sawLand', sp.x, sp.y, { vol: 0.7, delay: 0.25 });
        this.stage.audio?.excite(0.4);
    }
    // Reconexão impactante: clarão azul, anel de choque, faíscas, zoom-punch.
    reconnect() {
        const s = this.saw;
        const at = { x: s.dropX, y: s.dropY };
        s.pickup();
        s.dragX = s.dragY = 0;
        s.spin = 1;
        this.connected = true;
        this.chainReveal = 0;
        this.connectFlash = 1;
        this._connectAt = at;
        this.particles.triggerSparkBurst(at.x, at.y, s.discRadius, 34, 2);
        this.particles.triggerFlash(at.x, at.y, 22, 1.6);
        this.renderer.triggerShake(20);
        this.renderer.triggerZoomPunch(0.08);
        this.sfx('sawPickup', at.x, at.y, { vol: 1 });
        this.stage.audio?.excite(0.5);
    }

    // ---- Inimigos / flechas ----
    spawnEnemy(x, y, type = null, opts = {}) {
        const e = this.spawner.createEnemy(x, y, 3, type ?? (Math.random() < 0.6 ? 'demon' : 'bloodMonster'));
        e.animTime = (Math.random() * 40) | 0;
        e.speed = opts.speed ?? 0.6;
        e.chase = opts.chase ?? null;
        e.goal = opts.goal ?? null;
        e.stopDist = opts.stopDist ?? 0;
        e.lookAt = opts.lookAt ?? null;
        e.lungeT = 0;
        e._entering = !!opts.entering;
        if (opts.intro) {
            e.beginFrozenSpawn(0);
            this.particles.triggerFlameBurst(e.x, e.footY, [255, 110, 70], { amount: 24 });
            this.sfx('enemySpawn', e.x, e.y, { vol: 0.6, cool: 0.08 });
        }
        this.enemies.push(e);
        return e;
    }
    // Bote: avança rápido na direção (tx,ty) tocando a animação de ataque.
    lunge(e, tx, ty, power = 6) {
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
        e.lungeT = 16;
        e.lungeVX = dx / d * power; e.lungeVY = dy / d * power;
        e.animTime = 0;
        e.currentAttack = e.attackKeys?.[(Math.random() * e.attackKeys.length) | 0] ?? 'attack';
        e.facingLeft = tx < e.x;
        this.sfx('swish', e.x, e.y, { vol: 0.45, cool: 0.09 });
    }
    fireArrow(x, y, vx, vy = 0, opts = {}) {
        const a = { x, y, vx, vy, angle: Math.atan2(vy, vx), stuck: 0, ...opts };
        this.arrows.push(a);
        this.sfx('arrow', x, y, { vol: 0.32, cool: 0.06 });
        return a;
    }

    render(w, h) { renderArena(this, w, h); }

    // ------------------------------------------------------------------
    update(dt) {
        if (this.slowmoT > 0) this.slowmoT -= dt;
        const target = this.slowmoT > 0 ? this._slowScale : 1;
        this.timeScale += (target - this.timeScale) * Math.min(1, dt * (target < this.timeScale ? 18 : 4));
        this._acc += dt * 60 * this.timeScale;
        let n = 0;
        while (this._acc >= 1 && n < 4) { this._acc -= 1; n++; this._step(); }
        for (const p of [this.p1, this.p2]) {
            if (p._exprTimer > 0) {
                p._exprTimer -= dt;
                if (p._exprTimer <= 0) p.expression = p._exprBase ?? null;
            }
        }
        if (this.impactFlash > 0) this.impactFlash = Math.max(0, this.impactFlash - dt * 3);
        this.fogPhase = (this.fogPhase ?? Math.random() * 10) + dt * 0.06;
    }

    _step() {
        this.t += STEP;
        this.script?.(this.t);
        const { p1, p2, saw, renderer } = this;

        for (const p of [p1, p2]) this._drive(p);
        if (this.connected) this._rope(p1, p2);
        else this._bump(p1, p2);
        for (const p of [p1, p2]) { this._animate(p); if (p.hurtTimer > 0) p.hurtTimer--; }

        if (this.sawVisible && this.freeSaw) {
            // Serra SOLTA: gira a toda, voa pelo roteiro (vx,vy) e corta sozinha.
            const f = this.freeSaw;
            f.x += f.vx || 0; f.y += f.vy || 0;
            const fake = { x: f.x, y: f.y, vx: 0, vy: 0, speedMag: 10, speed: 4 };
            saw.dragX = saw.dragY = 0;
            saw.update(fake, fake);
            saw.spin = 1;
            const sp = Math.hypot(f.vx || 0, f.vy || 0);
            if (sp > 1) this.particles.triggerSparks(f.x, f.y, saw.discRadius * this.sawScale, saw.spinDir, 2 + (sp / 4) | 0);
            const R = saw.discRadius * this.sawScale;
            for (const e of this.enemies) {
                if (Math.hypot(e.x - f.x, e.y - f.y) < R + e.hitRadius) this.killEnemy(e, 12);
            }
            renderer.triggerShake(2.5);
        } else if (this.sawVisible) {
            if (this.connected) {
                saw.update(p1, p2);
                if (saw.spin < this.minSpin) saw.spin = this.minSpin;
                const sp = saw.getSawPositions(p1, p2)[0];
                const moving = Math.min(1, Math.min(p1.speedMag, p2.speedMag) / p1.speed);
                this._sparkAcc += saw.spin * moving * 4;
                const emit = Math.floor(this._sparkAcc);
                if (emit > 0) {
                    this._sparkAcc -= emit;
                    this.particles.triggerSparks(sp.x, sp.y, saw.discRadius, saw.spinDir, emit);
                }
                saw.setOnBlood(this.bloodCanvas.isBloodZone(sp.x, sp.y));
                if (saw.isHighSpeed && moving > 0.3) renderer.triggerShake(1.8);
            } else if (saw.dropped) saw.updateDropped();
        }
        if (this.chainReveal < 1) this.chainReveal = Math.min(1, this.chainReveal + STEP / 0.35);
        if (this.connectFlash > 0) this.connectFlash = Math.max(0, this.connectFlash - STEP * 1.4);

        // Inimigos (roteirizados) + colisões.
        for (const e of this.enemies) this._stepEnemy(e);
        const live = this.enemies.filter(e => e.state !== 'dying' && !e.isHidden);
        Physics.resolveEntityCollisions(live);
        const armed = this.connected && this.sawVisible;
        if (armed) {
            const sc = saw.getSawPositions(p1, p2)[0];
            for (const e of live) Physics.resolveCircleCollision(e, sc.x, sc.y, saw.collisionRadius);
        }
        const b = this.bounds;
        for (const e of live) {
            const inside = e.x > b.minX && e.x < b.maxX && e.y > b.minY && e.y < b.maxY;
            if (e._entering && inside) e._entering = false;
            if (!e._entering) {
                e.x = Math.max(b.minX + 14, Math.min(b.maxX - 14, e.x));
                e.y = Math.max(b.minY + 14, Math.min(b.maxY - 14, e.y));
            }
        }

        this.combat.resolveWeaponHits(saw, this.enemies, p1, p2, armed, (e) => {
            this.kills++;
            this.killFlashes.push({ x: e.x, y: e.y, life: 1 });
            this._killSound(e);
            this.onKill?.(e);
        });
        // Serra GIGANTE: o disco inteiro (escalado) corta.
        if (armed && this.sawScale > 1.05) {
            const sc = saw.getSawPositions(p1, p2)[0];
            const R = saw.discRadius * this.sawScale;
            for (const e of this.enemies) {
                if (Math.hypot(e.x - sc.x, e.y - sc.y) < R + e.hitRadius) this.killEnemy(e, 14);
            }
        }
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (!e.readyToGib) continue;
            this.particles.triggerBlood(e.x, e.y, 26, 1.35);
            this.particles.triggerBloodPool(e.x, e.y, 1.2);
            this.gibs.push(...e.explodeIntoGibs());
            while (this.gibs.length > MAX_ACTIVE_GIBS) this.gibs.shift();
            this.enemies.splice(i, 1);
            renderer.triggerShake(8);
            this.screenGore.trigger(0.35);
            const s = this.ws(e.x, e.y);
            this.lens.trigger(s.x, s.y, 0.7);
            this.sfx('splat', e.x, e.y, { vol: 0.6, rate: 0.85, cool: 0.04 });
        }

        // Pedaços voam e somem ao sair da tela.
        const W = this.canvas.width, H = this.canvas.height;
        for (let i = this.gibs.length - 1; i >= 0; i--) {
            const g = this.gibs[i];
            g.update(null);
            const s = this.ws(g.x, g.y);
            if (s.y > H + 80 || s.y < -400 || s.x < -80 || s.x > W + 80) this.gibs.splice(i, 1);
        }

        this._stepArrows();
        for (let i = this.killFlashes.length - 1; i >= 0; i--) {
            this.killFlashes[i].life -= STEP * 2.2;
            if (this.killFlashes[i].life <= 0) this.killFlashes.splice(i, 1);
        }
        this.particles.update([p1, p2], this.bounds);
        this.wind.update(this.bounds);
        this.screenGore.update();
        this.lens.update(STEP);
        this._applyCam();
    }

    // Piloto desengonçado (velocidade desejada + aceleração baixa).
    _drive(p) {
        const b = this.bounds;
        if (p.airborne) {
            // Arremessado: voa quase sem atrito até bater em algo.
            p.x += p.vx; p.y += p.vy;
            p.vx *= 0.99; p.vy *= 0.99;
            p.tiltKick = 0.55 * Math.sign(p.vx || 1);
            let side = null;
            if (p.x < b.minX + 10) { p.x = b.minX + 10; side = 'W'; }
            else if (p.x > b.maxX - 10) { p.x = b.maxX - 10; side = 'E'; }
            if (p.y < b.minY + 12) { p.y = b.minY + 12; side = 'N'; }
            else if (p.y > b.maxY - 6) { p.y = b.maxY - 6; side = 'S'; }
            if (side) {
                p.airborne = false;
                this.sfx('thud', p.x, p.y, { vol: 1 });
                this.onWallHit?.(p, side);
            }
            else if (Math.hypot(p.vx, p.vy) < 1.2) p.airborne = false;
            return;
        }
        let tvx = 0, tvy = 0;
        const g = p.goal;
        if (g && g.follow) {
            tvx = (g.x - p.x) * (g.gain ?? 0.25);
            tvy = (g.y - p.y) * (g.gain ?? 0.25);
            const m = Math.hypot(tvx, tvy), max = g.max ?? 9;
            if (m > max) { tvx = tvx / m * max; tvy = tvy / m * max; }
        } else if (g && g.speed !== undefined) {
            const dx = g.x - p.x, dy = g.y - p.y, d = Math.hypot(dx, dy);
            const sp = Math.min(g.speed, d * 0.08);
            if (d > 1) { tvx = dx / d * sp; tvy = dy / d * sp; }
        } else if (g) {
            tvx = g.vx; tvy = g.vy;
            if (g.holdY !== undefined) tvy += (g.holdY - p.y) * 0.08;
            if (g.holdX !== undefined) tvx += (g.holdX - p.x) * 0.08;
        }
        const m = Math.hypot(tvx, tvy);
        if (m > 0.5 && p.wobble > 0) {
            p.wobPhase += STEP * 9;
            const w = Math.sin(p.wobPhase) * p.wobble * m;
            tvx += (-tvy / m) * w; tvy += (tvx / m) * w * 0.5;
        }
        if (p.brakeT > 0) { p.brakeT -= STEP; tvx *= 0.25; tvy *= 0.25; }
        if (p.swerveT > 0) { p.swerveT -= STEP; tvx += p.swerveVX; tvy += p.swerveVY; }
        if (p.stumble > 0) { p.stumble -= STEP; tvx *= 0.3; tvy *= 0.3; p.tiltKick = 0.3; }

        let k = g ? p.accel : 0.06;
        if (p.swerveT > 0) k = Math.max(k, 0.3);
        p.vx += (tvx - p.vx) * k;
        p.vy += (tvy - p.vy) * k;
        p.x += p.vx;
        p.y += p.vy;
        p.x = Math.max(b.minX + 10, Math.min(b.maxX - 10, p.x));
        p.y = Math.max(b.minY + 10, Math.min(b.maxY - 6, p.y));
    }

    // Corda com comprimento máximo (tranco elástico) + trombada.
    _rope(p1, p2) {
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d <= this.ropeLen) { this._bump(p1, p2); return; }
        const nx = dx / d, ny = dy / d;
        const vrel = (p2.vx - p1.vx) * nx + (p2.vy - p1.vy) * ny;
        const ex = (d - this.ropeLen) / 2;
        p1.x += nx * ex; p1.y += ny * ex; p2.x -= nx * ex; p2.y -= ny * ex;
        if (vrel > 0) {
            const j = vrel * 0.85;
            p1.vx += nx * j; p1.vy += ny * j; p2.vx -= nx * j; p2.vy -= ny * j;
            if (vrel > 3) {
                const m = this.mid;
                this.sfx('rope', m.x, m.y, { vol: Math.min(0.8, vrel / 8), cool: 0.25 });
                this.onYank?.(vrel);
            }
        }
    }
    _bump(p1, p2) {
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d >= BUMP_DIST) return;
        const nx = dx / d, ny = dy / d;
        const vrel = (p2.vx - p1.vx) * nx + (p2.vy - p1.vy) * ny;
        const ex = (BUMP_DIST - d) / 2;
        p1.x -= nx * ex; p1.y -= ny * ex; p2.x += nx * ex; p2.y += ny * ex;
        if (vrel < 0) {
            const j = -vrel * 0.9;
            p1.vx -= nx * j; p1.vy -= ny * j; p2.vx += nx * j; p2.vy += ny * j;
            if (-vrel > 2.5) {
                this.particles.triggerDust((p1.x + p2.x) / 2, (p1.y + p2.y) / 2 + 14, 0, -1, 12);
                this.sfx('thud', (p1.x + p2.x) / 2, (p1.y + p2.y) / 2, { vol: 0.55, rate: 1.2, cool: 0.3 });
                this.onBump?.();
            }
        }
    }

    _animate(p) {
        const sp = p.airborne ? 0 : p.speedMag;
        if (sp > 0.25) p.walkFrame += sp * 0.2;
        else if (!p.airborne) p.walkFrame = 0;
        p.bobPhase += 0.12 + sp * 0.07;
        p.tiltKick *= 0.9;
        const tiltTarget = Math.max(-1, Math.min(1, p.vx / p.speed)) * 0.24 + p.tiltKick;
        p.tilt += (tiltTarget - p.tilt) * 0.18;
        if (p.faceX !== null && sp < 3.2) p.facingLeft = p.faceX < p.x;
        else if (p.vx < -0.4) p.facingLeft = true;
        else if (p.vx > 0.4) p.facingLeft = false;
        const wasUp = p.hopZ > 3;
        p.hopV -= 0.55;
        p.hopZ = Math.max(0, p.hopZ + p.hopV);
        if (p.hopZ === 0 && p.hopV < 0) {
            // Pouso de um pulo alto: passo pesado.
            if (wasUp && p.hopV < -4) this.sfx('footstep', p.x, p.y, { vol: 0.5, rate: 0.8, cool: 0.05 });
            p.hopV = 0;
        }
    }

    // Inimigo roteirizado: persegue `chase`/`goal`, para a `stopDist`, dá botes.
    _stepEnemy(e) {
        if (e.state === 'dying' || e.frozen) {
            e.update(this.targets, () => {});
            if (e.frozen && !e.isHidden && e.spawnFx <= 0) e.unfreeze();
            return;
        }
        const px = e.x, py = e.y;
        this._moveEnemy(e);
        // Não anda por cima de buraco: volta para onde estava.
        if (this.inHole(e.x, e.y) && !this.inHole(px, py)) { e.x = px; e.y = py; e.vx *= 0.3; e.vy *= 0.3; }
    }

    _moveEnemy(e) {
        if (e.lungeT > 0) {
            e.lungeT--;
            e.animTime++;
            e.state = 'attack';
            e.x += e.lungeVX; e.y += e.lungeVY;
            e.lungeVX *= 0.88; e.lungeVY *= 0.88;
            return;
        }
        e.state = 'chase';
        const tgt = e.chase || e.goal;
        let vx = 0, vy = 0;
        if (tgt) {
            const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.hypot(dx, dy) || 1;
            if (d > e.stopDist + 1) {
                const sp = Math.min(e.speed, (d - e.stopDist) * 0.08);
                vx = dx / d * sp; vy = dy / d * sp;
            }
        }
        e.vx += (vx - e.vx) * 0.15;
        e.vy += (vy - e.vy) * 0.15;
        e.x += e.vx + (e.pushVx || 0);
        e.y += e.vy + (e.pushVy || 0);
        e.pushVx = (e.pushVx || 0) * 0.85;
        e.pushVy = (e.pushVy || 0) * 0.85;
        // Parado, a animação de andar corre devagar (respira em vez de marchar).
        if (Math.hypot(e.vx, e.vy) > 0.2 || ((this.t * 60) | 0) % 3 === 0) e.animTime++;
        const look = e.lookAt || this.midTarget;
        e.facingLeft = look.x < e.x;
    }

    // Flechas: voam reto e cravam na parede oposta (tremendo um instante).
    _stepArrows() {
        const b = this.bounds;
        for (let i = this.arrows.length - 1; i >= 0; i--) {
            const a = this.arrows[i];
            if (a.stuck > 0) {
                a.stuck -= STEP;
                if (a.stuck <= 0) this.arrows.splice(i, 1);
                continue;
            }
            a.x += a.vx; a.y += a.vy;
            // Crava no chão num ponto marcado (stopX) ou na parede oposta.
            const hitStop = a.stopX !== undefined && (a.vx < 0 ? a.x <= a.stopX : a.x >= a.stopX);
            if (hitStop || (a.vx > 0 && a.x > b.maxX - 4) || (a.vx < 0 && a.x < b.minX + 4)) {
                a.x = hitStop ? a.stopX : (a.vx > 0 ? b.maxX - 4 : b.minX + 4);
                a.stuck = a.stuckDur ?? 0.9;
                this.particles.triggerDust(a.x, a.y + (hitStop ? 10 : 0), -Math.sign(a.vx), 0, hitStop ? 7 : 5);
                this.sfx('thunk', a.x, a.y, { vol: 0.35, cool: 0.05 });
                continue;
            }
            if (this.arrowsKill) {
                for (const e of this.enemies) {
                    if (Math.abs(e.x - a.x) < 22 && Math.abs(e.y - a.y) < 26) this.killEnemy(e, 6);
                }
            }
        }
    }
}
