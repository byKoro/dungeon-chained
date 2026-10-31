import { RushShot, dressRoom } from '../../kit/rushKit.js';
import { ActionQueue, ShotCamera, knock, hold, stepHold } from '../../kit/fightKit.js';
import { lerp, clamp01, easeOut, easeInOut } from '../../anim.js';
import { SawIris } from '../../fx/SawIris.js';
import { FxParticles } from '../../fx/FxParticles.js';
import { FLAME_GOLEM, FLAME_GOLEM_SPRITE } from '../../../config/FlameGolemConfig.js';

// Cena final do trailer: a dupla contra o Arauto das Brasas, um chefe corpo a corpo.
// Ele salta em cima deles e os separa, golpeia de perto; eles desviam com dash e o cortam
// com a serra do cabo em várias passadas. No golpe final ele racha, explode, os jogadores
// sobem e o título aparece (bloco do final igual ao antigo BossWallShot).

const STEP = 1 / 60;
const COLS = 72, ROWS = 14;
const SP = FLAME_GOLEM_SPRITE;
const ANIM = SP.rows;
// Pose de braços erguidos do attack2 (rugido e salto).
const RAISED = FLAME_GOLEM.attacks.attack2.raisedFrame;
// 20% maior que no jogo (5x -> 6x), escala inteira para manter os pixels nítidos.
const BS = Math.round((SP.drawHeight / SP.cropH) * 1.2);
const BODY_HALF = (SP.body.w / 2) * BS;
const BOSS_H = SP.cropH * BS;
// Âncora do sprite: centro da célula na horizontal (como o MeleeEnemy), pés na vertical (px da arte).
const ART_CX = SP.cellSize / 2;
const ART_FOOT = SP.body.y + SP.body.h;
const DX = SP.cropX - ART_CX, DY = SP.cropY - ART_FOOT;

const X0 = 2900, BY = 420;
// Faixas dos jogadores em relação aos pés do boss: o disco passa na altura da cintura dele.
const LANE_UP = -170, LANE_DN = 50;
// Corda curta (perto dos 230 do jogo): a dupla fica junta e o cabo não atravessa a sala.
const ROPE = 250;
// Golpe final: serra solta, a dupla dá dash nela e ela voa até o peito do boss.
const LAUNCH_SPEED = 26;
const FEET_MIN = 330, FEET_MAX = 520;
const DEBRIS = [2, 3, 42, 43, 10, 20, 49, 59];
const EMBER_COLOR = [255, 150, 70];

// Final (idêntico ao antigo): congela e revela o título.
const FREEZE_AT = 2.0;
const TITLE_AT = 1.9;
const FLOAT_AMP = 2.5;
const FLOAT_SPEED = 1.9;
const PULSE_PERIOD = 1.6;

const SWING = { windup: 0.42, hold: 0.12, recover: 0.42, step: 150, reach: 130, radius: 170 };

const BOSS_LIGHT = {
    color: '255, 130, 60',
    falloff: [{ offset: 0, alpha: 0.9 }, { offset: 0.4, alpha: 0.45 }, { offset: 0.75, alpha: 0.15 }, { offset: 1, alpha: 0 }],
    flickerBase: 1, flickerSine: 0.06, flickerNoise: 0.05
};
const CRACK_LIGHT = {
    color: '255, 200, 140',
    falloff: [{ offset: 0, alpha: 1 }, { offset: 0.45, alpha: 0.45 }, { offset: 1, alpha: 0 }],
    flickerBase: 1, flickerSine: 0, flickerNoise: 0.2
};

const RAYS = 12;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

