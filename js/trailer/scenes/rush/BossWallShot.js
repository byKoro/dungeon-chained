/**
 * Cena 11 — BOSS "PAREDE DE FOGO" (estilo Wall of Flesh), última cena.
 *
 * Continua do mergulho na serra gigante (o disco se abre em espiral, SawIris).
 * Sala LONGA e contínua: só a parede de cima aparece; as pontas esquerda/direita
 * e a parede de baixo nunca entram no quadro. O boss é o `ghostfire` em escala
 * gigante (~85% da altura da tela): ele É a parede.
 *
 * Roteiro (tempo de simulação, ver `T`):
 *   calma tensa → o boss ENTRA da direita de uma vez (clarão, tremor, onda que
 *   empurra os dois) → rugido → cospe levas de minions (hellbat, demônias) →
 *   frenesi de cortes → RAIO (linha 4 da folha: carga, aviso, disparo) mirando
 *   o meio da corda, eles desviam juntos → some em chamas e ressurge à
 *   ESQUERDA (espelhado) → mais 2 raios e 1 leva → volta à direita → último
 *   raio → os dois investem, a serra cresce e CRAVA na caveira → rachaduras de
 *   luz, morte (linha 5) e tudo explode → plano final em tela: os dois saltam
 *   em câmera lenta na direção da câmera (vermelho à esquerda, azul à direita,
 *   serra no meio presa pela corda) → congela com o título; loop com brasas.
 *
 * O boss vive no MUNDO (o raio mata minions de verdade) mas é desenhado depois
 * da luz (`A.onDrawOver`), emissivo; a luz dele entra por `A.onLights`.
 */
import { RushShot, dressRoom, handheld } from '../../kit/rushKit.js';
import { lerp, clamp01, easeIn, easeOut, easeInOut } from '../../anim.js';
import { SawIris } from '../../fx/SawIris.js';
import { FxParticles } from '../../fx/FxParticles.js';

const COLS = 72, ROWS = 14;
const BS = 21;              // escala do boss (px de mundo por px de sprite)
const ANCHOR_Y = 42;        // linha do raio na célula de 100 px (= boca)
const SKULL_HALF = 6.5;     // meia largura da caveira (px de sprite)
const BEAM_EXT = 150;       // prolongamento do raio (px de sprite, coluna 99 esticada)
const CAM_Y = 300;
const Y_MID = 345, Y_TOP = 175, Y_BOT = 520;
const FIGHT_ZOOM = 1.12;    // ×zoomRef: boss + jogadores no quadro
const ADV = 0.8;            // avanço da parede (px de mundo / passo)
const SLAM_IN = 0.18;       // entrada de uma vez
const SAW_BIG = 2.6;        // serra na investida final
const MINIONS = ['hellbat', 'demonessA', 'demonessB'];
const DEBRIS = [2, 3, 42, 43, 10, 20, 49, 59];
const BEAM = { charge: 0.4, warn: 0.42, fire: 0.5, fade: 0.15, recover: 0.15 };
const FREEZE_AT = 2.0;      // s reais do plano final até congelar
const TITLE_AT = 1.9;

// Linha do tempo (s de simulação).
const T = {
    slam: 0.8, roar: 1.25, spit1: 1.8, beam1: 3.3, spit2: 4.95,
    vanish1: 6.3, appearL: 6.75, beam2: 7.1, spit3: 8.75, beam3: 9.95,
    vanish2: 11.6, appearR: 12.05, beam4: 12.4
};

const BOSS_LIGHT = {
    color: '255, 120, 50',
    falloff: [{ offset: 0, alpha: 0.95 }, { offset: 0.35, alpha: 0.5 }, { offset: 0.7, alpha: 0.18 }, { offset: 1, alpha: 0 }],
    flickerBase: 1, flickerSine: 0.06, flickerNoise: 0.05
};
const BEAM_LIGHT = {
    color: '255, 110, 40',
    falloff: [{ offset: 0, alpha: 1 }, { offset: 0.5, alpha: 0.4 }, { offset: 1, alpha: 0 }],
    flickerBase: 1, flickerSine: 0, flickerNoise: 0.12
};
const CRACK_LIGHT = {
    color: '255, 240, 215',
    falloff: [{ offset: 0, alpha: 1 }, { offset: 0.45, alpha: 0.45 }, { offset: 1, alpha: 0 }],
    flickerBase: 1, flickerSine: 0, flickerNoise: 0.2
};

const RAYS = 12;            // feixes de luz das rachaduras

// Textura de UM feixe de luz (horizontal, origem na borda esquerda): brilho
// que cai suave no comprimento E na largura (gradiente radial achatado) —
// ponta afinando, sem bordas duras. Criada uma vez e reaproveitada.
let _rayTex = null;
function rayTexture() {
    if (_rayTex) return _rayTex;
    const w = 256, h = 64;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.save();
    g.translate(0, h / 2);
    g.scale(1, h / (w * 0.9));
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, w);
    rg.addColorStop(0, 'rgba(255, 252, 240, 1)');
    rg.addColorStop(0.12, 'rgba(255, 240, 210, 0.75)');
    rg.addColorStop(0.35, 'rgba(255, 214, 160, 0.35)');
    rg.addColorStop(0.65, 'rgba(255, 170, 110, 0.12)');
    rg.addColorStop(1, 'rgba(255, 140, 80, 0)');
    g.fillStyle = rg;
    g.fillRect(0, -w, w, w * 2);
    g.restore();
    // Núcleo mais fino e claro no centro do feixe.
    const core = g.createLinearGradient(0, 0, 0, h);
    core.addColorStop(0, 'rgba(255, 255, 250, 0)');
    core.addColorStop(0.4, 'rgba(255, 255, 250, 0)');
    core.addColorStop(0.5, 'rgba(255, 255, 250, 1)');
    core.addColorStop(0.6, 'rgba(255, 255, 250, 0)');
    core.addColorStop(1, 'rgba(255, 255, 250, 0)');
    const fade = g.createLinearGradient(0, 0, w, 0);
    fade.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
    fade.addColorStop(0.6, 'rgba(255, 255, 255, 0.12)');
    fade.addColorStop(1, 'rgba(255, 255, 255, 0)');
    // Núcleo = faixa central × queda no comprimento (camada separada).
    const cc = document.createElement('canvas');
    cc.width = w; cc.height = h;
    const c2 = cc.getContext('2d');
    c2.fillStyle = core; c2.fillRect(0, 0, w, h);
    c2.globalCompositeOperation = 'destination-in';
    c2.fillStyle = fade; c2.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'lighter';
    g.drawImage(cc, 0, 0);
    _rayTex = cv;
    return cv;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

