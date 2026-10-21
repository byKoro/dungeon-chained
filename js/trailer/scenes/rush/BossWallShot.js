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
// Tela do START (depois do congelamento): float dos jogadores e pulso vermelho.
const FLOAT_AMP = 2.5;      // px de arte do jogador (amplitude)
const FLOAT_SPEED = 1.9;    // rad/s
const PULSE_PERIOD = 1.6;   // s entre pulsadas vermelhas (mesmo ritmo do START antigo)

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
// Raio no frame 4 (linha 3): 3 px de altura (linhas 41–43); trecho quente
// 66–88 (laranja/âmbar) e ponta escura 89–99 (vinho).
const BEAM_ROW = 41, BEAM_H = 3, BEAM_HOT0 = 66, BEAM_HOT1 = 89, BEAM_TAIL = 11;
const BEAM_FLOW = 140;      // px de sprite/s que o trecho quente rola para a frente
// Pixels emitidos pelo raio: cores do raio no sprite (calor ≤ âmbar, sem o rosado).
const BEAM_HEAT = 0.86;

// Brilho do raio: faixa vertical de 1 px (degradê do eixo para as bordas) e a
// camada pequena onde o brilho é montado coluna a coluna. Criadas uma vez.
let _glowStrip = null, _glowLayer = null;
function glowStrip() {
    if (_glowStrip) return _glowStrip;
    const c = document.createElement('canvas');
    c.width = 1; c.height = 32;
    const g = c.getContext('2d');
    const lg = g.createLinearGradient(0, 0, 0, 32);
    lg.addColorStop(0, 'rgba(255, 70, 30, 0)');
    lg.addColorStop(0.32, 'rgba(255, 100, 40, 0.32)');
    lg.addColorStop(0.5, 'rgba(255, 200, 130, 0.7)');
    lg.addColorStop(0.68, 'rgba(255, 100, 40, 0.32)');
    lg.addColorStop(1, 'rgba(255, 70, 30, 0)');
    g.fillStyle = lg;
    g.fillRect(0, 0, 1, 32);
    return (_glowStrip = c);
}
function glowLayer() {
    if (_glowLayer) return _glowLayer;
    const c = document.createElement('canvas');
    c.width = 160; c.height = 24;
    return (_glowLayer = c);
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

// Distâncias horizontais da luta a partir da parede (px de mundo). No vídeo
// VERTICAL o quadro é estreito: a luta fica mais perto da caveira, para que
// caveira + jogadores caibam na largura com zoom alto (a altura da sala enche
// o quadro, sem faixa de vazio).
const DIST = {
    landscape: { appear: 650, shock: 760, shockAmp: 50, fight: 600, fightAmp: 230, lo: 330, hi: 900, warn: 420, dodgeAmp: 150 },
    portrait: { appear: 380, shock: 430, shockAmp: 30, fight: 360, fightAmp: 80, lo: 280, hi: 440, warn: 380, dodgeAmp: 60 }
};

export class BossWallShot extends RushShot {
    constructor(stage) {
        const torches = [];
        for (let c = 3; c < COLS - 2; c += 6) torches.push({ col: c, row: 0, side: 'N', type: 'torch' });
        super(stage, {
            cols: COLS, rows: ROWS, doors: {}, seed: 113, ropeLen: 230,
            ambient: '46, 24, 28', vignette: 0.8, torches
        }, 99);
        this.cutIn = null;          // contínua: o disco da cena 10 se abre (SawIris)
        // Explosão em pixel art na paleta do boss (tools/gen_explosion.py).
        const boom = stage.assets.get('fxExplosion') || stage.assets.load('fxExplosion', 'assets/fx/explosion.png');
        // Fogo no MESMO tamanho de pixel do boss (pixel normalizado).
        this.fx = new FxParticles(boom, { pixel: BS });   // mundo (fogo, brasas, pedaços)
        this.fxScreen = new FxParticles(null, { pixel: 8 }); // tela (brasas do plano final)
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
        // Plano final: título com o golpe de cartela e a trilha de volta, cheia.
        const au = this.stage.audio;
        if (this.leapLT >= 0 && !this._titleSnd && this.leapLT >= TITLE_AT) {
            this._titleSnd = true;
            au?.play('sting', { vol: 1, noSlow: true });
            au?.mood(-4, 20000, 1.6);
        }
        if (this.leapLT >= 0.9 && !this._beat2) { this._beat2 = true; au?.play('heartbeat', { vol: 0.8, noSlow: true }); }
        if (this._leapPending && this.leapLT < 0) {
            this._leapPending = false;
            this.leapLT = 0;
            // Salto em câmera lenta: o mundo afunda, só o coração e o ar.
            au?.play('slowmo', { vol: 0.85, noSlow: true });
            au?.play('heartbeat', { vol: 0.9, noSlow: true });
            au?.mood(-15, 520, 0.5);
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
        this._titleSnd = this._beat2 = this._slowLeap = this._looked = this._looked2 = false;
        this._fired = new Set();
        this._kills = 0;
        this._embAcc = 0;
        this.mode = 'calm';
        this.blasts = [];
        this._fAng = Math.PI / 2;   // corda na vertical (p1 em cima)
        this._dodge = null;
        this._kick = null;

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

        A.onKill = (e) => {
            S._kills++;
            if (S.mode !== 'fight' && S.mode !== 'dodge') return;
            // Tranco de câmera na direção do abate (decai em ~0.3s).
            if (e) S._kick = { x: e.x, y: e.y, t: A.t, s: S._kills % 2 ? 1 : -1 };
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
        // Vídeo vertical: o quadro alto vai da parede de cima (tochas) até a
        // de baixo — nada de vazio acima/abaixo da sala.
        A.clampY = [-10, A.rect.h + 4];
    }

    get away() { return this.B.side === 'R' ? -1 : 1; }   // do boss para os jogadores
    get dist() { return DIST[this.stage.portrait ? 'portrait' : 'landscape']; }

    // ---- Eventos ----
    _appear(A, side) {
        const B = this.B, m = A.mid;
        B.side = side;
        B.visible = true;
        B.alpha = 1; B.stretch = 1; B.crack = 0;
        B.tx = m.x - this.away * this.dist.appear;
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
        for (let i = 0; i < 24; i++) {
            const y = rnd(60, 640);
            this.fx.ember(B.x + away * rnd(80, 200), y, away * rnd(6, 16), rnd(-2, 2), { size: rnd(3, 8), life: rnd(0.6, 1.4) });
        }
        for (let i = 0; i < 8; i++) {
            this.fx.fire(B.x + away * rnd(60, 160), rnd(120, 600), away * rnd(4, 9), 0, { r: rnd(50, 90), life: rnd(0.4, 0.7) });
            A.particles.triggerDust(B.x + away * 120, rnd(140, 620), away, 0, 8);
        }
        const s = A.ws(A.mid.x, A.mid.y);
        A.lens.trigger(s.x, s.y, 0.6);
        // Entrada DE UMA VEZ: pancada + estrondo + chama; a trilha explode.
        const au = this.stage.audio;
        A.sfx('impact', B.x, B.y, { vol: 1, cool: 0 });
        A.sfx('boom', B.x, B.y, { vol: 0.85, rate: 0.7, cool: 0 });
        A.sfx('flame', B.x, B.y, { vol: 0.7, rate: 0.8 });
        au?.duck(-12, 0.06, 0.55);
        au?.mood(0, 20000, 0.25);
        au?.excite(1);
        if (this.mode === 'calm') this.mode = 'shock';
        else this.mode = 'shock2';
        this._shockT = A.t;
    }

    // Som da cena: ronco grave enquanto o boss está presente; no plano
    // final a serra gira em primeiro plano e a câmera lenta só vale até o título.
    audioState(s) {
        const B = this.B, lt = this.leapLT;
        const calmRumble = this.mode === 'calm' ? 0.12 + 0.35 * Math.min(1, this.arena.t / 0.8) : 0;
        const o = { rumble: calmRumble + (B?.visible ? 0.18 * B.alpha : 0) };
        if (lt >= 0) {
            o.players = null;
            o.saw = { visible: true, spin: lt < FREEZE_AT ? 1 : 0.55, scale: 1.4 };
            o.slow = lt > TITLE_AT ? 1 : s.slow;
            o.rumble = 0;
        }
        return o;
    }
    _roar(A) {
        const B = this.B;
        B.act = 'roar'; B.actT = A.t;
        A.both(p => { p.shiver = 0.55; A.expr(p, 'assustado'); });
        A.red = 1; A.redHz = 2.2;
        A.sfx('roar', B.x, B.y, { vol: 1, rate: 0.72, cool: 0 });
        A.sfx('flame', B.x, B.y, { vol: 0.5, rate: 0.6 });
        this.stage.audio?.duck(-6, 0.4, 0.8);
    }
    _spit(A, n) {
        const B = this.B;
        B.act = 'spit'; B.actT = A.t; B.spawned = 0; B.spitN = n;
        A.renderer.triggerShake(14);
        A.sfx('flame', B.x, B.y, { vol: 0.9, rate: 0.85, cool: 0 });
        A.sfx('roar', B.x, B.y, { vol: 0.4, rate: 1.1, cool: 0 });
    }
    _fight(A, expr = null) {
        this.mode = 'fight';
        this._fightT = A.t;
        A.both(p => { p.shiver = 0; p.accel = 0.24; p.wobble = 0.3; if (expr) A.expr(p, expr); });
    }
    _beam(A, dodgeDir, final = false) {
        const B = this.B;
        B.act = 'beam'; B.actT = A.t; B.locked = false; B.firing = false; B.faded = false; B.final = final;
        B.dodgeDir = dodgeDir;
        // Carga + aviso: zumbido subindo; a trilha recua um pouco (tensão).
        A.sfx('beamCharge', B.x, B.y, { vol: 0.95, cool: 0 });
        this.stage.audio?.mood(-5, 7000, 0.4);
    }
    _vanish(A) {
        const B = this.B;
        B.act = 'vanish'; B.actT = A.t;
        A.renderer.triggerShake(16);
        A.sfx('flame', B.x, B.y, { vol: 1, rate: 0.65, cool: 0 });
        A.sfx('whoosh', B.x, B.y, { vol: 0.6, rate: 0.7 });
        this.stage.audio?.mood(-9, 2600, 0.3);
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
        this._crackRays(A);
        this._stepPlayers(A, t);
        this._stepMinions(A);
        this._stepEmbers(A, t);
        for (let i = this.blasts.length - 1; i >= 0; i--) {
            const b = this.blasts[i];
            if (t < b.at) continue;
            this.blasts.splice(i, 1);
            this.fx.blast(b.x, b.y, b.power, A.renderer.tileset, DEBRIS);
            A.sfx('boom', b.x, b.y, { vol: 0.35 + 0.2 * b.power, rate: 1.25 - 0.2 * b.power, cool: 0.05 });
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
            this._beamSuck(A, 2);
        } else if (u < w) {
            this._beamSuck(A, 1);
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
            this._beamSparks(A);
        } else if (u < fd) {
            B.frame = 5; ty = B.y; yk = 0; bob = 0;
            if (!B.faded) { B.faded = true; this._beamRemains(A, 34); }
            else this._beamRemains(A, 1);
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
        const wd = this.dist.warn;
        const xm = this.away > 0 ? Math.max(A.mid.x, B.x + wd) : Math.min(A.mid.x, B.x - wd);
        this.mode = 'dodge';
        this._dodge = { x: xm, y: yc, t: A.t };
        p1.goal = { x: xm - 85, y: yc, speed: 10 };
        p2.goal = { x: xm + 85, y: yc, speed: 10 };
        A.both(p => { p.accel = 0.3; A.exprFor(p, 'espantado', 0.7); });
        A.renderer.triggerShake(10);
    }

    // ---- Pixels do raio (grade do boss, só cores do raio) ----
    get _mouth() { const B = this.B; return { x: B.x + this.away * (SKULL_HALF + 1) * BS, y: B.y + B.bob }; }

    // Carga/aviso: pixels sugados para a boca (convergem e apagam ao chegar).
    _beamSuck(A, n) {
        const mo = this._mouth, away = this.away;
        for (let i = 0; i < n; i++) {
            const a = (away > 0 ? 0 : Math.PI) + rnd(-1.1, 1.1);
            const r = rnd(3, 9) * BS, life = rnd(0.22, 0.34);
            const x = mo.x + Math.cos(a) * r, y = mo.y + Math.sin(a) * r;
            // Velocidade para chegar à boca no fim da vida (passos de 60 Hz).
            const steps = life * 60;
            this.fx.ember(x, y, (mo.x - x) / steps, (mo.y - y) / steps,
                { size: BS, life, heat: BEAM_HEAT * rnd(0.75, 1), float: false, drag: 1 });
        }
    }

    // Rajada na boca no instante do disparo (cone para a frente).
    _beamBurst(A) {
        const mo = this._mouth, away = this.away;
        for (let i = 0; i < 26; i++) {
            const a = (away > 0 ? 0 : Math.PI) + rnd(-1.05, 1.05);
            const s = rnd(6, 17);
            this.fx.ember(mo.x, mo.y + rnd(-1, 1) * BS, Math.cos(a) * s, Math.sin(a) * s,
                { size: BS * (Math.random() < 0.25 ? 2 : 1), life: rnd(0.25, 0.55), heat: BEAM_HEAT, float: false, drag: 0.9 });
        }
    }

    // Disparo: faíscas correndo ao longo do raio + crepitar nas bordas.
    _beamSparks(A) {
        const B = this.B, away = this.away, mo = this._mouth;
        const y = B.beamY;
        for (let i = 0; i < 3; i++) {
            const s = rnd(2, 70) * BS;
            this.fx.ember(mo.x + away * s, y + rnd(-1, 1) * BS * 0.8, away * rnd(14, 28), 0,
                { size: BS, life: rnd(0.12, 0.3), heat: BEAM_HEAT * rnd(0.85, 1), float: false, drag: 0.96 });
        }
        for (let i = 0; i < 2; i++) {
            const s = rnd(2, 60) * BS, side = Math.random() < 0.5 ? -1 : 1;
            this.fx.ember(mo.x + away * s, y + side * rnd(1.8, 2.8) * BS, away * rnd(1, 5), side * rnd(2, 6),
                { size: BS, life: rnd(0.2, 0.45), heat: BEAM_HEAT * rnd(0.6, 0.85), float: false, drag: 0.93 });
        }
    }

    // Raio apagando: restos flutuando na linha, esfriando para o vinho.
    _beamRemains(A, n) {
        const B = this.B, away = this.away, mo = this._mouth;
        for (let i = 0; i < n; i++) {
            const s = rnd(1, 75) * BS;
            this.fx.ember(mo.x + away * s, B.beamY + rnd(-1.2, 1.2) * BS, away * rnd(0.5, 2.5), rnd(-1.2, 0.4),
                { size: BS, life: rnd(0.35, 0.9), heat: BEAM_HEAT * rnd(0.5, 0.75), float: false, drag: 0.95 });
        }
    }

    _onFire(A) {
        this._beamBurst(A);
        // Disparo: rajada + zumbido áspero; trilha abre espaço e volta empolgada.
        const mo = this._mouth, au = this.stage.audio;
        A.sfx('beamFire', mo.x, mo.y, { vol: 1, cool: 0, noSlow: true });
        A.sfx('impact', mo.x, mo.y, { vol: 0.6, rate: 1.1, cool: 0 });
        au?.duck(-8, 0.12, 0.6);
        au?.mood(-1, 20000, 0.4);
        au?.excite(0.7);
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
        // Investida: a serra cresce (giro subindo) e a trilha vai ao máximo.
        const m = A.mid, au = this.stage.audio;
        A.sfx('sawPickup', m.x, m.y, { vol: 1, rate: 0.75, cool: 0 });
        A.sfx('whoosh', m.x, m.y, { vol: 0.7, rate: 0.8 });
        au?.mood(0, 20000, 0.15);
        au?.excite(1);
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
        // Serra crava: pancada + rachaduras estalando; trilha foca (abafa um pouco).
        A.sfx('impact', B.x, B.y, { vol: 0.95, cool: 0 });
        A.sfx('crack', B.x, B.y, { vol: 1, cool: 0 });
        A.sfx('sawHit', A.sawPos.x, A.sawPos.y, { vol: 1, rate: 0.7, cool: 0 });
        this.stage.audio?.mood(-4, 3500, 0.25);
    }

    _death(A) {
        const B = this.B, t = A.t;
        this.mode = 'blown';
        B.act = 'death'; B.actT = t;
        A.impactFlash = 1;
        A.renderer.triggerShake(60);
        A.renderer.triggerZoomPunch(-0.1);
        A.red = 1;
        // Morte: o maior estrondo do trailer (a trilha abre espaço e volta no máximo).
        const au = this.stage.audio;
        A.sfx('boom', B.x, B.y, { vol: 1, rate: 0.6, cool: 0 });
        A.sfx('impact', B.x, B.y, { vol: 1, rate: 0.8, cool: 0 });
        A.sfx('roar', B.x, B.y, { vol: 0.7, rate: 0.55, cool: 0 });
        au?.duck(-14, 0.1, 0.9);
        au?.excite(1);
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
        A.sfx('enemySpawn', x, y, { vol: 0.45, rate: type === 'hellbat' ? 1.3 : 1, cool: 0.06 });
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
        if (B.visible) { if (Math.random() < 0.35) this._emberFromFlame(A, 1); }
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
            // Recuam cambaleando (vaivém curto), sem ficar plantados.
            const u = t - (this._shockT ?? t), Dd = this.dist;
            this._formation(A, B.tx + away * (Dd.shock + Dd.shockAmp * Math.sin(u * 5)), Y_MID + 40 * Math.sin(u * 3.4), 90, 4.5);
            if (this.mode === 'shock2' && t - this._shockT > 0.35) this._fight(A, 'furia');
            return;
        }
        // Raio acabou (ou foi emendado em outra ação): voltam à luta.
        if (this.mode === 'dodge' && B.act !== 'beam') this._fight(A, 'furia');
        if (this.mode === 'fight') {
            // Nunca param: o MEIO da corda (= serra) percorre um caminho
            // contínuo (Lissajous) entre 330 e 900 px da parede, puxado para o
            // minion mais próximo (caçam a leva). A corda fica de través ao
            // movimento (varre como lâmina) e gira devagar.
            const u = t;   // tempo global: o caminho não "pula" ao voltar à luta
            const Dd = this.dist;
            let mx = B.tx + away * (Dd.fight + Dd.fightAmp * Math.sin(u * 2.4 + 0.6));
            let my = Y_MID + 150 * Math.sin(u * 1.75) + 40 * Math.sin(u * 4.3);
            const prey = this._nearestMinion(A, A.mid);
            if (prey) {
                const k = 0.6;
                mx = lerp(mx, prey.x, k); my = lerp(my, prey.y, k);
            }
            const lo = away > 0 ? B.tx + Dd.lo : B.tx - Dd.hi, hi = away > 0 ? B.tx + Dd.hi : B.tx - Dd.lo;
            mx = clamp(mx, lo, hi);
            my = clamp(my, Y_TOP + 20, Y_BOT - 10);
            this._formation(A, mx, my, 95, 10);
            return;
        }
        if (this.mode === 'dodge') {
            // Correm paralelos ao raio (vaivém), sem parar esperando o disparo.
            const g = this._dodge;
            if (g) {
                const u = t - g.t;
                const x = g.x + away * this.dist.dodgeAmp * Math.sin(u * 3.2);
                A.both(p => {
                    const off = (p === p1 ? -1 : 1) * 85;
                    p.goal = { follow: true, x: x + off, y: g.y + Math.sin(u * 6 + (p === p1 ? 0 : 2)) * 12, gain: 0.22, max: 10 };
                });
            }
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
                // Serra moendo a caveira (golpes graves em sequência).
                A.sfx('sawHit', cx, sp.y, { vol: 0.5 + 0.4 * B.crack, rate: 0.6 + 0.3 * B.crack, cool: 0.075 });
            }
            if (u >= 0.75) this._death(A);
            return;
        }
        if (this.mode === 'blown') {
            if (t - B.actT > 0.3) this._leapPending = true;
            if (!this._slowLeap && t - B.actT > 0.22) { this._slowLeap = true; A.slowmo(999, 0.12); }
        }
    }

    // Formação dos dois em volta de (mx, my): corda de través ao movimento do
    // meio (varre como lâmina), girando suave; nunca inverte de lado.
    _formation(A, mx, my, half, max) {
        const { p1, p2 } = A, B = this.B, m = A.mid;
        const dx = mx - m.x, dy = my - m.y;
        if (Math.hypot(dx, dy) > 25) {
            let a = Math.atan2(dy, dx) + Math.PI / 2;
            // a e a+π dão a mesma corda: escolhe o mais perto do atual.
            let diff = Math.atan2(Math.sin(a - this._fAng), Math.cos(a - this._fAng));
            if (Math.abs(diff) > Math.PI / 2) diff -= Math.sign(diff) * Math.PI;
            this._fAng += diff * 0.05;
        }
        const cx = Math.cos(this._fAng) * half, cy = Math.sin(this._fAng) * half;
        p1.goal = { follow: true, x: mx - cx, y: clamp(my - cy, Y_TOP - 20, Y_BOT + 30), gain: 0.2, max };
        p2.goal = { follow: true, x: mx + cx, y: clamp(my + cy, Y_TOP - 20, Y_BOT + 30), gain: 0.2, max };
        A.both(p => { p.faceX = B.x; });
    }

    _nearestMinion(A, pt, maxD = 700) {
        let best = null, bd = maxD;
        for (const e of A.enemies) {
            if (e.state === 'dying' || e.isHidden) continue;
            const d = Math.hypot(e.x - pt.x, e.y - pt.y);
            if (d < bd) { bd = d; best = e; }
        }
        return best;
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
        // Vídeo vertical: planos um pouco mais fechados (a altura da sala enche
        // o quadro alto) e centrados entre a caveira e os dois (ver abaixo).
        const portrait = this.stage.portrait;
        const pz = portrait ? 1.2 : 1;
        const z = FIGHT_ZOOM * pz * A.zoomRef * A.camClose;
        const hw = W / (2 * z);
        // Boss sumindo: a câmera já vai para o lado onde ele vai ressurgir
        // (a entrada "de uma vez" acontece dentro do quadro).
        const switching = (B.act === 'vanish' && A.t - B.actT > 0.15) || B.act === 'gone';
        if (switching || this.mode === 'shock' || this.mode === 'shock2' || !B.visible) {
            let tx = B.tx, aw = this.away;
            if (switching) { aw = -this.away; tx = m.x - aw * this.dist.appear; }
            const k = switching || this.mode === 'shock2' ? 0.11 : 0.09;
            // Vídeo vertical: com o boss na borda (como na paisagem) os dois
            // sairiam pela OUTRA borda do quadro estreito; centra entre os dois
            // e a caveira, um pouco mais perto deles (a caveira é enorme).
            // Se a onda do impacto os afasta demais, eles mandam (a caveira
            // fica na borda). Conta o mais LONGE dos dois, não o meio: com a
            // corda deitada um deles sairia pela borda.
            const D = Math.abs(m.x - tx);
            const far = Math.max(Math.abs(A.p1.x - tx), Math.abs(A.p2.x - tx));
            const off = portrait ? Math.max(0.55 * D, far - (hw - 80)) : 0.7 * hw;
            A.focus({ x: tx + aw * off + h.x, y: CAM_Y + h.y, zoom: FIGHT_ZOOM * pz, rot: h.r, k });
            return;
        }

        // Plano de luta: a câmera troca de "posição de drone" a cada ~1.3s
        // (aberto, aproximando, holandês, rasante) e reage às ações (cuspe,
        // raio, investida, abates). `fit` garante os dois jogadores e a FRENTE
        // da caveira sempre no quadro (o zoom cede se não couber).
        const away = this.away;
        const skull = { x: B.x + away * SKULL_HALF * BS, y: B.y };
        const fit = [A.p1, A.p2, skull];
        const vx = (A.p1.vx + A.p2.vx) / 2, vy = (A.p1.vy + A.p2.vy) / 2;
        const lead = { x: vx * 14, y: vy * 10 };       // olha para onde estão indo
        const seg = Math.floor(t / 1.3), su = (t / 1.3) % 1;
        const SHOTS = ['wide', 'push', 'dutch', 'dolly'];
        let shot = SHOTS[seg % SHOTS.length];
        const u = t - B.actT;
        if (B.act === 'beam') shot = u < BEAM.charge + BEAM.warn ? 'beamAim' : 'beamFire';
        else if (B.act === 'spit' && u < 0.8) shot = 'mouth';
        if (this.mode === 'charge') shot = 'charge';

        let cx, cy, zoom, rot, k = 0.08;
        const side = seg % 2 ? 1 : -1;
        switch (shot) {
            case 'wide':      // aberto: boss a ~85% da largura, como o plano base
                cx = B.tx + away * 0.7 * hw; cy = CAM_Y; zoom = FIGHT_ZOOM; rot = 0.03 * side; break;
            case 'push':      // aproxima nos dois, a caveira na borda
                cx = lerp(m.x, skull.x, 0.35); cy = lerp(m.y, B.y, 0.3) - 10;
                zoom = lerp(1.25, 1.5, easeInOut(su)); rot = 0.05 * side; k = 0.07; break;
            case 'dutch':     // holandês: inclina forte para o lado da ação
                cx = lerp(m.x, skull.x, 0.45); cy = m.y * 0.6 + CAM_Y * 0.4;
                zoom = 1.3; rot = 0.14 * side; k = 0.07; break;
            case 'dolly':     // trilho lateral: desliza junto deles, girando
                cx = lerp(m.x, skull.x, 0.4) + lerp(-60, 60, su) * away; cy = m.y * 0.5 + CAM_Y * 0.5;
                zoom = lerp(1.15, 1.4, su); rot = lerp(-0.1, 0.1, su) * side; break;
            case 'mouth':     // boss cospe: puxa para a boca
                cx = lerp(m.x, skull.x, 0.62); cy = B.y; zoom = 1.38; rot = -0.06 * away; k = 0.1; break;
            case 'beamAim':   // carga/aviso: aberto e tenso, inclinando devagar
                cx = B.tx + away * 0.66 * hw; cy = lerp(CAM_Y, B.y, 0.4); zoom = 1.05 + 0.12 * clamp01(u / 0.8);
                rot = -0.05 * away; k = 0.09; break;
            default:          // beamFire: recua no disparo, gira contra o raio
                cx = B.tx + away * 0.72 * hw; cy = CAM_Y; zoom = 1.0; rot = 0.08 * away; k = 0.12; break;
            case 'charge':    // investida: colado neles correndo para a caveira
                cx = lerp(m.x, skull.x, 0.5); cy = lerp(m.y, B.y, 0.5); zoom = 1.45; rot = -0.09 * away; k = 0.1; break;
        }
        // Vídeo vertical: o `fit` é medido a partir do centro da câmera, então
        // um centro torto (boss na borda) derrubaria o zoom no quadro estreito.
        // Centra no MEIO entre a caveira e o mais longe dos dois (com um resto
        // do enquadramento do plano) e fecha um pouco o zoom.
        if (portrait) {
            const xs = fit.map(p => p.x);
            cx = lerp((Math.min(...xs) + Math.max(...xs)) / 2, cx, 0.2);
            zoom *= pz;
        }
        // Tranco no abate: a câmera dá um puxão para o ponto e gira um pouco.
        const kk = this._kick && t - this._kick.t < 0.3 ? 1 - (t - this._kick.t) / 0.3 : 0;
        if (kk > 0) {
            cx += (this._kick.x - cx) * 0.12 * kk; cy += (this._kick.y - cy) * 0.12 * kk;
            zoom += 0.12 * kk; rot += 0.04 * this._kick.s * kk;
        }
        cy = clamp(cy, 240, 380);
        A.focus({ x: cx + lead.x + h.x, y: cy + lead.y + h.y, zoom, rot: rot + h.r, k, fit, pad: 95 });
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
        if (firing) {
            // Disparo: o frame até a coluna 88; daí em diante o TRECHO QUENTE
            // do raio (colunas 66–88) se repete rolando para a frente, e a
            // ponta escura do sprite (89–99) fecha o fim do raio.
            ctx.drawImage(img, sx, sy, BEAM_HOT1, 100, -ax, -ANCHOR_Y, BEAM_HOT1, 100);
            const x0 = BEAM_HOT1 - ax, x1 = 100 + BEAM_EXT - BEAM_TAIL - ax;
            const tw = BEAM_HOT1 - BEAM_HOT0;
            const off = Math.floor(A.t * BEAM_FLOW) % tw;      // px inteiros: grade intacta
            ctx.save();
            ctx.beginPath();
            ctx.rect(x0, BEAM_ROW - ANCHOR_Y - 1, x1 - x0, BEAM_H + 2);
            ctx.clip();
            for (let x = x0 - tw + off; x < x1; x += tw) {
                ctx.drawImage(img, sx + BEAM_HOT0, sy + BEAM_ROW, tw, BEAM_H, x, BEAM_ROW - ANCHOR_Y, tw, BEAM_H);
            }
            ctx.restore();
            ctx.drawImage(img, sx + BEAM_HOT1, sy + BEAM_ROW, BEAM_TAIL, BEAM_H, x1, BEAM_ROW - ANCHOR_Y, BEAM_TAIL, BEAM_H);
        } else {
            ctx.drawImage(img, sx, sy, 100, 100, -ax, -ANCHOR_Y, 100, 100);
            // Aviso / apagando: linha fina = última coluna do frame esticada.
            if (warn || (B.row === 3 && B.frame === 5)) {
                ctx.globalAlpha = B.alpha * (warn ? 0.55 + 0.45 * Math.sin(A.t * 70) : 1);
                ctx.drawImage(img, sx + 99, sy + 28, 1, 28, 100 - ax, 28 - ANCHOR_Y, BEAM_EXT, 28);
            }
        }
        // Rachaduras de luz: silhueta clara (linha 0) piscando por cima.
        if (B.crack > 0.01) {
            // Pulso suave (sem piscar aleatório) e teto baixo: brilha sem
            // estourar a caveira num bloco branco chapado.
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = clamp01(B.crack * 0.5 * (0.8 + 0.2 * Math.sin(A.t * 14)));
            ctx.drawImage(img, 0, 0, 100, 100, -52.5, -ANCHOR_Y, 100, 100);
        }
        ctx.restore();

        // Brilho do raio (aditivo, no mundo): nasce DENTRO da boca (atrás do
        // sprite) e ganha força em ~2 tiles; mais forte perto da boca, some ao
        // longe; espessura ondulando por fatias (não é um retângulo).
        if (firing || warn) {
            const y = B.beamY, t = A.t;
            const s0 = 4 * BS;                                   // dentro da boca
            const len = (100 + BEAM_EXT - ax) * BS - s0;
            const base = firing ? 4.5 * BS : 1.4 * BS;
            const amp = firing ? 0.6 : 0.3 * (0.5 + 0.5 * Math.sin(t * 70));
            // Montado numa camada pequena (1 coluna = 1 fatia, sem sobreposição
            // = sem emendas) e ampliado com suavização: é luz, não pixel.
            const gv = glowLayer(), g2 = gv.getContext('2d');
            const GW = gv.width, GH = gv.height, maxTh = base * 1.3;
            g2.setTransform(1, 0, 0, 1, 0, 0);
            g2.globalCompositeOperation = 'source-over';
            g2.globalAlpha = 1;
            g2.clearRect(0, 0, GW, GH);
            const strip = glowStrip();
            for (let i = 0; i < GW; i++) {
                const f = i / GW, s = f * len;
                const fadeIn = clamp01(s / 128);                  // ~2 tiles a partir da boca
                const a = amp * fadeIn * (1 - 0.65 * f);
                if (a <= 0.01) continue;
                const th = base * (1 + 0.16 * Math.sin(i * 0.35 - t * 24) + (firing ? 0.06 * Math.sin(t * 61) : 0));
                const hp = GH * th / maxTh;
                g2.globalAlpha = Math.min(1, a);
                g2.drawImage(strip, 0, 0, 1, strip.height, i, (GH - hp) / 2, 1, hp);
            }
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.imageSmoothingEnabled = true;
            ctx.save();
            ctx.translate(B.x + away * s0, y);
            if (away < 0) ctx.scale(-1, 1);
            ctx.drawImage(gv, 0, -maxTh / 2, len, maxTh);
            ctx.restore();
            // Clarão pequeno na boca: esconde a emenda do sprite com o brilho.
            if (firing) {
                const mx = B.x + away * 10 * BS, r = 4 * BS * (0.9 + 0.15 * Math.sin(t * 47));
                const mg = ctx.createRadialGradient(mx, y, 0, mx, y, r);
                mg.addColorStop(0, 'rgba(255, 210, 150, 0.45)');
                mg.addColorStop(0.45, 'rgba(255, 120, 50, 0.2)');
                mg.addColorStop(1, 'rgba(255, 70, 30, 0)');
                ctx.fillStyle = mg;
                ctx.fillRect(mx - r, y - r, r * 2, r * 2);
            }
            ctx.restore();
        }

        // Rachaduras: os FEIXES são pixel art na grade do boss (desenhados pelo
        // FxParticles, ver _crackRays); aqui só um brilho leve no miolo.
        if (B.crack > 0.01) {
            const cx = B.x + B.jx, cy = B.y + B.bob + 2 * BS;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const cr = (5 + 8 * B.crack) * BS;
            const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
            cg.addColorStop(0, `rgba(255, 236, 210, ${0.28 * B.crack})`);
            cg.addColorStop(0.4, `rgba(255, 170, 100, ${0.12 * B.crack})`);
            cg.addColorStop(1, 'rgba(255, 120, 60, 0)');
            ctx.fillStyle = cg;
            ctx.fillRect(cx - cr, cy - cr, cr * 2, cr * 2);
            ctx.restore();
        }
    }

    // Feixes de luz das rachaduras (mundo): ângulos fixos (ângulo áureo)
    // girando devagar, comprimento e largura pulsando. Viram pixels da paleta
    // na camada normalizada do FxParticles (miolo claro → âmbar → laranja).
    _crackRays(A) {
        const B = this.B, t = A.t;
        if (!B.visible || B.crack <= 0.01) { this.fx.rays = []; return; }
        const cx = B.x + B.jx, cy = B.y + B.bob + 2 * BS;
        const rays = [];
        for (let i = 0; i < RAYS; i++) {
            const vary = 0.6 + 0.4 * (((i * 37) % 10) / 10);
            rays.push({
                x: cx, y: cy,
                ang: i * 2.39996 + 0.3 + t * 0.12 * (i % 2 ? 1 : -1),
                len: (8 + 26 * B.crack) * BS * vary * (0.92 + 0.08 * Math.sin(t * 7 + i)),
                wid: (1.6 + 2.6 * B.crack) * BS * (0.7 + 0.3 * vary),
                heat: clamp01(B.crack * 1.4) * (0.85 + 0.15 * Math.sin(t * 11 + i * 1.7))
            });
        }
        this.fx.rays = rays;
    }

    _lights(A, pp, ws, pix) {
        const B = this.B;
        if (!B.visible) return;
        const away = this.away;
        const s = ws(B.x, B.y - 3 * BS);
        pp.addLight(s.x, s.y, 1050 * B.alpha * s.zoom, pix(s.zoom, 1.4), 0.9, BOSS_LIGHT);
        const firing = B.row === 3 && B.frame === 4, warn = B.row === 3 && B.frame === 3;
        if (firing || warn) {
            // Faixa de luz no chão: começa na boca, luzes próximas e achatadas,
            // piscando junto com o raio (e mais fracas ao longe).
            const t = A.t, n = firing ? 14 : 8;
            for (let i = 0; i < n; i++) {
                const d = (SKULL_HALF + 1) * BS + i * 190;
                const p = ws(B.x + away * d, B.beamY);
                const pulse = 0.82 + 0.18 * Math.sin(t * 31 + i * 1.3);
                const near = i === 0 ? 0.6 : 1;
                const fall = 1 - 0.45 * (i / n);
                const r = (firing ? 270 : 100) * pulse * near * fall;
                pp.addLight(p.x, p.y, r * p.zoom, pix(p.zoom), 0.4, BEAM_LIGHT);
            }
        }
        if (B.crack > 0.01) {
            pp.addLight(s.x, s.y, (220 + 520 * B.crack) * s.zoom, pix(s.zoom), 1, CRACK_LIGHT);
        }
    }

    // ---- Plano final (tela): salto em câmera lenta na direção da câmera ----
    _tickScreenEmbers(dt) {
        const W = this.stage.canvas.width, H = this.stage.canvas.height;
        const base = this.stage.refSize;   // escala dos bonecos (= H em paisagem)
        this._embAcc += dt * 60;
        const steps = Math.floor(this._embAcc);
        this._embAcc -= steps;
        for (let i = 0; i < steps; i++) {
            for (let k = 0; k < 1; k++) {
                this.fxScreen.ember(rnd(0, W), H * rnd(0.85, 1.0), rnd(-1.5, 1.5), rnd(-5, -2),
                    { size: rnd(3, 8) * base / 900, life: rnd(1.2, 2.4) });
            }
        }
        this.fxScreen.update(steps);
    }

    // Plano final no vídeo VERTICAL: logo em cima, os dois no meio e espaço
    // embaixo para a chamada "DOWNLOAD NOW" (ItchCta), tudo dentro da área
    // que a interface do Reels não cobre. Em paisagem: logo no centro.
    get logoCy() {
        const H = this.stage.canvas.height;
        return this.stage.portrait ? Math.round(H * 0.25) : H / 2;
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
        // Pulsada vermelha leve no fundo (tela do START): entra depois da logo,
        // batida curta tipo coração a cada PULSE_PERIOD, mais forte nas bordas.
        const pk = easeInOut(clamp01((lt - TITLE_AT - 0.3) / 0.8));
        if (pk > 0) {
            const beat = Math.pow(0.5 + 0.5 * Math.sin((lt / PULSE_PERIOD) * Math.PI * 2), 3);
            const pa = pk * (0.04 + 0.12 * beat);
            const pg = ctx.createRadialGradient(W / 2, H / 2, H * 0.15, W / 2, H / 2, Math.hypot(W, H) * 0.6);
            pg.addColorStop(0, `rgba(170, 12, 28, ${pa * 0.35})`);
            pg.addColorStop(1, `rgba(170, 12, 28, ${pa})`);
            ctx.fillStyle = pg;
            ctx.fillRect(0, 0, W, H);
        }
        // Tamanho dos bonecos pelo LADO CURTO (= H em paisagem): no vídeo
        // vertical eles cabem na largura, lado a lado.
        const portrait = this.stage.portrait, base = this.stage.refSize;
        // Brasas na grade de pixel dos bonecos gigantes (≈ altura × 0.42 / 23 px de arte).
        this.fxScreen.pixel = Math.max(2, Math.round(base * 0.42 / 23));
        this.fxScreen.draw(ctx);

        // Escala "3D falsa": crescem vindo na direção da câmera.
        const grow = lt > 1.8 ? Math.min(lt, FREEZE_AT) - 1.8 : 0;
        const hFrac = lerp(0.1, portrait ? 0.4 : 0.42, e) + grow * 0.01;
        const sc = hFrac * base / 73;            // 73 = drawHeight do jogador
        // Vertical: param no meio entre a logo (acima) e a chamada (abaixo),
        // com a serra livre acima da placa.
        const y = portrait
            ? H * (lerp(0.5, 0.485, e) - 0.05 * Math.sin(Math.PI * u))
            : H * (lerp(0.5, 0.6, e) - 0.08 * Math.sin(Math.PI * u));
        // Float: depois do congelamento cada um flutua sozinho (fases
        // alternadas), em degraus de 1 pixel de arte (sc) como o resto da UI.
        const fk = easeInOut(clamp01((lt - FREEZE_AT) / 0.6));
        const floatY = (phase) => {
            if (lt <= 1.8) return 0;
            const amp = lerp(base * 0.003, FLOAT_AMP * sc, fk);
            return Math.round((Math.sin(lt * FLOAT_SPEED + phase) * amp) / sc) * sc;
        };
        const y1 = y + floatY(0), y2 = y + floatY(Math.PI * 0.6);
        const xe = portrait ? 0.27 : 0.25;
        const x1 = W * lerp(0.45, xe, e), x2 = W * lerp(0.55, 1 - xe, e);
        const tilt = 0.26 * e;

        // Corda (no espaço escalado: espessura acompanha os bonecos); as
        // pontas seguem o float de cada um, e a serra segue o meio da corda.
        const sdx = saw.dragX, sdy = saw.dragY;
        saw.dragX = 0; saw.dragY = 17;
        const a = { x: x1 / sc + 8, y: y1 / sc + 6 }, b = { x: x2 / sc - 8, y: y2 / sc + 6 };
        ctx.save();
        ctx.scale(sc, sc);
        saw.drawChain(ctx, a, b);
        const mid = saw.cablePoint(a, b, 0.5);
        ctx.restore();
        saw.dragX = sdx; saw.dragY = sdy;

        // Jogadores: vermelho à esquerda, azul à direita, fúria, inclinados para fora.
        const pose = (p, x, y, rot, faceLeft) => {
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
        pose(p1, x1, y1, -tilt, false);
        pose(p2, x2, y2, tilt, true);

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
            // Sombra suave atrás da logo (legível sobre a explosão), no
            // tamanho da logo desenhada.
            const logo = this.stage.logo, ls = this.stage.logoScale();
            const lw = (logo?.naturalWidth || 113) * (ls || 4);
            const lh = (logo?.naturalHeight || 41) * (ls || 4);
            const R = lw * 0.7;
            const cy = this.logoCy;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.translate(W / 2, cy + 6);
            ctx.scale(1, (lh * 1.1) / R);
            const dg = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
            dg.addColorStop(0, `rgba(10, 2, 4, ${0.7 * ta})`);
            dg.addColorStop(0.6, `rgba(10, 2, 4, ${0.4 * ta})`);
            dg.addColorStop(1, 'rgba(10, 2, 4, 0)');
            ctx.fillStyle = dg;
            ctx.fillRect(-R, -R, R * 2, R * 2);
            ctx.restore();
            this.stage.drawTitleLogo(0, ta, cy);
        }
    }
}
