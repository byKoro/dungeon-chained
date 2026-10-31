import { RushShot, dressRoom } from '../../kit/rushKit.js';
import { ActionQueue, ShotCamera, bite, knock, hold, stepHold } from '../../kit/fightKit.js';
import { TrailerScrap } from '../../kit/scrapKit.js';
import { lerp, clamp01, easeOut } from '../../anim.js';

// Luta em grupo, sem dash: a horda entra pela porta e a dupla avança junta com o cabo esticado,
// varrendo fileiras. No meio da horda o cabo vira mangual e a serra varre um arco largo, um
// monstro acerta o vermelho e o azul o puxa de volta pelo cabo, e eles avançam de novo.
// Cada morte morde e solta moedas; o contador sobe no topo da tela.

const STEP = 1 / 60;
const COLS = 22, ROWS = 13;
const ROPE = 250;
const LANE = 95;
// Fim pelo relógio da arena (a câmera lenta estica tudo), com teto em tempo real.
const END_ARENA = 6.2, END_REAL = 8.5;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class FrenzyShot extends RushShot {
    constructor(stage) {
        super(stage, { cols: COLS, rows: ROWS, doors: { E: true, W: true }, seed: 11, ropeLen: ROPE, ambient: '44, 30, 40' }, END_REAL);
        this.cutIn = null;
        this.cam = new ShotCamera(stage);
        this.queue = new ActionQueue();
        this.scrap = new TrailerScrap(stage);
    }

    get isDone() { return this.t >= this.duration || (this.arena.t >= END_ARENA && this.phase === 'charge2'); }

    render() {
        super.render();
        this.scrap.drawHud(this.stage.ctx, this.stage.canvas);
    }

    setup(A) {
        const { p1, p2 } = A;
        const S = this;
        this.cam.reset('charge');
        this.queue.clear();
        this.scrap.reset(A, 0);
        this._kills = [];
        this._spawned = 0;
        this._dir = 1;
        this._flail = null;
        this._brute = null;
        this.phaseT = 0;

        A.ropeLen = ROPE;
        A.minSpin = 1; A.saw.spin = 1;
        A.red = 0.35; A.redHz = 1.6;
        dressRoom(A, { seed: 11, crates: 3, rubble: 14, loot: 2, banners: 3, blood: 18 });

        const cy = A.center.y;
        A.initPlayer(p1, 470, cy - LANE);
        A.initPlayer(p2, 470, cy + LANE);
        A.both(p => { p.accel = 0.16; p.wobble = 0.25; A.expr(p, 'furia'); });

        // Primeira leva no caminho do disco; o resto entra pela porta leste e corre até eles.
        for (let i = 0; i < 10; i++) this._spawn(A, 760 + (i % 4) * 95 + rnd(-20, 20), cy + ((i * 53) % 170) - 85, false);
        this.door = { x: A.bounds.maxX, y: cy };

        A.onKill = (e) => S._onKill(A, e);
        A.onDrawFloor = (ctx) => S.scrap.drawFloor(ctx);
        A.onDrawOver = (ctx) => S.scrap.drawOver(ctx);
        A.script = (t) => S._script(A, t);

        this._phase(A, 'charge1');
        A.snapCamera(p1.x + 140, cy, 2.0 * A.zoomRef, 0.06);
    }

    _spawn(A, x, y, entering = true, type = null) {
        const e = A.spawnEnemy(x, y, type ?? (this._spawned % 3 === 2 ? 'bloodMonster' : 'demon'), {
            speed: rnd(2.6, 3.3), chase: A.midTarget, stopDist: 0, entering
        });
        this._spawned++;
        return e;
    }

    // Fases encadeadas: cada uma começa quando a anterior termina (não por tempo fixo).
    _phase(A, name) {
        const { p1, p2 } = A;
        this.phase = name;
        this.phaseT = A.t;
        if (name === 'charge1' || name === 'charge2') {
            this._dir = 1;
            this._speed = name === 'charge1' ? 6.4 : 7.2;
            A.both(p => { p._scripted = true; p.accel = 0.14; A.expr(p, 'furia'); A.hop(p, 3.5); });
            this.cam.set('charge', A.t);
            A.sfx('whoosh', A.mid.x, A.mid.y, { vol: 0.5, rate: 1.1, cool: 0 });
        } else if (name === 'flail') {
            // O vermelho finca o pé e o azul gira em volta dele: o cabo vira um mangual.
            hold(p1, p1.x, p1.y, 3);
            p1._scripted = false;
            this._flail = { a: Math.atan2(p2.y - p1.y, p2.x - p1.x) };
            p2._scripted = true;
            p2.accel = 0.4;
            A.exprFor(p1, 'furia', 0.8);
            A.expr(p2, 'furia');
            this.cam.set('flail', A.t);
            A.sfx('rope', p1.x, p1.y, { vol: 0.9, rate: 0.9, cool: 0 });
            A.sfx('whoosh', p2.x, p2.y, { vol: 0.8, rate: 0.7, cool: 0 });
            A.renderer.triggerShake(12);
        } else if (name === 'brute') {
            this._flail = null;
            p2._scripted = false;
            hold(p2, p2.x, p2.y);
            this._bruteIn(A);
        } else if (name === 'pull') {
            this._pullBack(A);
        } else if (name === 'regroup') {
            const c = A.center.y, x = clamp(A.mid.x - 160, A.bounds.minX + 120, A.bounds.maxX - 400);
            hold(p1, x, c - LANE, 10);
            hold(p2, x, c + LANE, 10);
            A.both(p => A.expr(p, 'furia'));
            this.cam.set('fight', A.t);
        }
    }

    // Um monstro grande salta de trás do vermelho, longe do disco, e o acerta em cheio.
    _bruteIn(A) {
        const { p1, p2 } = A;
        const away = { x: p1.x - p2.x, y: p1.y - p2.y }, d = Math.hypot(away.x, away.y) || 1;
        const x = clamp(p1.x + away.x / d * 110, A.bounds.minX + 40, A.bounds.maxX - 40);
        const y = clamp(p1.y + away.y / d * 110, A.bounds.minY + 40, A.bounds.maxY - 40);
        const e = A.spawnEnemy(x, y, 'bloodMonster', { speed: 0, lookAt: p1, intro: true });
        this._brute = e;
        A.exprFor(p1, 'espantado', 0.5);
        this.cam.set('hurt', A.t);
        this.queue.later(14, () => {
            if (e.state === 'dying') return;
            A.lunge(e, p1.x, p1.y, 6);
            this.queue.later(5, () => this._bruteHit(A, e));
        });
    }

    _bruteHit(A, e) {
        const p1 = A.p1;
        const dx = p1.x - e.x, dy = p1.y - e.y, d = Math.hypot(dx, dy) || 1;
        knock(A, p1, dx / d, dy / d, 13, 26, { fly: true });
        A.exprFor(p1, 'olhos_fechados', 0.3);
        A.expr(p1, 'raiva');
        A.renderer.triggerShake(28);
        A.renderer.triggerZoomPunch(0.08);
        A.impactFlash = Math.max(A.impactFlash, 0.5);
        A.red = 1;
        A.slowmo(0.2, 0.25);
        A.particles.triggerBlood(p1.x, p1.y - 10, 10, 1);
        A.particles.triggerDust(p1.x, p1.y + 12, dx / d, 0, 12);
        A.sfx('thud', p1.x, p1.y, { vol: 1, rate: 1.1, cool: 0 });
        A.sfx('impact', p1.x, p1.y, { vol: 0.7, rate: 1.2, cool: 0 });
        this.cam.kick(p1.x, p1.y, A.t, true);
        this.queue.later(14, () => this._phase(A, 'pull'));
    }

    // O azul corre para o lado oposto: o cabo estica e traz o vermelho de volta.
    _pullBack(A) {
        const { p1, p2 } = A;
        const dx = p2.x - p1.x, dy = p2.y - p1.y, d = Math.hypot(dx, dy) || 1;
        hold(p2, clamp(p2.x + dx / d * 170, A.bounds.minX + 60, A.bounds.maxX - 60), clamp(p2.y + dy / d * 110, A.bounds.minY + 60, A.bounds.maxY - 60), 10);
        A.expr(p2, 'furia');
        A.hop(p2, 4);
        A.sfx('rope', A.mid.x, A.mid.y, { vol: 0.8, rate: 1.1, cool: 0 });
    }

    // Cada morte: mordida pequena e moedas saltando; três ou mais seguidas dão tranco e câmera lenta.
    _onKill(A, e) {
        const t = A.t;
        this._kills = this._kills.filter(k => t - k < 0.35);
        this._kills.push(t);
        const combo = this._kills.length >= 3;
        bite(A, this.cam, { x: e.x, y: e.y - 10, dir: Math.sign(e.x - A.mid.x) || 1, tier: combo ? 'medium' : 'small', slow: false });
        this.scrap.burst(e.x, e.y, e.typeKey === 'bloodMonster' ? 4 : 2);
        if (this._kills.length === 3) {
            A.slowmo(0.12, 0.3);
            A.sfx('impact', e.x, e.y, { vol: 0.5, rate: 1.3, cool: 0.1 });
            A.both(p => A.exprFor(p, 'furia', 0.4));
        }
    }

    _script(A, t) {
        this.queue.step();
        const { p1, p2 } = A;
        const cy = A.center.y, b = A.bounds, u = t - this.phaseT;

        // Horda entrando pela porta (as primeiras já correndo até a dupla).
        if (t < 5.4 && ((t * 60) | 0) % 9 === 0 && A.enemies.filter(e => e.state !== 'dying').length < 18) {
            this._spawn(A, this.door.x + rnd(30, 110), this.door.y + rnd(-70, 70));
        }

        if (this.phase === 'charge1' || this.phase === 'charge2') {
            const lead = this._dir * this._speed;
            for (const [p, lane] of [[p1, -LANE], [p2, LANE]]) {
                p.goal = { vx: lead, vy: 0, holdY: cy + lane + Math.sin(t * 3 + lane) * 18 };
                p.faceX = p.x + this._dir * 200;
            }
            const end = A.mid.x > b.maxX - (this.phase === 'charge1' ? 330 : 200);
            if (end) {
                A.both(p => { p._scripted = false; hold(p, p.x, p.y); });
                if (this.phase === 'charge1') this._phase(A, 'flail');
                else this.phase = 'charge2-done';
            }
        } else if (this.phase === 'flail' && this._flail) {
            const F = this._flail;
            F.a -= STEP * (5.4 + 2 * clamp01(u / 0.3));
            const r = ROPE * 0.92;
            p2.goal = { follow: true, x: p1.x + Math.cos(F.a) * r, y: p1.y + Math.sin(F.a) * r * 0.8, gain: 0.55, max: 24 };
            if (((t * 60) | 0) % 6 === 0) A.renderer.triggerShake(5);
            if (u > 0.95) this._phase(A, 'brute');
        } else if (this.phase === 'pull' && u > 0.35) {
            this._phase(A, 'regroup');
        } else if (this.phase === 'regroup' && u > 0.3) {
            this._phase(A, 'charge2');
        }
        if (this.phase === 'charge2-done') this.phase = 'charge2';
        // Moedas saltam, quicam e (depois do pouso) voam até a dupla: o contador sobe junto com as mortes.
        this.scrap.vacuum();

        stepHold(A, t, null);
        for (const e of A.enemies) {
            if (e.state === 'dying' || e === this._brute || e._lunged) continue;
            if (Math.hypot(e.x - A.mid.x, e.y - A.mid.y) < 150) { e._lunged = true; A.lunge(e, A.mid.x, A.mid.y, 4); }
        }
        this.scrap.update();
        this._camera(A, t);
    }

    _camera(A, t) {
        const { p1, p2 } = A, m = A.mid;
        const sh = this.cam.current(t, 'fight');
        const u = t - sh.t0;
        let o;
        if (sh.type === 'charge') {
            o = { x: m.x + this._dir * 150, y: m.y - 10, zoom: 1.75 + 0.15 * Math.sin(u * 3), rot: 0.06 * this._dir, k: 0.14, fit: [p1, p2], pad: 70 };
        } else if (sh.type === 'flail') {
            const a = this._flail?.a ?? 0;
            o = { x: lerp(p1.x, m.x, 0.4), y: lerp(p1.y, m.y, 0.4), zoom: lerp(1.9, 1.4, easeOut(clamp01(u / 0.3))), rot: 0.07 * Math.sin(a), k: 0.14, fit: [p1, p2], pad: 80 };
        } else if (sh.type === 'hurt') {
            o = { x: lerp(p1.x, m.x, 0.3), y: p1.y - 20, zoom: 2.0, rot: 0.1 * this.cam.dutch, k: 0.2, fit: [p1, p2], pad: 60 };
        } else {
            o = { x: m.x, y: m.y - 10, zoom: 1.6 + 0.2 * Math.sin(u * 2.4), rot: 0.05 * Math.sin(u * 0.9), k: 0.1, fit: [p1, p2], pad: 70 };
        }
        this.cam.frame(A, t, o);
    }
}