export class BossWallShot extends RushShot {
    constructor(stage) {
        const torches = [];
        for (let c = 3; c < COLS - 2; c += 6) torches.push({ col: c, row: 0, side: 'N', type: 'torch' });
        super(stage, {
            cols: COLS, rows: ROWS, doors: {}, seed: 113, ropeLen: 230,
            ambient: '46, 24, 28', vignette: 0.8, torches
        }, 99);
        this.cutIn = null;          // contínua: o disco da cena 10 se abre (SawIris)
        this.fx = new FxParticles();        // mundo (fogo, brasas, pedaços)
        this.fxScreen = new FxParticles();  // tela (brasas do plano final)
        this.bossImg = stage.assets.get('ghostfire');
        this.leapLT = -1;
    }

    get isDone() { return false; }
    get reachedEnd() { return this.leapLT > TITLE_AT + 0.5; }

    start() {
        super.start();
        this.arena.renderer.screenShake = 0;
        this.stage.overlay = new SawIris(this.stage.assets.saw, { dur: 0.8, rotation: Math.random() * 6 });
    }

    update(dt) {
        if (this.leapLT >= 0) {
            this.leapLT += dt;
            // Câmera lenta até congelar (o fundo para; as brasas de tela seguem).
            if (this.leapLT < FREEZE_AT) super.update(dt);
            else this.t += dt;
            this._tickScreenEmbers(dt);
        } else super.update(dt);
        if (this._leapPending && this.leapLT < 0) {
            this._leapPending = false;
            this.leapLT = 0;
            // A serra "vem junto" para o primeiro plano: some do fundo.
            this.arena.sawVisible = false;
        }
    }

    render() {
        super.render();
        if (this.leapLT >= 0) this._drawLeap();
    }

    // ------------------------------------------------------------------
    setup(A) {
        const { p1, p2 } = A;
        const S = this;
        this.fx.clear();
        this.fxScreen.clear();
        this.leapLT = -1;
        this._leapPending = false;
        this._fired = new Set();
        this._kills = 0;
        this._embAcc = 0;
        this.mode = 'calm';
        this.blasts = [];

        A.ropeLen = 230;
        A.sawScale = 1;
        A.saw.setStrain(0);
        A.minSpin = 0.7; A.saw.spin = 0.8;
        A.red = 0.3; A.redHz = 1.1;
        dressRoom(A, { seed: 113, crates: 8, rubble: 30, loot: 5, banners: 9, blood: 46, candles: false });

        const X0 = 2900;
        A.initPlayer(p1, X0 - 30, Y_MID - 75);
        A.initPlayer(p2, X0 + 30, Y_MID + 75);
        A.both(p => {
            p.accel = 0.2; p.wobble = 0.2; p.shiver = 0.25;
            p.faceX = X0 + 600;
            p.goal = { x: p.x, y: p.y, speed: 1 };
            A.expr(p, 'preocupado');
        });

        this.B = {
            visible: false, side: 'R', x: 0, y: Y_MID, tx: 0, beamY: Y_MID,
            alpha: 1, stretch: 1, jx: 0, bob: 0, tilt: 0, crack: 0,
            act: 'none', actT: 0, row: 1, frame: 0, landed: false, locked: false, firing: false, spawned: 0
        };

        A.onKill = () => {
            S._kills++;
            if (S.mode !== 'fight' && S.mode !== 'dodge') return;
            if (S._kills % 4 === 1) { A.slowmo(0.22, 0.35); A.renderer.triggerZoomPunch(0.045); }
            const p = S._kills % 2 ? p1 : p2;
            A.hop(p, 3);
            A.exprFor(p, S._kills % 3 ? 'raiva' : 'espantado', 0.25);
        };
        A.onDrawOver = (ctx) => { S._drawBoss(ctx, A); S.fx.draw(ctx); };
        A.onLights = (pp, ws, pix) => S._lights(A, pp, ws, pix);
        A.script = (t) => S._script(A, t);

        this.events = [
            [T.slam, () => this._appear(A, 'R')],
            [T.roar, () => this._roar(A)],
            [T.roar + 0.35, () => A.expr(p1, 'raiva')],
            [T.roar + 0.5, () => A.expr(p2, 'furia')],
            [T.spit1, () => this._spit(A, 5)],
            [T.spit1 + 0.15, () => this._fight(A, 'furia')],
            [T.beam1, () => this._beam(A, +1)],
            [T.spit2, () => this._spit(A, 6)],
            [T.vanish1, () => this._vanish(A)],
            [T.appearL, () => this._appear(A, 'L')],
            [T.beam2, () => this._beam(A, -1)],
            [T.spit3, () => this._spit(A, 5)],
            [T.beam3, () => this._beam(A, +1)],
            [T.vanish2, () => this._vanish(A)],
            [T.appearR, () => this._appear(A, 'R')],
            [T.beam4, () => this._beam(A, -1, true)]
        ];

        A.snapCamera(X0 + 110, Y_MID - 10, 1.5 * A.zoomRef, 0.04);
    }

