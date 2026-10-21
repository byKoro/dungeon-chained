/**
 * Clipe 1 — BURACO ("Se o seu parceiro vacila, a corrente te puxa pra
 * beirada, e você tem que segurar.").
 *
 * Um demônio dá o bote no P2, que desvia para trás e pisa no abismo. A
 * resistência REAL da beirada (HOLE_FALL: freio da velocidade para dentro +
 * empurrão de volta, queda só depois de `graceFrames` passos além da borda)
 * segura o pé dele por um instante; a corda estica e arrasta o P1 para a
 * beira. No auge (nível grande: hit-stop, câmera lenta, soco de câmera) o P1
 * finca o pé e puxa o parceiro de volta. A serra corta o demônio no caminho
 * de volta e o P1 fecha a cara para o P2.
 *
 * Garantia de roteiro: depois do auge, a contagem de queda do P2 não chega ao
 * limite (o "segurar" sempre vence) — o resto é a física da beirada e da corda.
 */
import { B3Shot } from './B3Shot.js';
import { holeStep } from './arenaHazards.js';
import { dressRoom } from '../kit/rushKit.js';
import { TILE, HOLE_FALL } from '../../config/GameConfig.js';

const COLS = 18, ROWS = 11;
const EDGE_C = 11;                    // 1ª coluna do abismo (até a parede leste)
const EDGE_X = EDGE_C * TILE;         // x da beirada
const Y0 = 430;
const LUNGE_AT = 0.85;
const AUGE_GUARANTEE = 0.42;          // s depois do escorregão
const DEBUG = false;   // true = log da beirada no console (ajuste fino)

export class HoleShot extends B3Shot {
    constructor(stage) {
        super(stage, { cols: COLS, rows: ROWS, doors: { W: true }, seed: 47, ropeLen: 176 }, 5.0);
        this.label = 'HOLES';
        this._built = false;
        // Pé na beirada: o P2 tomba para dentro do abismo (só no desenho; a
        // posição continua a da física da beirada).
        const p2 = this.arena.p2, base = p2.draw.bind(p2);
        this.sink = 0;
        p2.draw = (ctx) => {
            const k = this.sink;
            if (k < 0.01) { base(ctx); return; }
            ctx.save();
            ctx.translate(p2.x, p2.y + 9 * k);
            ctx.rotate(0.45 * k);
            ctx.scale(1 - 0.18 * k, 1 - 0.18 * k);
            ctx.translate(-p2.x, -p2.y);
            base(ctx);
            ctx.restore();
        };
    }