export class ArautoBossShot extends RushShot {
    constructor(stage) {
        const torches = [];
        for (let c = 3; c < COLS - 2; c += 6) torches.push({ col: c, row: 0, side: 'N', type: 'torch' });
        super(stage, {
            cols: COLS, rows: ROWS, doors: {}, seed: 113, ropeLen: ROPE,
            ambient: '46, 24, 28', vignette: 0.8, torches
        }, 99);
        this.cutIn = null;
        const boom = stage.assets.get('fxExplosion') || stage.assets.load('fxExplosion', 'assets/fx/explosion.png');
        // Explosões e raios de rachadura: só no golpe final e na morte.
        this.fx = new FxParticles(boom, { pixel: BS });
        this.fxScreen = new FxParticles(null, { pixel: 8 });
        this.bossImg = stage.assets.get(SP.key) || stage.assets.load(SP.key, SP.src);
        this.cam = new ShotCamera(stage);
        this.queue = new ActionQueue();
        this._white = new Map();
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
            if (this.leapLT < FREEZE_AT) super.update(dt);
            else this.t += dt;
            this._tickScreenEmbers(dt);
        } else super.update(dt);
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
            au?.play('slowmo', { vol: 0.85, noSlow: true });
            au?.play('heartbeat', { vol: 0.9, noSlow: true });
            au?.mood(-15, 520, 0.5);
            this.arena.sawVisible = false;
        }
    }

    render() {
        super.render();
        if (this.leapLT >= 0) this._drawLeap();
    }

    setup(A) {
        const { p1, p2 } = A;
        const S = this;
        this.fx.clear();
        this.fxScreen.clear();
        this.leapLT = -1;
        this._leapPending = false;
        this._titleSnd = this._beat2 = this._slowLeap = false;
        this._fired = new Set();
        this._embAcc = 0;
        this._armed = null;
        this.cam.reset();
        this.queue.clear();
        this.mode = 'calm';
        this.blasts = [];
        this._shot = { type: 'intro', t0: 0 };

        this._launchIn = 0;
        this._trail = [];

        this._bite = null;
        this._sawSlide = null;
        A.freeSaw = null;
        A.connected = true;
        A.sawVisible = true;
        A.ropeLen = ROPE;
        A.sawScale = 1;
        A.saw.setStrain(0);
        A.minSpin = 0.9; A.saw.spin = 0.9;
        A.red = 0.3; A.redHz = 1.1;
        dressRoom(A, { seed: 113, crates: 8, rubble: 30, loot: 5, banners: 9, blood: 46, candles: false });

        A.initPlayer(p1, X0, BY + LANE_UP);
        A.initPlayer(p2, X0, BY + LANE_DN);
        A.both(p => {
            p.accel = 0.2; p.wobble = 0.15; p.shiver = 0.2;
            p._hold = { x: p.x, y: p.y }; p._holdMax = 6; p._knockT = 0;
            p.faceX = X0 + 600;
            A.expr(p, 'preocupado');
        });

        this.B = {
            visible: false, x: X0 + 1500, y: BY, jumpY: 0, jx: 0, faceLeft: true,
            act: 'none', actT: 0, row: ANIM.walk.row, frame: 0,
            hitFlash: 0, crack: 0, leap: null, swing: null, lastStepFrame: -1
        };

        // No chão ele entra na ordenação por Y; alto no salto passa por cima da parede norte,
        // então é desenhado fora do recorte da sala.
        const airborne = () => S.B.jumpY < -40;
        A.drawables = () => (S.B.visible && !airborne() ? [{ y: S.B.y, draw: (ctx) => S._drawBossSprite(ctx) }] : []);
        A.onDrawFloor = (ctx) => S._drawBossShadow(ctx);
        A.onDrawOver = (ctx) => {
            if (S.B.visible && airborne()) S._drawBossSprite(ctx);
            S._drawBossFlash(ctx);
            S._drawSawTrail(ctx, A);
            S.fx.draw(ctx);
        };
        A.onLights = (pp, ws, pix) => S._lights(A, pp, ws, pix);
        A.script = (t) => S._script(A, t);

        // Timeline (tempo da arena: a câmera lenta estica tudo junto).
        this.events = [
            [0.00, () => this._enter(A)],
            [0.95, () => this._roar(A)],
            [1.45, () => this._approach(A, -330, 11)],
            [1.85, () => this._pincer(A, 1)],
            [2.35, () => this._swing(A, null)],
            [2.65, () => this._split(A)],
            [3.05, () => this._pincer(A, 2)],
            [3.45, () => this._pincer(A, 3, { steps: 14, lag: 2, curve: 0.5 })],
            // O boss acerta o vermelho em cheio.
            [3.85, () => this._swing(A, A.p1)],
            [4.55, () => this._approach(A, -300, 13)],
            [4.85, () => this._pincer(A, 4)],
            // Salto entre os dois: o cabo arrebenta e eles se separam.
            [5.30, () => this._leapAtPlayers(A, { separate: true })],
            [6.55, () => this._soloHold(A)],
            [6.75, () => this._swing(A, A.p2, { dodge: true })],
            [7.45, () => this._regroup(A)],
            [8.05, () => this._approach(A, -300, 12)],
            [8.35, () => this._pincer(A, 5)],
            [8.75, () => this._pincer(A, 6, { lag: 4, curve: 0.5 })],
            // Agora é o azul que leva o soco.
            [9.15, () => this._swing(A, A.p2)],
            [9.85, () => this._approach(A, -300, 13)],
            [10.15, () => this._pincer(A, 7, { steps: 14 })],
            [10.60, () => this._stagger(A)],
            [10.65, () => this._approach(A, -380, 10)],
            [11.10, () => this._dropSaw(A)],
            [11.75, () => this._tackle(A)]
        ];

        A.snapCamera(X0 + 260, BY - 90, 1.05 * A.zoomRef, 0.04);
        A.clampY = [-10, A.rect.h + 4];
    }

    get dist() { return this.stage.portrait ? 0.6 : 1; }
    // O plano atual mora na câmera do kit.
    get _shot() { return this.cam.shot; }
    set _shot(v) { this.cam.shot = v; }
    get _dutch() { return this.cam.dutch; }
    _bossC(dy = -BOSS_H * 0.5) { const B = this.B; return { x: B.x, y: B.y + dy + B.jumpY }; }
    _clampPt(A, x, y) {
        const b = A.bounds;
        return { x: clamp(x, b.minX + 60, b.maxX - 60), y: clamp(y, b.minY + 40, b.maxY - 40) };
    }
    _byLane(A) { return A.p1.y <= A.p2.y ? [A.p1, A.p2] : [A.p2, A.p1]; }

    // --- boss: entrada, rugido, golpes, saltos ---

    _enter(A) {
        const B = this.B;
        B.visible = true;
        B.x = X0 + 1500; B.y = BY;
        this._startLeap(A, { x: X0 + 560, y: BY }, { entrance: true });
    }

    _roar(A) {
        const B = this.B;
        B.act = 'roar'; B.actT = A.t;
        this._shot = { type: 'boss', t0: A.t };
        A.both(p => { p.shiver = 0.5; A.expr(p, 'assustado'); });
        A.red = 1; A.redHz = 2.2;
        A.sfx('roar', B.x, B.y, { vol: 1, rate: 0.72, cool: 0 });
        this.stage.audio?.duck(-6, 0.4, 0.8);
    }

    _startLeap(A, to, { entrance = false, separate = false } = {}) {
        const B = this.B;
        B.leap = {
            x0: B.x, y0: B.y, x1: to.x, y1: clamp(to.y, FEET_MIN, FEET_MAX),
            crouch: entrance ? 0 : 0.3, air: entrance ? 0.62 : 0.6, h: entrance ? 300 : 340,
            entrance, separate, launched: false, landed: false
        };
        B.act = 'leap'; B.actT = A.t;
        B.faceLeft = B.leap.x1 < B.leap.x0;
    }

    // O salto mira o meio da dupla: a queda os obriga a se separar.
    _leapAtPlayers(A, { separate = false } = {}) {
        // Mira onde a dupla vai estar (os pontos de espera), não onde está agora no meio do dash.
        const h1 = A.p1._hold ?? A.p1, h2 = A.p2._hold ?? A.p2;
        const m = { x: (h1.x + h2.x) / 2, y: (h1.y + h2.y) / 2 };
        this._startLeap(A, { x: m.x, y: m.y + 60 }, { separate });
        this._shot = { type: 'leap', t0: A.t };
        A.both(p => A.exprFor(p, 'espantado', 0.6));
    }

    // Golpe corpo a corpo: passo à frente, pose de espera, pancada. Com `target`, acerta esse jogador.
    // `dodge`: o alvo desvia com um dash no último instante em vez de levar o soco.
    _swing(A, target, { dodge = false } = {}) {
        const B = this.B;
        const tp = target ?? A.mid;
        const face = Math.sign(tp.x - B.x) || 1;
        B.faceLeft = face < 0;
        B.act = 'swing'; B.actT = A.t;
        B.swing = { face, x0: B.x, tx: B.x + face * SWING.step, target: dodge ? null : target, hit: false, stepped: false };
        if (dodge && target) {
            const wait = Math.round((SWING.windup + SWING.hold) * 60) - 6;
            this._later(wait, () => {
                const q = this._clampPt(A, target.x + face * 170, target.y + (target.y < B.y - 60 ? -60 : 60));
                A.dash(target, q.x, q.y, { steps: 11, maxSpeed: 34, curve: 0.5 * face });
                this._hold(target, q.x, q.y, 9);
                A.exprFor(target, 'espantado', 0.5);
            });
        }
        this._shot = { type: 'swing', t0: A.t, until: A.t + SWING.windup + SWING.hold + 0.25 };
        A.sfx('roar', B.x, B.y, { vol: 0.35, rate: 1.3, cool: 0 });
        if (target) A.exprFor(target, 'espantado', 0.6);
    }

    _stagger(A) {
        const B = this.B;
        B.act = 'stagger'; B.actT = A.t;
        this._shot = { type: 'final', t0: A.t };
        A.sfx('crack', B.x, B.y, { vol: 0.8, rate: 0.8, cool: 0 });
        this.stage.audio?.play('heartbeat', { vol: 0.7 });
        this.stage.audio?.mood(-8, 3000, 0.4);
        A.both(p => A.expr(p, 'raiva'));
    }

    // --- jogadores: aproximar, desviar, dash de corte ---

    _hold(p, x, y, max = 7) { hold(p, x, y, max); }

    // Posiciona a dupla num lado do boss (dx < 0: lado onde já estão; dx > 0: lado oposto).
    _approach(A, dx, max) {
        const B = this.B;
        const here = Math.sign(A.mid.x - B.x) || -1;
        const side = dx < 0 ? here : -here;
        const x = B.x + side * Math.abs(dx) * this.dist;
        const [up, dn] = this._byLane(A);
        for (const [p, lane] of [[up, LANE_UP], [dn, LANE_DN]]) {
            const q = this._clampPt(A, x, B.y + lane);
            this._hold(p, q.x, q.y, max);
            p.shiver = 0;
        }
        if (this.mode === 'calm') this.mode = 'fight';
        if (this._shot.type !== 'final') this._shot = { type: 'fight', t0: A.t };
        A.both(p => { A.expr(p, 'furia'); A.hop(p, 4); });
    }

    // Os dois atravessam o boss lado a lado; o disco no meio do cabo passa pela cintura dele.
    // Um sai alguns passos depois do outro e o trajeto faz um arco, para não parecer trilho.
    _pincer(A, n, { steps = 16, curve = 0.35, lag = 3 } = {}) {
        const B = this.B;
        const side = Math.sign(A.mid.x - B.x) || -1;
        const ex = B.x - side * 300 * this.dist;
        const [up, dn] = this._byLane(A);
        const lead = n % 2 ? up : dn;
        const bend = (n % 2 ? 1 : -1) * curve * side;
        for (const [p, lane] of [[up, LANE_UP], [dn, LANE_DN]]) {
            const q = this._clampPt(A, ex + rnd(-30, 30), B.y + lane + rnd(-15, 15));
            const go = () => { A.dash(p, q.x, q.y, { steps, maxSpeed: 44, curve: bend }); this._hold(p, q.x, q.y); };
            if (p === lead || !lag) go(); else this._later(lag, go);
            A.hop(p, 3);
        }
        this._arm(n, steps + lag);
        this._cutShot(A, steps + lag);
    }

    // Plano de corte: a câmera persegue o disco até o acerto.
    _cutShot(A, steps) {
        if (this._shot.type === 'final') return;
        this._shot = { type: 'cut', t0: A.t, until: A.t + steps * STEP + 0.4 };
    }

    // Desvio do golpe: cada um dá dash para um lado, em arco, para trás.
    _split(A) {
        const B = this.B;
        const side = Math.sign(A.mid.x - B.x) || 1;
        const x = A.mid.x + side * 110;
        const [up, dn] = this._byLane(A);
        for (const [p, y, c, lag] of [[up, B.y - 190, 0.5, 0], [dn, B.y + 70, -0.5, 4]]) {
            const q = this._clampPt(A, x, y);
            const go = () => { A.dash(p, q.x, q.y, { steps: 12, maxSpeed: 32, curve: c * side }); this._hold(p, q.x, q.y); };
            if (lag) this._later(lag, go); else go();
            A.exprFor(p, 'espantado', 0.4);
        }
    }

    // Separação: o salto cai entre os dois, o cabo arrebenta e cada um é jogado para um lado;
    // a serra sai deslizando pelo chão.
    _separate(A) {
        const B = this.B;
        A.snap();
        A.minSpin = 0;
        const side = Math.sign(A.mid.x - B.x) || -1;
        this._sawSlide = { vx: side * 22, vy: rnd(-2, 2) };
        const [up, dn] = this._byLane(A);
        for (const [p, ny] of [[up, -1], [dn, 1]]) {
            this._knock(A, p, side * 0.35, ny, 15, 8, { fly: true });
            A.expr(p, 'espantado');
        }
        this._shot = { type: 'split', t0: A.t };
        this.stage.audio?.mood(-6, 6000, 0.3);
    }

    _stepSawSlide(A) {
        const s = this._sawSlide;
        if (!s || A.connected) return;
        const b = A.bounds, saw = A.saw;
        saw.dropX = clamp(saw.dropX + s.vx, b.minX + 40, b.maxX - 40);
        saw.dropY = clamp(saw.dropY + s.vy, b.minY + 40, b.maxY - 40);
        s.vx *= 0.9; s.vy *= 0.9;
        if (Math.abs(s.vx) > 1) A.particles.triggerSparks(saw.dropX, saw.dropY + 12, saw.discRadius * 0.5, -1, 1);
        if (Math.hypot(s.vx, s.vy) < 0.2) this._sawSlide = null;
    }

    // Sozinhos: cada um se vira enquanto o boss ataca um deles.
    _soloHold(A) {
        const B = this.B, s = { x: A.saw.dropX, y: A.saw.dropY };
        const [up, dn] = this._byLane(A);
        for (const [p, y] of [[up, B.y - 230], [dn, B.y + 90]]) {
            const q = this._clampPt(A, lerp(p.x, s.x, 0.3), y);
            this._hold(p, q.x, q.y, 9);
        }
    }

    // Os dois correm até a serra por lados opostos e religam o cabo em cima dela.
    _regroup(A) {
        const s = { x: A.saw.dropX, y: A.saw.dropY };
        const [up, dn] = this._byLane(A);
        for (const [p, dy, lag] of [[up, -60, 0], [dn, 60, 3]]) {
            const go = () => {
                A.dash(p, s.x + rnd(-10, 10), s.y + dy, { steps: 12, maxSpeed: 40, curve: dy > 0 ? 0.6 : -0.6 });
                this._hold(p, s.x, s.y + dy, 9);
            };
            if (lag) this._later(lag, go); else go();
            A.expr(p, 'furia');
        }
        this._shot = { type: 'regroup', t0: A.t };
        this._later(16, () => this._reconnect(A));
    }

    _reconnect(A) {
        this._sawSlide = null;
        A.reconnect();
        A.minSpin = 0.9;
        A.slowmo(0.22, 0.3);
        A.impactFlash = Math.max(A.impactFlash, 0.5);
        A.both(p => { A.hop(p, 5); A.expr(p, 'furia'); });
        this.stage.audio?.mood(0, 20000, 0.2);
        this._shot = { type: 'fight', t0: A.t };
    }

    // --- golpe final: soltam a serra, dão dash nela e ela voa até o boss ---

    _dropSaw(A) {
        const B = this.B;
        A.snap();
        A.minSpin = 0;
        const s = { x: A.saw.dropX, y: A.saw.dropY };
        const away = Math.sign(s.x - B.x) || -1;
        const [up, dn] = this._byLane(A);
        for (const [p, dy] of [[up, -95], [dn, 95]]) {
            const q = this._clampPt(A, s.x + away * 150, s.y + dy);
            this._hold(p, q.x, q.y, 9);
            A.look(p, s.x);
        }
        A.slowmo(0.45, 0.45);
        this._shot = { type: 'saw', t0: A.t };
        this.mode = 'final';
        A.both(p => A.exprFor(p, 'espantado', 0.35));
    }

    // Os dois dão dash ao mesmo tempo contra a serra caída, do lado oposto ao boss.
    _tackle(A) {
        const s = { x: A.saw.dropX, y: A.saw.dropY };
        for (const p of [A.p1, A.p2]) {
            const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1;
            A.dash(p, s.x + dx / d * 34, s.y + dy / d * 34, { steps: 9, maxSpeed: 32 });
            A.expr(p, 'furia');
        }
        this._launchIn = 9;
        this._shot = { type: 'tackle', t0: A.t };
        A.sfx('whoosh', s.x, s.y, { vol: 0.8, rate: 1.1, cool: 0 });
    }

    _launch(A) {
        const s = { x: A.saw.dropX, y: A.saw.dropY };
        const c = this._bossC(-BOSS_H * 0.45);
        const dx = c.x - s.x, dy = c.y - s.y, d = Math.hypot(dx, dy) || 1;
        A.saw.pickup();
        A.saw.spin = 1;
        A.sawVisible = true;
        A.freeSaw = { x: s.x, y: s.y, vx: dx / d * LAUNCH_SPEED, vy: dy / d * LAUNCH_SPEED };
        this._trail = [];
        this.mode = 'launch';
        this._shot = { type: 'launch', t0: A.t };
        // Quadro de impacto: tudo quase para, a serra pisca e os dois recuam.
        A.slowmo(0.3, 0.07);
        A.impactFlash = 0.9;
        A.renderer.triggerShake(32);
        A.renderer.triggerZoomPunch(0.12);
        A.particles.triggerSparkBurst(s.x, s.y, A.saw.discRadius, 34, 2.4);
        A.particles.triggerFlash?.(s.x, s.y, 24, 1.6);
        for (const p of [A.p1, A.p2]) {
            const ox = p.x - s.x, oy = p.y - s.y, od = Math.hypot(ox, oy) || 1;
            this._knock(A, p, ox / od, oy / od, 6, 0);
            p._landT = 9;
            A.expr(p, 'furia');
        }
        const au = this.stage.audio;
        A.sfx('impact', s.x, s.y, { vol: 1, cool: 0 });
        A.sfx('sawHit', s.x, s.y, { vol: 1, rate: 0.8, cool: 0 });
        A.sfx('sawPickup', s.x, s.y, { vol: 0.9, rate: 1.2, cool: 0 });
        A.sfx('whoosh', s.x, s.y, { vol: 0.9, rate: 0.7, cool: 0, delay: 0.1 });
        au?.duck(-10, 0.05, 0.5);
        au?.mood(0, 20000, 0.2);
        au?.excite(1);
    }

    _stepLaunch(A) {
        const f = A.freeSaw;
        if (this.mode !== 'launch' || !f) return;
        this._trail.push({ x: f.x, y: f.y });
        if (this._trail.length > 7) this._trail.shift();
        const c = this._bossC(-BOSS_H * 0.45);
        if (Math.hypot(c.x - f.x, c.y - f.y) < 46) {
            f.x = c.x; f.y = c.y; f.vx = f.vy = 0;
            this._trail = [];
            this._bossHit(A, 8);
            this._impale(A);
        }
    }

    // Corte armado: o acerto sai quando o disco entra no corpo (ou, se a corda desviar, no fim do dash).
    _arm(n, steps) {
        this._armed = { n, left: steps + 10 };
    }

    _discInBody(sp) {
        const B = this.B;
        return Math.abs(sp.x - B.x) < BODY_HALF * 0.75 && sp.y > B.y - BOSS_H * 0.8 && sp.y < B.y + 8;
    }

    _stepArmed(A) {
        const a = this._armed;
        if (!a) return;
        const sp = A.sawPos;
        if (!(A.connected && this._discInBody(sp)) && --a.left > 0) return;
        this._armed = null;
        this._bossHit(A, a.n);
    }

    // A mordida: a dupla trava alguns passos com o disco dentro do boss, que jorra faísca e pedra,
    // e depois termina o dash, levando o disco para fora pelo outro lado.
    _bossHit(A, n) {
        const B = this.B, sp = A.sawPos;
        const pt = {
            x: clamp(sp.x, B.x - BODY_HALF * 0.8, B.x + BODY_HALF * 0.8),
            y: clamp(sp.y, B.y - BOSS_H * 0.75, B.y - 30)
        };
        const dir = Math.sign(A.p1.dashDirX + A.p2.dashDirX) || 1;
        const freeze = n >= 8 ? 0 : 5;
        for (const p of [A.p1, A.p2]) if (p.dashing) p.dashFreeze = freeze;
        this._bite = { left: freeze, dir, n };
        B.hitFlash = 1;
        B.sq = 0.16;
        B.jx = dir * 22;
        A.saw.onHit?.({ blood: false });
        A.saw.spin = 1;
        A.particles.triggerSparkBurst(pt.x, pt.y, 18, 26 + n * 2, 2.6);
        A.particles.triggerLavaDebris?.(pt.x, pt.y, 12 + n, { dirX: dir, dirY: -0.5, groundY: B.y });
        A.particles.triggerFlameBurst(pt.x, pt.y, EMBER_COLOR, { amount: 10, rise: 50, width: 60 });
        A.particles.triggerFlash?.(pt.x, pt.y, 18, 1.4);
        for (let i = 0; i < 14; i++) {
            const a = (dir > 0 ? 0 : Math.PI) + rnd(-1.2, 1.2), s = rnd(5, 14);
            this.fx.ember(pt.x, pt.y, Math.cos(a) * s, Math.sin(a) * s - 2, { size: rnd(3, 7), life: rnd(0.3, 0.7), float: false, drag: 0.92 });
        }
        for (let i = 0; i < 3; i++) {
            const a = (dir > 0 ? 0 : Math.PI) + rnd(-0.9, 0.9) - 0.5, s = rnd(6, 11);
            this.fx.chunk(pt.x, pt.y, Math.cos(a) * s, Math.sin(a) * s, A.renderer.tileset, DEBRIS[(Math.random() * DEBRIS.length) | 0], { size: rnd(16, 26), life: rnd(0.8, 1.2) });
        }
        A.killFlashes.push({ x: pt.x, y: pt.y, life: 1, scale: 2.2 });
        A.sfx('sawHit', pt.x, pt.y, { vol: 1, rate: 1 - 0.03 * n, cool: 0 });
        A.sfx('crack', pt.x, pt.y, { vol: 0.7, rate: 1.2, cool: 0 });
        A.sfx('impact', pt.x, pt.y, { vol: 0.45, rate: 1.4, cool: 0 });
        A.renderer.triggerShake(24 + 3 * n);
        A.renderer.triggerZoomPunch(0.08 + 0.01 * n);
        A.impactFlash = Math.max(A.impactFlash, 0.45);
        A.red = Math.min(1, A.red + 0.15);
        this.cam.kick(pt.x, pt.y, A.t, true);
        this.stage.audio?.excite(0.5);
        A.both(p => A.exprFor(p, n % 2 ? 'furia' : 'raiva', 0.4));
        if (n < 8) A.slowmo(0.1, 0.35);
    }

    // Durante a mordida o disco segue girando dentro dele: chuva de faísca a cada passo.
    _stepBite(A) {
        const b = this._bite;
        if (!b || b.left <= 0) return;
        b.left--;
        const sp = A.sawPos, B = this.B;
        B.jx = b.dir * 10 + rnd(-6, 6);
        B.hitFlash = Math.max(B.hitFlash, 0.7);
        A.particles.triggerSparks(sp.x, sp.y, A.saw.discRadius, A.saw.spinDir, 8);
        A.particles.triggerLavaDebris?.(sp.x, sp.y, 2, { dirX: -b.dir, dirY: -0.6, groundY: B.y });
        this.fx.ember(sp.x, sp.y, -b.dir * rnd(4, 12), rnd(-8, -2), { size: rnd(3, 6), life: rnd(0.3, 0.6), float: false, drag: 0.93 });
        A.renderer.triggerShake(10);
        A.sfx('sawHit', sp.x, sp.y, { vol: 0.5, rate: 1.3, cool: 0.03 });
    }

    // Seguro: se o disco do cabo ficar parado dentro do corpo fora de um corte, ele raspa.
    _stepGrind(A, t) {
        const B = this.B;
        if (!A.connected || this._armed || this._bite?.left > 0 || !B.visible || B.jumpY < -40 || this.mode !== 'fight') return;
        const sp = A.sawPos;
        if (!this._discInBody(sp)) return;
        // Empurra os pontos de espera para fora do boss até o disco sair do corpo.
        const out = Math.sign(A.mid.x - B.x) || 1;
        for (const p of [A.p1, A.p2]) if (p._hold) p._hold.x += out * 9;
        if (((t * 60) | 0) % 3 !== 0) return;
        B.hitFlash = Math.max(B.hitFlash, 0.5);
        B.jx = rnd(-1, 1) * 6;
        A.particles.triggerSparks(sp.x, sp.y, A.saw.discRadius, A.saw.spinDir, 6);
        A.particles.triggerLavaDebris?.(sp.x, sp.y, 1, { groundY: B.y });
        A.renderer.triggerShake(5);
        A.sfx('sawHit', sp.x, sp.y, { vol: 0.4, rate: 1.2, cool: 0.08 });
    }

    _knock(A, p, nx, ny, speed, hurt = 8, opts) { knock(A, p, nx, ny, speed, hurt, opts); }
    _later(steps, fn) { this.queue.later(steps, fn); }
    _stepQueue() { this.queue.step(); }

    // --- loop ---

    _script(A, t) {
        this.events.forEach(([at, fn], i) => {
            if (t >= at && !this._fired.has(i)) { this._fired.add(i); fn(); }
        });
        this.fx.update(1);
        this._stepQueue();
        this._stepHold(A, t);
        this._stepBoss(A, t);
        this._stepArmed(A);
        this._stepBite(A);
        this._stepSawSlide(A);
        if (this._launchIn > 0 && --this._launchIn === 0) this._launch(A);
        this._stepLaunch(A);
        this._stepGrind(A, t);
        this._stepEnding(A, t);
        this._crackRays(A);
        this._stepEmbers(A);
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

    _stepHold(A, t) { stepHold(A, t, this.B.visible ? this.B.x : null); }

    _stepBoss(A, t) {
        const B = this.B;
        if (!B.visible) return;
        const u = t - B.actT;
        B.jx *= 0.75;
        B.sq = (B.sq ?? 0) * 0.8;
        B.hitFlash = Math.max(0, B.hitFlash - STEP * 6);

        if (B.act === 'leap') this._stepLeap(A, u);
        else if (B.act === 'roar') {
            B.row = ANIM.attack2.row;
            B.frame = u < 0.35 ? Math.floor(u / 0.35 * 5) : RAISED;
            B.jx = rnd(-1, 1) * 12;
            if (((t * 60) | 0) % 3 === 0) A.renderer.triggerShake(12);
            if (Math.random() < 0.25) this._ember(A, 1);
            if (u > 0.8) this._idle(B, t);
        } else if (B.act === 'swing') this._stepSwing(A, u);
        else if (B.act === 'stagger') {
            B.row = ANIM.walk.row;
            B.frame = Math.floor(t * 3) % ANIM.walk.frames;
            B.jx = rnd(-1, 1) * 5;
            if (((t * 60) | 0) % 20 === 0) A.renderer.triggerShake(4);
        } else if (B.act === 'impale') {
            B.row = ANIM.attack2.row; B.frame = 2;
            B.crack = clamp01(u / 0.75);
            B.jx = rnd(-1, 1) * (6 + 16 * B.crack);
        } else if (B.act === 'death') {
            B.row = ANIM.death.row;
            B.frame = Math.min(ANIM.death.frames - 1, Math.floor(u * 8));
            B.crack = Math.max(0, 1 - u * 2);
            B.jx = rnd(-1, 1) * 10 * Math.max(0, 1 - u);
        } else this._stepWalk(A, t);
    }

    _idle(B, t) { B.act = 'idle'; B.actT = t; }

    // Parado, ele avança devagar em direção à dupla (pressão de corpo a corpo).
    _stepWalk(A, t) {
        const B = this.B, m = A.mid;
        const dx = m.x - B.x;
        B.faceLeft = dx < 0;
        // Para antes de entrar no cabo: andar para dentro dele deixaria a serra parada no corpo.
        const near = A.connected && Math.abs(A.sawPos.x - B.x) < BODY_HALF + 140;
        const moving = this.mode === 'fight' && Math.abs(dx) > 280 && !near;
        if (moving) B.x += Math.sign(dx) * 0.9;
        B.row = ANIM.walk.row;
        B.frame = moving ? Math.floor(t * 8) % ANIM.walk.frames : 0;
        if (moving && (B.frame === 0 || B.frame === 6) && B.frame !== B.lastStepFrame) {
            A.renderer.triggerShake(3);
            A.sfx('thud', B.x, B.y, { vol: 0.25, rate: 0.6, cool: 0.1 });
        }
        B.lastStepFrame = B.frame;
    }

    _stepLeap(A, u) {
        const B = this.B, L = B.leap;
        B.row = ANIM.attack2.row;
        if (u < L.crouch) {
            B.frame = Math.floor(u / L.crouch * 4);
            B.jumpY = 0;
            B.jx = rnd(-1, 1) * 3;
            return;
        }
        if (u < L.crouch + L.air) {
            if (!L.launched) {
                L.launched = true;
                if (!L.entrance) {
                    A.particles.triggerDust(B.x, B.y, 0, 1, 14);
                    A.renderer.triggerShake(10);
                    A.sfx('whoosh', B.x, B.y, { vol: 0.8, rate: 0.5, cool: 0 });
                    A.sfx('roar', B.x, B.y, { vol: 0.5, rate: 0.9, cool: 0 });
                }
            }
            const k = (u - L.crouch) / L.air;
            B.x = lerp(L.x0, L.x1, k);
            B.y = lerp(L.y0, L.y1, k);
            B.jumpY = -L.h * 4 * k * (1 - k);
            B.frame = RAISED;
            return;
        }
        if (!L.landed) {
            L.landed = true;
            B.x = L.x1; B.y = L.y1; B.jumpY = 0;
            this._onSlam(A, L.entrance, L.separate);
        }
        const k = u - L.crouch - L.air;
        B.frame = Math.min(ANIM.attack2.frames - 1, ANIM.attack2.hitFrame + Math.floor(k / 0.1));
        if (k > 0.45) {
            this._idle(B, A.t);
            if (this._shot.type === 'leap') this._shot = { type: 'fight', t0: A.t };
        }
    }

    _onSlam(A, entrance, separate = false) {
        const B = this.B, au = this.stage.audio;
        A.renderer.triggerShake(entrance ? 42 : 38);
        A.renderer.triggerZoomPunch(0.1);
        A.impactFlash = entrance ? 0.8 : 0.6;
        A.slowmo(0.28, 0.3);
        A.red = Math.max(A.red, 0.7);
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            A.particles.triggerDust(B.x + Math.cos(a) * 70, B.y + Math.sin(a) * 22, Math.cos(a), Math.sin(a) * 0.4, 8);
        }
        A.particles.triggerLavaDebris?.(B.x, B.y, 22, { groundY: B.y });
        A.particles.triggerFlameBurst(B.x, B.y - 20, EMBER_COLOR, { amount: 10, rise: 50, width: 160 });
        A.sfx('impact', B.x, B.y, { vol: 1, cool: 0 });
        A.sfx('crack', B.x, B.y, { vol: 0.9, rate: 0.8, cool: 0 });
        A.sfx('boom', B.x, B.y, { vol: 0.6, rate: 0.55, cool: 0 });
        au?.duck(-12, 0.06, 0.55);
        au?.excite(1);
        A.exprFor(A.p1, 'olhos_fechados', 0.25);
        if (separate) { this._separate(A); return; }
        const range = entrance ? 700 : 460;
        for (const p of [A.p1, A.p2]) {
            const dx = p.x - B.x, dy = (p.y - B.y) * 1.6, d = Math.hypot(dx, dy) || 1;
            if (d > range) continue;
            this._knock(A, p, dx / d, dy / d * 0.6, entrance ? 4 : 9, 6);
            A.expr(p, 'espantado');
        }
    }

    _stepSwing(A, u) {
        const B = this.B, S = B.swing;
        B.row = ANIM.attack.row;
        const W = SWING.windup, H = SWING.hold;
        if (u < W) {
            B.frame = Math.floor(u / W * 5);
            B.x = lerp(S.x0, S.tx, easeOut(u / W));
            if (!S.stepped && u > W * 0.5) {
                S.stepped = true;
                A.renderer.triggerShake(5);
                A.sfx('thud', B.x, B.y, { vol: 0.4, rate: 0.6, cool: 0 });
            }
            return;
        }
        if (u < W + H) {
            B.frame = 5;
            B.jx = rnd(-1, 1) * 4;
            return;
        }
        if (!S.hit) { S.hit = true; this._onSwing(A); }
        B.frame = Math.min(ANIM.attack.frames - 1, ANIM.attack.hitFrame + Math.floor((u - W - H) / 0.1));
        if (u > W + H + SWING.recover) this._idle(B, A.t);
    }

    _onSwing(A) {
        const B = this.B, S = B.swing;
        const hc = { x: B.x + S.face * SWING.reach, y: B.y - 30 };
        A.renderer.triggerShake(18);
        A.renderer.triggerZoomPunch(0.04);
        for (let i = 0; i < 6; i++) A.particles.triggerDust(hc.x + rnd(-40, 40), hc.y + rnd(0, 30), S.face, rnd(-0.5, 0.5), 7);
        A.particles.triggerLavaDebris?.(hc.x, B.y, 8, { dirX: S.face, dirY: -0.3, groundY: B.y });
        A.sfx('whoosh', hc.x, hc.y, { vol: 0.9, rate: 0.55, cool: 0 });
        A.sfx('impact', hc.x, hc.y, { vol: 0.5, rate: 1.3, cool: 0 });
        A.sfx('thud', hc.x, hc.y, { vol: 0.7, rate: 0.7, cool: 0 });
        const victims = S.target ? [S.target]
            : [A.p1, A.p2].filter(p => Math.hypot(p.x - hc.x, p.y - hc.y) < SWING.radius && !p.dashing);
        for (const p of victims) {
            const dx = p.x - B.x, dy = p.y - B.y, d = Math.hypot(dx, dy) || 1;
            this._knock(A, p, S.face * 0.9 + dx / d * 0.1, dy / d * 0.5, 14, 10, { fly: true });
            A.exprFor(p, 'olhos_fechados', 0.3);
            A.expr(p, 'raiva');
            A.renderer.triggerShake(30);
            A.renderer.triggerZoomPunch(0.08);
            A.impactFlash = Math.max(A.impactFlash, 0.5);
            A.red = 1;
            A.slowmo(0.22, 0.25);
            A.particles.triggerDust(p.x, p.y + 10, S.face, 0, 14);
            A.particles.triggerSparkBurst(p.x, p.y - 10, 10, 10, 1.6);
            A.sfx('thud', p.x, p.y, { vol: 1, rate: 1.1, cool: 0 });
            A.sfx('impact', p.x, p.y, { vol: 0.7, rate: 1.2, cool: 0 });
            this.cam.kick(p.x, p.y, A.t, true, -this.cam.dutch);
            this._shot = { type: 'player', t0: A.t, target: p, until: A.t + 0.5 };
        }
        if (S.target) A.expr(S.target === A.p1 ? A.p2 : A.p1, 'furia');
    }

    _ember(A, n = 1) {
        const B = this.B;
        for (let i = 0; i < n; i++) {
            A.particles.triggerFlameBurst(B.x + rnd(-1, 1) * BODY_HALF * 1.2, B.y - BOSS_H * 0.8 + B.jumpY,
                EMBER_COLOR, { amount: 2, rise: 70, width: 70 });
        }
    }

    // Brasas subindo dos ombros, no ritmo do jogo (FLAME_GOLEM.embers.perSecond = 7).
    _stepEmbers(A) {
        if (!this.B.visible || this.B.act === 'death') return;
        this._embAcc += 7 * STEP;
        while (this._embAcc >= 1) { this._embAcc -= 1; this._ember(A, 1); }
    }

    // --- final: o golpe que racha o boss, a explosão e o salto ---

    _impale(A) {
        const B = this.B;
        this.mode = 'impale';
        B.act = 'impale'; B.actT = A.t;
        A.slowmo(0.7, 0.18);
        A.impactFlash = 1;
        A.renderer.triggerShake(40);
        A.renderer.triggerZoomPunch(0.12);
        A.sfx('impact', B.x, B.y, { vol: 1, cool: 0 });
        A.sfx('crack', B.x, B.y, { vol: 1, rate: 0.7, cool: 0 });
        this.stage.audio?.mood(-4, 3500, 0.25);
        A.both(p => { A.expr(p, 'furia'); p.shiver = 0.3; });
    }

    _stepEnding(A, t) {
        const B = this.B;
        if (this.mode === 'impale') {
            const u = t - B.actT;
            if (((t * 60) | 0) % 2 === 0) {
                const c = this._bossC(-BOSS_H * 0.45);
                A.particles.triggerSparkBurst(c.x, c.y, 10, 7, 2);
                for (let i = 0; i < 4; i++) {
                    const a = rnd(0, Math.PI * 2), s = rnd(4, 11);
                    this.fx.ember(c.x, c.y, Math.cos(a) * s, Math.sin(a) * s - 2, { size: rnd(3, 7), life: rnd(0.3, 0.8) });
                }
                A.renderer.triggerShake(8 + 22 * B.crack);
                A.sfx('crack', c.x, c.y, { vol: 0.4 + 0.4 * B.crack, rate: 0.9 + 0.4 * B.crack, cool: 0.12 });
            }
            if (u >= 0.75) this._death(A);
        } else if (this.mode === 'blown') {
            if (t - B.actT > 0.3) this._leapPending = true;
            if (!this._slowLeap && t - B.actT > 0.22) { this._slowLeap = true; A.slowmo(999, 0.12); }
        }
    }

    _death(A) {
        const B = this.B, t = A.t;
        this.mode = 'blown';
        B.act = 'death'; B.actT = t;
        A.impactFlash = 1;
        A.renderer.triggerShake(60);
        A.renderer.triggerZoomPunch(-0.1);
        A.red = 1;
        const au = this.stage.audio;
        A.sfx('boom', B.x, B.y, { vol: 1, rate: 0.6, cool: 0 });
        A.sfx('impact', B.x, B.y, { vol: 1, rate: 0.8, cool: 0 });
        A.sfx('roar', B.x, B.y, { vol: 0.7, rate: 0.55, cool: 0 });
        au?.duck(-14, 0.1, 0.9);
        au?.excite(1);
        const c = this._bossC(-BOSS_H * 0.45);
        this.fx.blast(c.x, c.y, 3.2, A.renderer.tileset, DEBRIS);
        A.particles.triggerLavaDebris?.(c.x, c.y, 60, { groundY: B.y });
        A.killFlashes.push({ x: c.x, y: c.y, life: 1, scale: 9 });
        const r = A.renderer, W = A.canvas.width, H = A.canvas.height;
        const hw = W / (2 * r.zoom), hh = H / (2 * r.zoom);
        for (let i = 0; i < 14; i++) {
            this.blasts.push({
                at: t + 0.04 + i * 0.045,
                x: r.camX + rnd(-0.95, 0.95) * hw, y: clamp(r.camY + rnd(-0.85, 0.85) * hh, 40, 800),
                power: rnd(1.0, 1.9)
            });
        }
        A.both(p => { A.hop(p, 9); A.expr(p, 'furia'); });
    }

    audioState(s) {
        const B = this.B, lt = this.leapLT;
        const calmRumble = this.mode === 'calm' ? 0.12 + 0.35 * Math.min(1, this.arena.t / 0.8) : 0;
        const o = { rumble: calmRumble + (B?.visible ? 0.18 : 0) };
        if (lt >= 0) {
            o.players = null;
            o.saw = { visible: true, spin: lt < FREEZE_AT ? 1 : 0.55, scale: 1.4 };
            o.slow = lt > TITLE_AT ? 1 : s.slow;
            o.rumble = 0;
        }
        return o;
    }

    // --- câmera: vai e volta, chicoteia nos cortes, abre no salto, fecha no golpe ---

    _camera(A, t) {
        const B = this.B, m = A.mid, { p1, p2 } = A;
        const bc = this._bossC();
        const head = { x: B.x, y: B.y - BOSS_H + B.jumpY }, feet = { x: B.x, y: B.y };
        const sh = this.cam.current(t);

        const face = B.faceLeft ? -1 : 1;
        const u = t - sh.t0;
        const chest = this._bossC(-BOSS_H * 0.55);
        let o;
        if (this.mode === 'impale') {
            // Golpe final: empurra devagar até o peito rachando.
            const k = easeOut(clamp01((t - B.actT) / 0.7));
            o = { x: chest.x, y: chest.y, zoom: lerp(2.0, 2.6, k), rot: -0.08 * face * k, k: 0.14 };
        } else if (this.mode === 'blown') {
            o = { x: chest.x, y: chest.y + 20, zoom: 1.7, rot: 0, k: 0.1 };
        } else if (sh.type === 'intro') {
            // Plano com a dupla, que abre quando o boss cai do alto.
            const fit = B.visible ? [p1, p2, head, feet] : [p1, p2];
            o = { x: B.visible ? lerp(m.x, bc.x, 0.5) : m.x + 140, y: lerp(m.y, bc.y, 0.4), zoom: B.visible ? 1.3 : 1.7, rot: 0.04, k: 0.12, fit, pad: 90 };
        } else if (sh.type === 'boss') {
            // Rugido: zoom contínuo até o rosto, com leve inclinação.
            const k = easeOut(clamp01(u / 0.7));
            o = { x: head.x - face * 20, y: lerp(bc.y, head.y + BOSS_H * 0.25, k), zoom: lerp(1.6, 2.7, k), rot: -0.09 * k, k: 0.14 };
        } else if (sh.type === 'cut') {
            // Persegue o disco até o boss; o tranco do acerto vem do `cam.kick`.
            const sp = A.sawPos;
            o = { x: lerp(sp.x, chest.x, 0.45), y: lerp(sp.y, chest.y, 0.4), zoom: 1.85, rot: 0.1 * this._dutch, k: 0.2, fit: [p1, p2], pad: 50 };
        } else if (sh.type === 'swing') {
            // Soco: fecha no tronco do boss enquanto ele arma o golpe.
            const k = easeInOut(clamp01(u / SWING.windup));
            o = { x: lerp(bc.x, B.x + face * SWING.reach * 0.6, k), y: chest.y, zoom: lerp(1.7, 2.3, k), rot: 0.08 * face * k, k: 0.16 };
        } else if (sh.type === 'leap') {
            // Salto: abre o suficiente para ver ele no alto e a dupla embaixo.
            const L = B.leap;
            const top = { x: B.x, y: B.y - BOSS_H + Math.max(B.jumpY, -180) };
            o = { x: lerp(m.x, L.x1, 0.5), y: lerp(m.y, top.y, 0.45), zoom: 1.2, rot: 0, k: 0.12, fit: [p1, p2, top, { x: L.x1, y: L.y1 }], pad: 70 };
        } else if (sh.type === 'split') {
            // Separados: abre para mostrar os dois jogados longe e a serra deslizando.
            const s = { x: A.saw.dropX, y: A.saw.dropY };
            const k = easeOut(clamp01(u / 0.4));
            o = { x: lerp(bc.x, s.x, 0.3), y: lerp(bc.y, m.y, 0.5), zoom: lerp(1.9, 1.35, k), rot: 0.1 * (1 - k), k: 0.14, fit: [p1, p2, s, head], pad: 50 };
        } else if (sh.type === 'regroup') {
            const s = A.connected ? A.sawPos : { x: A.saw.dropX, y: A.saw.dropY };
            o = { x: s.x, y: s.y - 20, zoom: 2.1, rot: -0.08, k: 0.18, fit: [p1, p2], pad: 40 };
        } else if (sh.type === 'player') {
            // Jogador atingido: acompanha o voo dele com o boss ainda no quadro.
            const tp = sh.target;
            o = { x: lerp(tp.x, bc.x, 0.35), y: lerp(tp.y - 30, bc.y, 0.25), zoom: 1.95, rot: 0.12 * this._dutch, k: 0.22, fit: [tp, chest], pad: 60 };
        } else if (sh.type === 'final') {
            // Boss cambaleando: travelling lento de perto.
            const k = easeInOut(clamp01(u / 1.2));
            o = { x: lerp(bc.x, m.x, 0.35 * k), y: lerp(chest.y, m.y, 0.3 * k), zoom: lerp(2.2, 1.6, k), rot: -0.1 * face * (1 - k), k: 0.08 };
        } else if (sh.type === 'saw') {
            // Serra caída no chão: close nela, a dupla entra pelas bordas.
            const s = { x: A.saw.dropX, y: A.saw.dropY };
            const k = easeOut(clamp01(u / 0.5));
            o = { x: lerp(s.x, m.x, 0.3), y: s.y - 20, zoom: lerp(1.9, 2.4, k), rot: 0.12 * k, k: 0.16, fit: [p1, p2, s], pad: 40 };
        } else if (sh.type === 'tackle') {
            const s = { x: A.saw.dropX, y: A.saw.dropY };
            o = { x: s.x, y: s.y - 20, zoom: 2.4, rot: -0.1, k: 0.25, fit: [p1, p2], pad: 40 };
        } else if (sh.type === 'launch') {
            // A câmera corre atrás da serra lançada.
            const f = A.freeSaw ?? chest;
            o = { x: lerp(f.x, chest.x, 0.3), y: lerp(f.y, chest.y, 0.3), zoom: 2.2, rot: 0.06 * face, k: 0.28 };
        } else {
            // Plano de luta: perto, com o zoom indo e voltando.
            const breathe = 0.28 * Math.sin(u * 2.4);
            const lead = { x: (p1.vx + p2.vx) * 6, y: (p1.vy + p2.vy) * 3 };
            o = {
                x: lerp(m.x, bc.x, 0.45) + lead.x, y: clamp(lerp(m.y, bc.y, 0.4) + lead.y, 200, 420),
                zoom: 1.7 + breathe, rot: 0.08 * Math.sin(u * 0.9), k: 0.1,
                fit: [p1, p2, head], pad: 40
            };
        }
        this.cam.frame(A, t, o);
    }

    // Raios de rachadura: aparecem só quando ele está sendo destruído (golpe final e morte).
    _crackRays(A) {
        const B = this.B, t = A.t;
        if (!B.visible || B.crack <= 0.01) { this.fx.rays = []; return; }
        const c = this._bossC(-BOSS_H * 0.45);
        const cx = c.x + B.jx;
        const rays = [];
        for (let i = 0; i < RAYS; i++) {
            const vary = 0.6 + 0.4 * (((i * 37) % 10) / 10);
            rays.push({
                x: cx, y: c.y,
                ang: i * 2.39996 + 0.3 + t * 0.12 * (i % 2 ? 1 : -1),
                len: (8 + 26 * B.crack) * BS * vary * (0.92 + 0.08 * Math.sin(t * 7 + i)),
                wid: (1.6 + 2.6 * B.crack) * BS * (0.7 + 0.3 * vary),
                heat: clamp01(B.crack * 1.4) * (0.85 + 0.15 * Math.sin(t * 11 + i * 1.7))
            });
        }
        this.fx.rays = rays;
    }

    _tickScreenEmbers(dt) {
        const W = this.stage.canvas.width, H = this.stage.canvas.height;
        const base = this.stage.refSize;
        this._embAcc += dt * 60;
        const steps = Math.floor(this._embAcc);
        this._embAcc -= steps;
        for (let i = 0; i < steps; i++) {
            this.fxScreen.ember(rnd(0, W), H * rnd(0.85, 1.0), rnd(-1.5, 1.5), rnd(-5, -2),
                { size: rnd(3, 8) * base / 900, life: rnd(1.2, 2.4) });
        }
        this.fxScreen.update(steps);
    }

    // --- desenho ---

    _frameSrc() {
        const B = this.B;
        return { sx: B.frame * SP.cellSize + SP.cropX, sy: B.row * SP.cellSize + SP.cropY };
    }

    _drawFrame(ctx, img) {
        const B = this.B, { sx, sy } = this._frameSrc();
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.translate(Math.round(B.x + B.jx), Math.round(B.y + B.jumpY));
        if (B.faceLeft) ctx.scale(-1, 1);
        // Achatamento no acerto (mantém o volume: alarga e baixa).
        const sq = B.sq ?? 0;
        ctx.scale(BS * (1 + sq), BS * (1 - sq));
        if (img === this.bossImg) ctx.drawImage(img, sx, sy, SP.cropW, SP.cropH, DX, DY, SP.cropW, SP.cropH);
        else ctx.drawImage(img, 0, 0, SP.cropW, SP.cropH, DX, DY, SP.cropW, SP.cropH);
        ctx.restore();
    }

    // Sprite ordenado por Y junto com os jogadores (passa na frente/atrás deles).
    _drawBossSprite(ctx) {
        const img = this.bossImg;
        if (!img || !img.complete || !img.naturalWidth) return;
        this._drawFrame(ctx, img);
    }

    _drawBossShadow(ctx) {
        const B = this.B;
        if (!B.visible) return;
        const lift = clamp01(-B.jumpY / 500);
        const rx = SP.body.w * BS * 0.62 * (1 - 0.35 * lift), ry = rx * 0.34;
        const a = 0.6 * (1 - 0.5 * lift);
        ctx.save();
        ctx.translate(B.x, B.y - 6);
        ctx.scale(1, ry / rx);
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
        g.addColorStop(0, `rgba(0, 0, 0, ${a})`);
        g.addColorStop(0.6, `rgba(0, 0, 0, ${a * 0.55})`);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Silhueta pintada (cacheada por quadro): branca no acerto, brasa quando racha no fim.
    _tinted(color) {
        const B = this.B, key = `${color}|${B.row}|${B.frame}`;
        let c = this._white.get(key);
        if (c) return c;
        const img = this.bossImg, { sx, sy } = this._frameSrc();
        c = document.createElement('canvas');
        c.width = SP.cropW; c.height = SP.cropH;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.drawImage(img, sx, sy, SP.cropW, SP.cropH, 0, 0, SP.cropW, SP.cropH);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = color;
        g.fillRect(0, 0, c.width, c.height);
        this._white.set(key, c);
        return c;
    }

    _drawBossFlash(ctx) {
        const B = this.B, img = this.bossImg;
        if (!B.visible || !img || !img.complete || !img.naturalWidth) return;
        if (B.hitFlash > 0.01) {
            ctx.save();
            ctx.globalAlpha = 0.9 * B.hitFlash;
            this._drawFrame(ctx, this._tinted('#ffffff'));
            ctx.restore();
        }
        if (B.crack > 0.01) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.globalAlpha = clamp01(B.crack * 0.75 * (0.75 + 0.25 * Math.sin(this.arena.t * 14)));
            this._drawFrame(ctx, this._tinted('#ff9a4a'));
            ctx.restore();
        }
    }

    // Rastro da serra lançada: cópias do disco girando, cada vez mais fracas.
    _drawSawTrail(ctx, A) {
        const img = A.saw.sprite, tr = this._trail;
        if (!tr?.length || !img || !img.complete || !img.naturalWidth) return;
        const R = A.saw.discRadius;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        tr.forEach((q, i) => {
            const k = (i + 1) / (tr.length + 1);
            ctx.globalAlpha = 0.45 * k;
            ctx.save();
            ctx.translate(Math.round(q.x), Math.round(q.y));
            ctx.rotate(-(A.saw.rotation + i * 0.5));
            ctx.drawImage(img, 0, 32, 16, 16, -R, -R, R * 2, R * 2);
            ctx.restore();
        });
        ctx.restore();
    }

    _lights(A, pp, ws, pix) {
        const B = this.B;
        if (!B.visible) return;
        const c = this._bossC(-BOSS_H * 0.55);
        const s = ws(c.x, c.y);
        pp.addLight(s.x, s.y, (520 + 220 * B.hitFlash) * s.zoom, pix(s.zoom, 1.4), 0.9, BOSS_LIGHT);
        if (B.crack > 0.01) pp.addLight(s.x, s.y, (220 + 520 * B.crack) * s.zoom, pix(s.zoom), 1, CRACK_LIGHT);
    }

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
        const portrait = this.stage.portrait, base = this.stage.refSize;
        this.fxScreen.pixel = Math.max(2, Math.round(base * 0.42 / 23));
        this.fxScreen.draw(ctx);

        const grow = lt > 1.8 ? Math.min(lt, FREEZE_AT) - 1.8 : 0;
        const hFrac = lerp(0.1, portrait ? 0.4 : 0.42, e) + grow * 0.01;
        const sc = hFrac * base / 73;
        const y = portrait
            ? H * (lerp(0.5, 0.485, e) - 0.05 * Math.sin(Math.PI * u))
            : H * (lerp(0.5, 0.6, e) - 0.08 * Math.sin(Math.PI * u));
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

        const sdx = saw.dragX, sdy = saw.dragY;
        saw.dragX = 0; saw.dragY = 17;
        const a = { x: x1 / sc + 8, y: y1 / sc + 6 }, b = { x: x2 / sc - 8, y: y2 / sc + 6 };
        ctx.save();
        ctx.scale(sc, sc);
        saw.drawChain(ctx, a, b);
        const mid = saw.cablePoint(a, b, 0.5);
        ctx.restore();
        saw.dragX = sdx; saw.dragY = sdy;

        const pose = (p, x, y, rot, faceLeft) => {
            const keep = { x: p.x, y: p.y, tilt: p.tilt, vx: p.vx, vy: p.vy, walkFrame: p.walkFrame, bobPhase: p.bobPhase,
                facingLeft: p.facingLeft, expression: p.expression, hurtTimer: p.hurtTimer, invulnerableTimer: p.invulnerableTimer,
                dashing: p.dashing, _landT: p._landT, _dashFlashT: p._dashFlashT, afterimages: p.afterimages };
            Object.assign(p, { x: 0, y: 0, tilt: rot, vx: 0, vy: -0.3, walkFrame: 4, bobPhase: 0,
                facingLeft: faceLeft, expression: 'furia', hurtTimer: 0, invulnerableTimer: 0,
                dashing: false, _landT: 0, _dashFlashT: 0, afterimages: [] });
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
        const fl = 1 - clamp01(lt / 0.35);
        if (fl > 0) {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = `rgba(255, 240, 220, ${0.8 * fl * fl})`;
            ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();

        if (lt > TITLE_AT) {
            const ta = easeInOut(clamp01((lt - TITLE_AT) / 0.5));
            const logo = this.stage.logo, ls = this.stage.logoScale();
            const lw = (logo?.naturalWidth || 113) * (ls || 4);
            const lh = (logo?.naturalHeight || 41) * (ls || 4);
            const R2 = lw * 0.7;
            const cy = this.logoCy;
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.translate(W / 2, cy + 6);
            ctx.scale(1, (lh * 1.1) / R2);
            const dg = ctx.createRadialGradient(0, 0, 0, 0, 0, R2);
            dg.addColorStop(0, `rgba(10, 2, 4, ${0.7 * ta})`);
            dg.addColorStop(0.6, `rgba(10, 2, 4, ${0.4 * ta})`);
            dg.addColorStop(1, 'rgba(10, 2, 4, 0)');
            ctx.fillStyle = dg;
            ctx.fillRect(-R2, -R2, R2 * 2, R2 * 2);
            ctx.restore();
            this.stage.drawTitleLogo(0, ta, cy);
        }
    }
}