    get away() { return this.B.side === 'R' ? -1 : 1; }   // do boss para os jogadores

    // ---- Eventos ----
    _appear(A, side) {
        const B = this.B, m = A.mid;
        B.side = side;
        B.visible = true;
        B.alpha = 1; B.stretch = 1; B.crack = 0;
        B.tx = m.x - this.away * 650;
        B.y = clamp(m.y, 280, 410);
        B.act = 'slam'; B.actT = A.t; B.landed = false;
        B.x = B.tx - this.away * 950;
    }
    _onLand(A) {
        const B = this.B, away = this.away, { p1, p2 } = A;
        A.renderer.triggerShake(42);
        A.renderer.triggerZoomPunch(0.12);
        A.impactFlash = 1;
        A.slowmo(0.3, 0.35);
        A.red = Math.max(A.red, 0.7);
        // Onda de fogo/vento: empurra os dois, susto.
        A.both(p => {
            p.vx = away * 7; p.vy += (p.y < A.mid.y ? -1.5 : 1.5);
            p.stumble = 0.22; p.shiver = 0.45; p.hurtTimer = 10;
            A.hop(p, 5.5);
            A.expr(p, 'espantado');
            A.particles.triggerDust(p.x, p.y + 10, away, 0, 10);
        });
        A.exprFor(p1, 'olhos_fechados', 0.25);
        for (let i = 0; i < 70; i++) {
            const y = rnd(60, 640);
            this.fx.ember(B.x + away * rnd(80, 200), y, away * rnd(6, 16), rnd(-2, 2), { size: rnd(3, 8), life: rnd(0.6, 1.4) });
        }
        for (let i = 0; i < 8; i++) {
            this.fx.fire(B.x + away * rnd(60, 160), rnd(120, 600), away * rnd(4, 9), 0, { r: rnd(50, 90), life: rnd(0.4, 0.7) });
            A.particles.triggerDust(B.x + away * 120, rnd(140, 620), away, 0, 8);
        }
        const s = A.ws(A.mid.x, A.mid.y);
        A.lens.trigger(s.x, s.y, 0.6);
        if (this.mode === 'calm') this.mode = 'shock';
        else this.mode = 'shock2';
        this._shockT = A.t;
    }
    _roar(A) {
        const B = this.B;
        B.act = 'roar'; B.actT = A.t;
        A.both(p => { p.shiver = 0.55; A.expr(p, 'assustado'); });
        A.red = 1; A.redHz = 2.2;
    }
    _spit(A, n) {
        const B = this.B;
        B.act = 'spit'; B.actT = A.t; B.spawned = 0; B.spitN = n;
        A.renderer.triggerShake(14);
    }
    _fight(A, expr = null) {
        this.mode = 'fight';
        this._fightT = A.t;
        A.both(p => { p.shiver = 0; p.accel = 0.24; p.wobble = 0.3; if (expr) A.expr(p, expr); });
    }
    _beam(A, dodgeDir, final = false) {
        const B = this.B;
        B.act = 'beam'; B.actT = A.t; B.locked = false; B.firing = false; B.final = final;
        B.dodgeDir = dodgeDir;
    }
    _vanish(A) {
        const B = this.B;
        B.act = 'vanish'; B.actT = A.t;
        A.renderer.triggerShake(16);
        for (let i = 0; i < 26; i++) {
            this.fx.fire(B.x + rnd(-5, 5) * BS, B.y + rnd(-14, 8) * BS, rnd(-2, 2), rnd(-5, -1), { r: rnd(60, 120), life: rnd(0.5, 0.9) });
        }
        A.both(p => A.expr(p, 'desconfiado'));
    }

    // ---- Roteiro (a cada passo de 60 Hz) ----
    _script(A, t) {
        for (const [at, fn] of this.events) {
            if (t >= at && !this._fired.has(at)) { this._fired.add(at); fn(); }
        }
        this.fx.update(1);
        this._stepBoss(A, t);
        this._stepPlayers(A, t);
        this._stepMinions(A);
        this._stepEmbers(A, t);
        for (let i = this.blasts.length - 1; i >= 0; i--) {
            const b = this.blasts[i];
            if (t < b.at) continue;
            this.blasts.splice(i, 1);
            this.fx.blast(b.x, b.y, b.power, A.renderer.tileset, DEBRIS);
            A.killFlashes.push({ x: b.x, y: b.y, life: 1, scale: 3 + b.power });
            A.renderer.triggerShake(26);
        }
        this._camera(A, t);
    }