    setup(A) {
        const { p1, p2, saw } = A;
        if (!this._built) {
            this._built = true;
            const cells = [];
            for (let r = 1; r <= ROWS - 2; r++) for (let c = EDGE_C; c <= COLS - 2; c++) cells.push([c, r]);
            A.setHoles(cells);
        }
        dressRoom(A, {
            seed: 47, crates: 2, rubble: 8, loot: 1, banners: 1, blood: 4,
            avoid: (c, r) => c >= 4 && c <= EDGE_C && r >= 4 && r <= 8
        });

        A.initPlayer(p1, 498, Y0);
        A.initPlayer(p2, 664, Y0 + 4);
        p1.faceX = p2.x; p2.faceX = p1.x;
        A.both(p => { p.accel = 0.12; p.wobble = 0.15; });
        A.expr(p1, 'neutro');
        A.expr(p2, 'neutro');
        A.minSpin = 0.25; saw.spin = 0.3;

        // Demônio desce por cima do P2 (longe da corda: não morre antes da hora).
        const e = A.spawnEnemy(668, 280, 'demon', { speed: 1.8, chase: p2, stopDist: 84, lookAt: p2 });
        const S = this;
        S.phase = 'approach';
        S.slipT = S.augeT = S.outT = S.killT = undefined;
        S._p1x0 = p1.x;
        S.sink = 0;
        S._charge = S._lunge2 = S._retreat = S._glare = false;

        A.onKill = () => {
            if (S.killT !== undefined) return;
            S.killT = A.t;
            A.slowmo(0.3, 0.35);
            A.renderer.triggerZoomPunch(0.04);
            A.both(p => A.exprFor(p, 'espantado', 0.3));
        };

        A.script = (t) => {
            // Mecânica real da beirada (antes do piloto, como no jogo).
            const before = p2.holeGrace ?? 0;
            holeStep(A, [p1, p2]);
            const sinkGoal = Math.max(0, Math.min(1, ((p2.holeDepth || 0) - 3) / 18));
            S.sink += (sinkGoal - S.sink) * 0.3;
            if (S.augeT !== undefined && p2.holeGrace >= HOLE_FALL.graceFrames - 3) {
                p2.holeGrace = HOLE_FALL.graceFrames - 4;   // garantia: ele segura
            }

            // 1) O bote e o desvio para trás (direto no abismo).
            const near = Math.hypot(e.x - p2.x, e.y - p2.y) < 100;
            if (S.phase === 'approach' && ((near && t >= 0.4) || t >= LUNGE_AT)) {
                if (DEBUG) console.log(`[hole] bote t=${t.toFixed(2)} e=(${e.x | 0},${e.y | 0}) p2=(${p2.x | 0},${p2.y | 0})`);
                S.phase = 'lunge';
                A.lunge(e, p2.x, p2.y - 40, 4.2);
                A.expr(p2, 'assustado');
                A.swerve(p2, 6.2, 0.4, 0.3);
                p2.goal = { vx: 3.0, vy: 0, holdY: Y0 + 4 };   // vacila: recua sem olhar
                p2.accel = 0.2;
                p2.faceX = e.x;
                p1.faceX = null;
                p1.goal = null;                                 // pego de surpresa
            }
            // Depois do bote, o demônio recua e espera.
            if (S.phase !== 'approach' && e.lungeT === 0 && !S._retreat && S.killT === undefined) {
                S._retreat = true;
                e.chase = null;
                e.goal = { x: 610, y: 230 };
                e.stopDist = 0;
                e.speed = 1.4;
            }

            // 2) Pé além da beirada: escorrega (a contagem de queda começa).
            if (DEBUG && ((t * 60) | 0) % 6 === 0 && S.phase !== 'approach' && S.killT === undefined) {
                console.log(`[hole] t=${t.toFixed(2)} p1x=${p1.x | 0} p2x=${p2.x | 0} depth=${(p2.holeDepth || 0).toFixed(1)} grace=${p2.holeGrace} d=${Math.hypot(p2.x - p1.x, p2.y - p1.y) | 0}`);
            }
            if (S.slipT === undefined && p2.holeGrace > 0 && before === 0) {
                S.slipT = t;
                A.expr(p2, 'espantado');
                p2.shiver = 0.6;
                p2.tiltKick = 0.7;
                A.particles.triggerDust(p2.x + 10, p2.y + 18, -1, -0.4, 14);
                A.sfx('crack', p2.x, p2.y, { vol: 0.45 });
                A.sfx('swish', p2.x, p2.y, { vol: 0.35, rate: 0.8 });
                // A corda estica e o P1 é arrastado (cambaleia).
                A.expr(p1, 'espantado');
                p1.stumble = 0.35;
                p1.tiltKick = 0.5;
            }
            if (S.slipT !== undefined && S.augeT === undefined) {
                // Arrasto: poeira saindo dos pés do P1.
                if (((t * 60) | 0) % 4 === 0) A.particles.triggerDust(p1.x - 8, p1.y + 18, 1, -0.2, 3);
                if (((t * 60) | 0) % 10 === 0) A.renderer.triggerShake(3);
                const dragged = p1.x - S._p1x0;
                if (p2.holeGrace >= 11 || dragged > 70 || t > S.slipT + AUGE_GUARANTEE) S._auge(A, t);
            }

            // 3) Fora do buraco: o P2 é arrancado de volta para o piso.
            if (S.augeT !== undefined && S.outT === undefined && !p2.holeDepth && p2.x < EDGE_X - 6) {
                S.outT = t;
                A.hop(p2, 5);
                p2.shiver = 0;
                p2.goal = { x: p1.x + 150, y: Y0, speed: 2.4 };
                p2.accel = 0.14;
                p1.goal = { vx: 0, vy: 0, holdY: Y0 };
                p1.brakeT = 0.25;
                A.particles.triggerDust(EDGE_X, p2.y + 18, 1, 0, 10);
                A.sfx('whoosh', p2.x, p2.y, { vol: 0.5, rate: 1.3 });
                A.expr(p2, 'assustado');
                A.expr(p1, 'furia');
            }
            // 4) Recompensa: o demônio volta no bote e a serra corta.
            if (S.outT !== undefined && S.killT === undefined) {
                if (!S._charge && t > S.outT + 0.1) {
                    // Investe contra a dupla (mira a serra).
                    S._charge = true;
                    e.goal = null;
                    e.chase = { get x() { return A.sawPos.x; }, get y() { return A.sawPos.y - 10; } };
                    e.stopDist = 0;
                    e.speed = 4.2;
                    A.minSpin = 1;
                }
                if (S._charge && !S._lunge2 && Math.hypot(e.x - A.sawPos.x, e.y - A.sawPos.y) < 110) {
                    S._lunge2 = true;
                    A.lunge(e, A.sawPos.x, A.sawPos.y, 7.5);
                }
                if (t > S.outT + 0.9) A.killEnemy(e, 12);
            }
            // 5) O P1 fecha a cara para o parceiro.
            if (S.killT !== undefined && !S._glare && t > S.killT + 0.35) {
                S._glare = true;
                p1.faceX = p2.x;
                p2.faceX = p1.x;
                A.expr(p1, 'raiva');
                A.expr(p2, 'preocupado');
                A.hop(p1, 2.6);
                A.renderer.triggerShake(4);
            }

            // Câmera: os dois + a beirada; fecha no auge.
            const close = S.augeT !== undefined && S.killT === undefined;
            const m = A.mid;
            S.frame(A, t, {
                x: (Math.min(p1.x, p2.x) + Math.max(p2.x, EDGE_X + 60)) / 2, y: m.y - 20,
                zoom: close ? 2.05 : 1.7, k: close ? 0.16 : 0.08, fit: [p1, p2], pad: 160
            });
        };
        A.snapCamera((p1.x + EDGE_X + 60) / 2, Y0 - 20, 1.7 * A.zoomRef);
    }