    _stepBoss(A, t) {
        const B = this.B, away = this.away, u = t - B.actT;
        if (!B.visible) return;
        B.jx *= 0.7;
        B.tilt = Math.sin(t * 0.9) * 0.02;
        let bob = Math.sin(t * 1.6) * 8;
        let ty = Y_MID + Math.sin(t * 0.7) * 30;
        let yk = 0.035;

        if (B.act === 'slam') {
            const dirOut = -away;
            if (u < SLAM_IN) B.x = B.tx + dirOut * 950 * (1 - easeIn(u / SLAM_IN));
            else {
                if (!B.landed) { B.landed = true; this._onLand(A); }
                const v = clamp01((u - SLAM_IN) / 0.4);
                B.x = B.tx - dirOut * 45 * Math.sin(v * Math.PI) * (1 - v);
                if (v >= 1) { B.act = 'idle'; B.actT = t; }
            }
            ty = B.y; yk = 0;
            B.row = 1; B.frame = Math.floor(t * 6) % 6;
        } else if (B.act === 'vanish') {
            const k = clamp01(u / 0.45);
            B.alpha = 1 - easeIn(k);
            B.stretch = 1 + 0.7 * k;
            B.jx = rnd(-1, 1) * 14 * k;
            B.row = 1; B.frame = Math.floor(t * 12) % 6;
            if (k >= 1) { B.visible = false; B.act = 'gone'; }
        } else if (B.act === 'impale') {
            B.crack = clamp01(u / 0.75);
            B.jx = rnd(-1, 1) * (6 + 16 * B.crack);
            B.row = 3; B.frame = 2;
            ty = B.y; yk = 0; bob = 0;
        } else if (B.act === 'death') {
            B.row = 4; B.frame = Math.min(5, Math.floor(u * 7));
            B.crack = Math.max(0, 1 - u * 2);
            B.jx = rnd(-1, 1) * 10 * Math.max(0, 1 - u);
            ty = B.y; yk = 0; bob = 0;
        } else {
            // idle / roar / spit / beam: a parede avança devagar.
            B.tx += away * ADV * (B.act === 'beam' ? 0.35 : 1);
            B.x = B.tx;
            if (B.act === 'roar') {
                B.row = 3; B.frame = u < 0.15 ? Math.floor(u / 0.05) : 2;
                B.jx = rnd(-1, 1) * 16;
                if (((t * 60) | 0) % 3 === 0) A.renderer.triggerShake(16);
                if (Math.random() < 0.6) this._emberFromFlame(A, 3);
                if (u > 0.55) { B.act = 'idle'; B.actT = t; }
            } else if (B.act === 'spit') {
                B.row = 2; B.frame = Math.min(5, Math.floor(u * 8));
                const want = Math.min(B.spitN, Math.floor((u - 0.3) / 0.4 * B.spitN) + 1);
                while (u >= 0.3 && B.spawned < want) this._spawnMinion(A, B.spawned++);
                if (u > 0.78) { B.act = 'idle'; B.actT = t; }
            } else if (B.act === 'beam') {
                ({ ty, yk, bob } = this._stepBeam(A, t, u, ty, bob));
            } else {
                B.row = 1; B.frame = Math.floor(t * 6) % 6;
            }
        }
        B.y += (ty - B.y) * yk;
        B.bob += (bob - B.bob) * 0.1;
    }

    // Raio: carga (mira o meio da corda) → aviso (linha fina, trava) →
    // disparo (frame grosso, mata quem estiver na linha) → apaga → recupera.
    _stepBeam(A, t, u, ty, bob) {
        const B = this.B, away = this.away;
        const c = BEAM.charge, w = c + BEAM.warn, f = w + BEAM.fire, fd = f + BEAM.fade, end = fd + BEAM.recover;
        let yk = 0.035;
        B.row = 3;
        if (u < c) {
            B.frame = Math.min(2, Math.floor(u / c * 3));
            ty = clamp(A.mid.y, 270, 420); yk = 0.09; bob *= 0.3;
            if (Math.random() < 0.5) this._emberFromFlame(A, 2);
        } else if (u < w) {
            B.frame = 3;
            if (!B.locked) {
                // Trava a linha do raio (sprite e colisão na mesma altura).
                B.locked = true; B.beamY = B.y + B.bob; B.y = B.beamY; B.bob = 0;
                this._onWarn(A);
            }
            ty = B.y; yk = 0; bob = 0;
        } else if (u < f) {
            B.frame = 4;
            if (!B.firing) { B.firing = true; this._onFire(A); }
            ty = B.y; yk = 0; bob = 0;
            if (((t * 60) | 0) % 2 === 0) A.renderer.triggerShake(9);
            B.jx = rnd(-1, 1) * 5;
            // Mata quem estiver na linha.
            for (const e of A.enemies) {
                if (Math.abs(e.y - B.beamY) < 78 && away * (e.x - B.x) > 150) A.killEnemy(e, 8);
            }
            for (let i = 0; i < 3; i++) {
                this.fx.ember(B.x + away * rnd(340, 2400), B.beamY + rnd(-30, 30), away * rnd(2, 8), rnd(-3, 1), { size: rnd(3, 7), life: rnd(0.3, 0.8) });
            }
        } else if (u < fd) {
            B.frame = 5; ty = B.y; yk = 0; bob = 0;
            // Último raio apagando: é a brecha para a investida final.
            if (B.final && this.mode !== 'charge' && this.mode !== 'impale') this._charge(A);
        } else if (u < end) {
            B.frame = 6; ty = B.y; yk = 0; bob = 0;
        } else {
            B.act = 'idle'; B.actT = t;
            if (this.mode === 'dodge') this._fight(A, 'furia');
        }
        return { ty, yk, bob };
    }

    _onWarn(A) {
        const B = this.B;
        const { p1, p2 } = A;
        // Formação lado a lado, paralela ao raio, fora da linha.
        let dir = B.dodgeDir;
        let yc = B.beamY + dir * 175;
        if (yc > Y_BOT + 20 || yc < Y_TOP - 10) { dir = -dir; yc = B.beamY + dir * 175; }
        yc = clamp(yc, Y_TOP - 10, Y_BOT + 20);
        // Mantém distância da caveira (nunca colados nela durante o raio).
        const xm = this.away > 0 ? Math.max(A.mid.x, B.x + 420) : Math.min(A.mid.x, B.x - 420);
        this.mode = 'dodge';
        p1.goal = { x: xm - 85, y: yc, speed: 10 };
        p2.goal = { x: xm + 85, y: yc, speed: 10 };
        A.both(p => { p.accel = 0.3; A.exprFor(p, 'espantado', 0.7); });
        A.renderer.triggerShake(10);
    }

    _onFire(A) {
        A.slowmo(0.3, 0.35);
        A.impactFlash = 0.4;
        A.renderer.triggerShake(28);
        A.renderer.triggerZoomPunch(0.05);
        A.both(p => { A.hop(p, 6.2); A.exprFor(p, 'olhos_fechados', 0.18); });
    }

    _charge(A) {
        this.mode = 'charge';
        this._growT = A.t;
        A.minSpin = 1;
        A.both(p => { p.accel = 0.3; p.wobble = 0.1; p.shiver = 0; A.expr(p, 'furia'); A.hop(p, 4); });
        A.renderer.triggerShake(12);
    }

    _impale(A) {
        const B = this.B;
        this.mode = 'impale';
        B.act = 'impale'; B.actT = A.t;
        A.slowmo(0.85, 0.3);
        A.impactFlash = 0.9;
        A.renderer.triggerShake(40);
        A.renderer.triggerZoomPunch(0.1);
        const s = A.ws(A.sawPos.x, A.sawPos.y);
        A.lens.trigger(s.x, s.y, 0.9);
    }

    _death(A) {
        const B = this.B, t = A.t;
        this.mode = 'blown';
        B.act = 'death'; B.actT = t;
        A.impactFlash = 1;
        A.renderer.triggerShake(60);
        A.renderer.triggerZoomPunch(-0.1);
        A.red = 1;
        for (const e of A.enemies) A.killEnemy(e, 10);
        this.fx.blast(B.x, B.y - 3 * BS, 3.2, A.renderer.tileset, DEBRIS);
        A.killFlashes.push({ x: B.x, y: B.y, life: 1, scale: 9 });
        // Tudo explode: estouros espalhados pelo quadro, em cascata.
        const r = A.renderer, W = A.canvas.width, H = A.canvas.height;
        const hw = W / (2 * r.zoom), hh = H / (2 * r.zoom);
        for (let i = 0; i < 14; i++) {
            this.blasts.push({
                at: t + 0.04 + i * 0.045,
                x: r.camX + rnd(-0.95, 0.95) * hw, y: clamp(r.camY + rnd(-0.85, 0.85) * hh, 40, 700),
                power: rnd(1.0, 1.9)
            });
        }
        A.both(p => { A.hop(p, 9); A.expr(p, 'furia'); });
    }

    _spawnMinion(A, i) {
        const B = this.B, away = this.away;
        const type = MINIONS[(i + (this._spitCount = (this._spitCount ?? 0) + 1)) % MINIONS.length];
        const x = B.x + away * rnd(150, 200), y = clamp(B.y + rnd(-1, 1) * 140, Y_TOP - 20, Y_BOT + 30);
        const e = A.spawnEnemy(x, y, type, {
            speed: type === 'hellbat' ? 4.6 : rnd(3.4, 4.0), chase: A.midTarget, stopDist: 0, entering: true
        });
        e.facingLeft = away < 0;
        A.particles.triggerFlameBurst(x, y + 20, [255, 120, 60], { amount: 18 });
        this.fx.fire(x, y, away * 3, 0, { r: 70, life: 0.45 });
        for (let k = 0; k < 10; k++) this.fx.ember(x, y, away * rnd(2, 9), rnd(-3, 3), { size: rnd(3, 6), life: rnd(0.4, 0.9) });
        A.renderer.triggerShake(8);
    }

    _emberFromFlame(A, n = 1) {
        const B = this.B, away = this.away;
        for (let i = 0; i < n; i++) {
            this.fx.ember(B.x + rnd(-5, 5) * BS, B.y + B.bob + rnd(-15, -4) * BS,
                away * rnd(0.5, 3) + rnd(-1, 1), rnd(-4, -1), { size: rnd(3, 8), life: rnd(0.8, 1.6) });
        }
    }

    _stepEmbers(A, t) {
        const B = this.B;
        if (B.visible) { if (Math.random() < 0.7) this._emberFromFlame(A, 1); }
        else if (this.mode === 'calm') {
            // Antes de aparecer: brasas soprando da direita, fora do quadro.
            const r = A.renderer, hw = A.canvas.width / (2 * r.zoom);
            if (Math.random() < 0.25 + t * 0.6) {
                this.fx.ember(r.camX + hw + 40, rnd(60, 640), rnd(-7, -3), rnd(-1, 0.5), { size: rnd(2, 5), life: rnd(1.2, 2) });
            }
            if (((t * 60) | 0) % 14 === 0) A.renderer.triggerShake(2 + t * 3);
        }
    }