    // Auge do "segurar": hit-stop, câmera lenta e o P1 finca o pé.
    _auge(A, t) {
        const { p1, p2 } = A;
        this.augeT = t;
        this.hitstop(0.1);
        A.slowmo(0.85, 0.3);
        A.renderer.triggerShake(16);
        A.renderer.triggerZoomPunch(0.06);
        A.impactFlash = 0.14;
        const m = A.mid;
        A.sfx('rope', m.x, m.y, { vol: 0.9 });
        A.sfx('thud', p1.x, p1.y, { vol: 0.7 });
        A.stage.audio?.duck(-6, 0.1, 0.6);
        // P1 finca o pé e puxa (contra a corda).
        p1.goal = { vx: -5.6, vy: 0, holdY: Y0 };
        p1.accel = 0.35;
        p1.wobble = 0;
        p1.stumble = 0;
        p1.tiltKick = -0.7;
        p1.faceX = p2.x;
        A.expr(p1, 'furia');
        A.particles.triggerDust(p1.x + 10, p1.y + 20, -1, -0.5, 22);
        // P2 se agarra e tenta subir.
        p2.goal = { vx: -3, vy: 0, holdY: Y0 + 4 };
        p2.accel = 0.25;
        A.expr(p2, 'espantado');
    }
}