    _stepPlayers(A, t) {
        const B = this.B, away = this.away, { p1, p2 } = A;
        if (this.mode === 'calm') {
            // Ofegantes, olhando para a direita (de onde vem o tremor).
            if (t > 0.35 && !this._looked) { this._looked = true; A.exprFor(p1, 'olhando_direita', 0.45); }
            if (t > 0.5 && !this._looked2) { this._looked2 = true; A.exprFor(p2, 'olhando_direita', 0.4); }
            return;
        }
        if (this.mode === 'shock' || this.mode === 'shock2') {
            const yc = Y_MID;
            p1.goal = { x: B.tx + away * 780, y: yc - 90, speed: 3 };
            p2.goal = { x: B.tx + away * 780, y: yc + 90, speed: 3 };
            A.both(p => { p.faceX = B.x; });
            if (this.mode === 'shock2' && t - this._shockT > 0.35) this._fight(A, 'furia');
            return;
        }
        // Raio acabou (ou foi emendado em outra ação): voltam à luta.
        if (this.mode === 'dodge' && B.act !== 'beam') this._fight(A, 'furia');
        if (this.mode === 'fight') {
            // Investem contra a leva e recuam (a parede avança); serra no meio.
            const cyc = ((t - this._fightT) % 1.5) / 1.5;
            const charging = cyc < 0.5;
            const tx = B.tx + away * (charging ? 400 : 730);
            const yc = Y_MID + Math.sin(t * 1.7) * 50;
            p1.goal = { x: tx + Math.sin(t * 3.1) * 30, y: yc - 95, speed: charging ? 8.5 : 6 };
            p2.goal = { x: tx - Math.sin(t * 2.7) * 30, y: yc + 95, speed: charging ? 8.5 : 6 };
            A.both(p => { p.faceX = B.x; });
            return;
        }
        if (this.mode === 'charge') {
            const k = clamp01((t - this._growT) / 0.45);
            A.sawScale = 1 + (SAW_BIG - 1) * easeOut(k);
            // Miram além do ponto de contato (chegam embalados).
            p1.goal = { x: B.tx + away * 120, y: B.y - 105, speed: 11 };
            p2.goal = { x: B.tx + away * 120, y: B.y + 105, speed: 11 };
            const sp = A.sawPos, R = A.saw.discRadius * A.sawScale;
            if (Math.abs(sp.x - B.x) < SKULL_HALF * BS + R * 0.45 + 12) this._impale(A);
            return;
        }
        if (this.mode === 'impale') {
            const u = t - B.actT;
            A.both(p => {
                p.goal = { follow: true, x: B.x + away * 190, y: B.y + (p === p1 ? -105 : 105), gain: 0.3, max: 6 };
                p.shiver = 0.3;
            });
            if (((t * 60) | 0) % 2 === 0) {
                const sp = A.sawPos, R = A.saw.discRadius * A.sawScale;
                const cx = sp.x - away * R * 0.7;
                A.particles.triggerSparkBurst(cx, sp.y, 10, 7, 2);
                for (let i = 0; i < 4; i++) this.fx.ember(cx, sp.y + rnd(-R, R) * 0.6, away * rnd(3, 10), rnd(-6, 2), { size: rnd(3, 7), life: rnd(0.3, 0.8) });
                A.renderer.triggerShake(8 + 22 * B.crack);
            }
            if (u >= 0.75) this._death(A);
            return;
        }
        if (this.mode === 'blown') {
            if (t - B.actT > 0.3) this._leapPending = true;
            if (!this._slowLeap && t - B.actT > 0.22) { this._slowLeap = true; A.slowmo(999, 0.12); }
        }
    }

    _stepMinions(A) {
        const m = A.mid;
        const sp = A.sawPos, R = A.saw.discRadius * A.sawScale;
        for (const e of A.enemies) {
            if (e.state === 'dying' || e.isHidden) continue;
            const d = Math.hypot(e.x - m.x, e.y - m.y);
            if (!e._lunged && d < 170) { e._lunged = true; A.lunge(e, m.x, m.y, 5.5); }
            // Garantia: encostou no disco, é cortado.
            if (Math.hypot(e.x - sp.x, e.y - sp.y) < R * 0.9 + (e.hitRadius ?? 18) + 6) A.killEnemy(e, 10);
        }
    }

    _camera(A, t) {
        const B = this.B, m = A.mid;
        const h = handheld(t, 1.1);
        const W = A.canvas.width;
        if (this.mode === 'calm') {
            A.focus({ x: m.x + 110 + h.x, y: m.y - 10 + h.y, zoom: 1.5, rot: 0.04 + h.r, k: 0.12 });
            return;
        }
        if (this.mode === 'impale' || this.mode === 'blown') {
            A.focus({ x: lerp(m.x, B.x, 0.45) + h.x * 0.5, y: clamp(B.y - 20, 260, 360) + h.y * 0.5, zoom: 1.45, rot: -0.05 * this.away + h.r, k: 0.1 });
            return;
        }
        const z = FIGHT_ZOOM * A.zoomRef * A.camClose;
        const hw = W / (2 * z);
        // Boss sumindo: a câmera já vai para o lado onde ele vai ressurgir
        // (a entrada "de uma vez" acontece dentro do quadro).
        let tx = B.tx, aw = this.away;
        const switching = (B.act === 'vanish' && A.t - B.actT > 0.15) || B.act === 'gone';
        if (switching) { aw = -this.away; tx = m.x - aw * 650; }
        const x = tx + aw * 0.7 * hw;
        const tilt = this.mode === 'charge' ? 0.05 * -this.away : 0;
        const k = switching || this.mode === 'shock2' ? 0.11 : this.mode === 'shock' ? 0.09 : 0.07;
        A.focus({ x: x + h.x, y: CAM_Y + h.y, zoom: FIGHT_ZOOM, rot: h.r + tilt, k });
    }

    // ---- Desenho ----
    _drawBoss(ctx, A) {
        const B = this.B, img = this.bossImg;
        if (!B.visible || !img || !img.complete || !img.naturalWidth) return;
        const away = this.away;
        const ax = (B.row === 3 && B.frame >= 3) ? 39.5 : 52.5;
        const firing = B.row === 3 && B.frame === 4;
        const warn = B.row === 3 && B.frame === 3;

        ctx.save();
        ctx.imageSmoothingEnabled = false;
        // Brilho quente atrás da caveira (aditivo).
        const gx = B.x + B.jx, gy = B.y + B.bob - 3 * BS;
        ctx.globalCompositeOperation = 'lighter';
        const gr = 13 * BS * (1 + 0.04 * Math.sin(A.t * 7));
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0, `rgba(255, 120, 50, ${0.32 * B.alpha})`);
        g.addColorStop(0.5, `rgba(200, 40, 20, ${0.14 * B.alpha})`);
        g.addColorStop(1, 'rgba(120, 10, 10, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(gx - gr, gy - gr, gr * 2, gr * 2);
        ctx.globalCompositeOperation = 'source-over';

        ctx.translate(B.x + B.jx, B.y + B.bob);
        ctx.rotate(B.tilt);
        if (B.side === 'R') ctx.scale(-1, 1);
        ctx.scale(BS, BS * B.stretch);
        ctx.globalAlpha = B.alpha;
        const sx = B.frame * 100, sy = B.row * 100;
        ctx.drawImage(img, sx, sy, 100, 100, -ax, -ANCHOR_Y, 100, 100);
        // Raio prolongado: a última coluna do frame esticada (cores do sprite).
        if (B.row === 3 && B.frame >= 3 && B.frame <= 5) {
            ctx.globalAlpha = B.alpha * (warn ? 0.55 + 0.45 * Math.sin(A.t * 70) : 1);
            ctx.drawImage(img, sx + 99, sy + 28, 1, 28, 100 - ax, 28 - ANCHOR_Y, BEAM_EXT, 28);
        }
        // Rachaduras de luz: silhueta clara (linha 0) piscando por cima.
        if (B.crack > 0.01) {
            ctx.globalCompositeOperation = 'lighter';
            for (let i = 0; i < 2; i++) {
                ctx.globalAlpha = clamp01(B.crack * (0.45 + 0.55 * Math.random()));
                ctx.drawImage(img, 0, 0, 100, 100, -52.5, -ANCHOR_Y, 100, 100);
            }
        }
        ctx.restore();

        // Brilho do raio (aditivo, no mundo).
        if (firing || warn) {
            const x0 = B.x + away * (55 - ax) * BS;
            const len = (100 - 55 + BEAM_EXT) * BS;
            const th = firing ? 7 * BS * (0.9 + 0.2 * Math.random()) : 1.6 * BS;
            const a = firing ? 1 : 0.35 * (0.5 + 0.5 * Math.sin(A.t * 70));
            const y = B.beamY;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const lg = ctx.createLinearGradient(0, y - th / 2, 0, y + th / 2);
            lg.addColorStop(0, 'rgba(255, 60, 20, 0)');
            lg.addColorStop(0.3, `rgba(255, 90, 30, ${0.35 * a})`);
            lg.addColorStop(0.5, `rgba(255, 225, 170, ${0.8 * a})`);
            lg.addColorStop(0.7, `rgba(255, 90, 30, ${0.35 * a})`);
            lg.addColorStop(1, 'rgba(255, 60, 20, 0)');
            ctx.fillStyle = lg;
            ctx.fillRect(away > 0 ? x0 : x0 - len, y - th / 2, len, th);
            ctx.restore();
        }

        // Rachaduras: feixes de luz suaves saindo da caveira (textura de
        // feixe com queda gaussiana na largura e no comprimento, aditiva).
        if (B.crack > 0.01) {
            const cx = B.x + B.jx, cy = B.y + B.bob + 2 * BS;
            const tex = rayTexture();
            const t = A.t;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.imageSmoothingEnabled = true;
            // Miolo: brilho redondo que esconde o encontro dos feixes.
            const cr = (5 + 9 * B.crack) * BS;
            const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
            cg.addColorStop(0, `rgba(255, 250, 235, ${0.75 * B.crack})`);
            cg.addColorStop(0.35, `rgba(255, 220, 170, ${0.32 * B.crack})`);
            cg.addColorStop(1, 'rgba(255, 160, 90, 0)');
            ctx.fillStyle = cg;
            ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
            for (let i = 0; i < RAYS; i++) {
                // Ângulos fixos (ângulo áureo) girando devagar; pulsam suave.
                const ang = i * 2.39996 + 0.3 + t * 0.12 * (i % 2 ? 1 : -1);
                const vary = 0.6 + 0.4 * (((i * 37) % 10) / 10);
                const pulse = 0.78 + 0.22 * Math.sin(t * 11 + i * 1.7);
                const len = (8 + 26 * B.crack) * BS * vary * (0.92 + 0.08 * Math.sin(t * 7 + i));
                const wid = (2.2 + 4.5 * B.crack) * BS * (0.7 + 0.3 * vary);
                ctx.save();
                ctx.globalAlpha = clamp01(0.85 * B.crack * pulse);
                ctx.translate(cx, cy);
                ctx.rotate(ang);
                ctx.drawImage(tex, 0, -wid / 2, len, wid);
                ctx.restore();
            }
            ctx.restore();
        }
    }

    _lights(A, pp, ws, pix) {
        const B = this.B;
        if (!B.visible) return;
        const away = this.away;
        const s = ws(B.x, B.y - 3 * BS);
        pp.addLight(s.x, s.y, 1050 * B.alpha * s.zoom, pix(s.zoom, 1.4), 0.9, BOSS_LIGHT);
        const firing = B.row === 3 && B.frame === 4, warn = B.row === 3 && B.frame === 3;
        if (firing || warn) {
            for (let i = 0; i < 9; i++) {
                const p = ws(B.x + away * (360 + i * 270), B.beamY);
                pp.addLight(p.x, p.y, (firing ? 330 : 120) * p.zoom, pix(p.zoom), 0.55, BEAM_LIGHT);
            }
        }
        if (B.crack > 0.01) {
            pp.addLight(s.x, s.y, (300 + 900 * B.crack) * s.zoom, pix(s.zoom), 1, CRACK_LIGHT);
        }
    }

    // ---- Plano final (tela): salto em câmera lenta na direção da câmera ----
    _tickScreenEmbers(dt) {
        const W = this.stage.canvas.width, H = this.stage.canvas.height;
        this._embAcc += dt * 60;
        const steps = Math.floor(this._embAcc);
        this._embAcc -= steps;
        for (let i = 0; i < steps; i++) {
            for (let k = 0; k < 2; k++) {
                this.fxScreen.ember(rnd(0, W), H * rnd(0.85, 1.0), rnd(-1.5, 1.5), rnd(-5, -2),
                    { size: rnd(3, 8) * H / 900, life: rnd(1.2, 2.4) });
            }
        }
        this.fxScreen.update(steps);
    }

    _drawLeap() {
        const { ctx, canvas } = this.stage;
        const W = canvas.width, H = canvas.height;
        const A = this.arena, { p1, p2, saw } = A;
        const lt = this.leapLT;
        const u = clamp01(lt / 1.8), e = easeOut(u);

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Fundo: escurece e ganha brilho de explosão atrás deles.
        ctx.fillStyle = `rgba(20, 4, 6, ${0.2 + 0.3 * e})`;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        const gl = ctx.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, H * 0.9);
        gl.addColorStop(0, `rgba(255, 150, 60, ${0.35 * (1 - 0.4 * e)})`);
        gl.addColorStop(0.5, 'rgba(200, 50, 20, 0.12)');
        gl.addColorStop(1, 'rgba(120, 10, 10, 0)');
        ctx.fillStyle = gl;
        ctx.fillRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'source-over';
        this.fxScreen.draw(ctx);

        // Escala "3D falsa": crescem vindo na direção da câmera.
        const grow = lt > 1.8 ? Math.min(lt, FREEZE_AT) - 1.8 : 0;
        const hFrac = lerp(0.1, 0.42, e) + grow * 0.01;
        const sc = hFrac * H / 73;               // 73 = drawHeight do jogador
        const float = lt > 1.8 ? Math.sin(Math.min(lt, FREEZE_AT) * 2) * H * 0.003 : 0;
        const y = H * (lerp(0.5, 0.6, e) - 0.08 * Math.sin(Math.PI * u)) + float;
        const x1 = W * lerp(0.45, 0.25, e), x2 = W * lerp(0.55, 0.75, e);
        const tilt = 0.26 * e;

        // Corda (no espaço escalado: espessura acompanha os bonecos).
        const sdx = saw.dragX, sdy = saw.dragY;
        saw.dragX = 0; saw.dragY = 17;
        const a = { x: x1 / sc + 8, y: y / sc + 6 }, b = { x: x2 / sc - 8, y: y / sc + 6 };
        ctx.save();
        ctx.scale(sc, sc);
        saw.drawChain(ctx, a, b);
        const mid = saw.cablePoint(a, b, 0.5);
        ctx.restore();
        saw.dragX = sdx; saw.dragY = sdy;

        // Jogadores: vermelho à esquerda, azul à direita, fúria, inclinados para fora.
        const pose = (p, x, rot, faceLeft) => {
            const keep = { x: p.x, y: p.y, tilt: p.tilt, vx: p.vx, vy: p.vy, walkFrame: p.walkFrame, bobPhase: p.bobPhase,
                facingLeft: p.facingLeft, expression: p.expression, hurtTimer: p.hurtTimer, invulnerableTimer: p.invulnerableTimer };
            Object.assign(p, { x: 0, y: 0, tilt: rot, vx: 0, vy: -0.3, walkFrame: 4, bobPhase: 0,
                facingLeft: faceLeft, expression: 'furia', hurtTimer: 0, invulnerableTimer: 0 });
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(sc, sc);
            ctx.imageSmoothingEnabled = false;
            p.draw(ctx);
            ctx.restore();
            Object.assign(p, keep);
        };
        pose(p1, x1, -tilt, false);
        pose(p2, x2, tilt, true);

        // Serra no meio, girando (desenhada à mão, sem o tremor do jogo).
        const img = saw.sprite;
        const R = saw.discRadius * sc;
        const sx = mid.x * sc, sy = mid.y * sc;
        const rot = (this._leapRot = (this._leapRot ?? 0) + (lt < FREEZE_AT ? 0.25 : 0.05));
        ctx.globalCompositeOperation = 'lighter';
        const sg = ctx.createRadialGradient(sx, sy, R * 0.2, sx, sy, R * 1.7);
        sg.addColorStop(0, 'rgba(150, 196, 255, 0.3)');
        sg.addColorStop(1, 'rgba(120, 170, 255, 0)');
        ctx.fillStyle = sg;
        ctx.fillRect(sx - R * 1.7, sy - R * 1.7, R * 3.4, R * 3.4);
        ctx.globalCompositeOperation = 'source-over';
        if (img && img.complete && img.naturalWidth) {
            ctx.imageSmoothingEnabled = false;
            for (const [off, al] of [[0.22, 0.22], [0.11, 0.4], [0, 1]]) {
                ctx.save();
                ctx.globalAlpha = al;
                ctx.translate(sx, sy);
                ctx.rotate(-(rot + off));
                ctx.drawImage(img, 0, 32, 16, 16, -R, -R, R * 2, R * 2);
                ctx.restore();
            }
        }
        // Clarão branco no começo do salto (emenda com a explosão).
        const fl = 1 - clamp01(lt / 0.35);
        if (fl > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(255, 240, 220, ${0.8 * fl * fl})`;
            ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();

        if (lt > TITLE_AT) {
            const ta = easeInOut(clamp01((lt - TITLE_AT) / 0.5));
            // Sombra suave atrás do título (legível sobre a explosão).
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.translate(W / 2, H / 2 + 6);
            ctx.scale(1, 0.32);
            const dg = ctx.createRadialGradient(0, 0, 0, 0, 0, 260);
            dg.addColorStop(0, `rgba(10, 2, 4, ${0.7 * ta})`);
            dg.addColorStop(0.6, `rgba(10, 2, 4, ${0.4 * ta})`);
            dg.addColorStop(1, 'rgba(10, 2, 4, 0)');
            ctx.fillStyle = dg;
            ctx.fillRect(-260, -260, 520, 520);
            ctx.restore();
            this.stage.drawTitleText(0, ta);
        }
    }
}
