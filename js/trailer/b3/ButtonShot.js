/**
 * Clipe 3 — BOTÕES ("Tem porta que só abre quando cada um pisa no seu
 * botão.").
 *
 * Dois PressureButton reais quase no limite da corda. O P1 pisa no dele e
 * nada acontece (nível pequeno: clique, poeira, tremor 3) — ele olha a porta e
 * depois o parceiro. O P2 se ESTICA até o outro com a corda no limite (a serra
 * pisca a tensão); o aperto que completa o par sai mais agudo (como no jogo),
 * os dois ficam juntos `holdFrames` passos (ChallengeCorridor) e a porta treme
 * e abre com o feixe amarelo, clarão e zoom-punch (nível médio).
 */
import { B3Shot } from './B3Shot.js';
import { ArenaHazards } from './arenaHazards.js';
import { dressRoom } from '../kit/rushKit.js';
import { HAZARDS } from '../../config/GameConfig.js';
import { clamp01 } from '../anim.js';

const COLS = 16, ROWS = 11;
const B_ROW = 6, B1_C = 5, B2_C = 10;      // 5 tiles = 320 px entre os botões
const SOLVE_GUARANTEE = 2.4;

export class ButtonShot extends B3Shot {
    constructor(stage) {
        super(stage, { cols: COLS, rows: ROWS, doors: { N: true }, seed: 64, ropeLen: 314 }, 3.6);
        this.label = 'CO-OP BUTTONS';
        this.hz = new ArenaHazards(this.arena).button(B1_C, B_ROW).button(B2_C, B_ROW);
    }

    setup(A) {
        const { p1, p2, saw } = A;
        const [b1, b2] = this.hz.buttons;
        dressRoom(A, {
            seed: 64, crates: 2, rubble: 10, loot: 2, banners: 2, blood: 3,
            // Livre: a faixa dos botões e o caminho até a porta N.
            avoid: (c, r) => (r >= B_ROW - 1 && r <= B_ROW + 1 && c >= B1_C - 1 && c <= B2_C + 1)
                || (r <= B_ROW && c >= B1_C && c <= B2_C)
        });
        A.doorOpen = { N: 0 };
        const door = { x: A.center.x, y: A.bounds.minY };
        const stand = (b) => ({ x: b.x, y: b.y - 19 });   // pés na tampa

        A.initPlayer(p1, b1.x - 40, 590);
        A.initPlayer(p2, b1.x + 110, 600);
        A.both(p => { p.accel = 0.12; p.wobble = 0.2; });
        const s1 = stand(b1), s2 = stand(b2);
        p1.goal = { x: s1.x, y: s1.y, speed: 3.2 };
        p2.goal = { x: s2.x, y: s2.y, speed: 2.6 };
        A.expr(p1, 'neutro');
        A.expr(p2, 'neutro');
        A.minSpin = 0; saw.spin = 0.3;

        const S = this;
        S.phase = 'walk';
        S.p1T = S.solveT = S.openT = undefined;
        S.hold = 0;
        S._p1Look = S._stretch = S._relief = false;
        let wasP1 = false, wasP2 = false;

        A.script = (t) => {
            // Tensão da corda (a serra pisca perto do limite, como no jogo).
            const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            saw.setStrain(clamp01((d / A.ropeLen - 0.86) / 0.14));

            // 1) P1 pisa: nada acontece.
            if (b1.justPressed && !wasP1) {
                wasP1 = true;
                S.p1T = t;
                A.sfx('buttonPress', b1.x, b1.y, { vol: 0.9 });
                A.renderer.triggerShake(3);
                A.expr(p1, 'olhando_cima');
            }
            if (S.p1T !== undefined && !S._p1Look && t > S.p1T + 0.45) {
                S._p1Look = true;
                A.look(p1, p2.x);
                A.expr(p1, 'desconfiado');
            }
            // P2 se estica: a corda no limite segura o passo.
            if (d > A.ropeLen - 24 && !S._stretch && S.phase === 'walk') {
                S._stretch = true;
                p2.wobble = 0.45;
                p2.goal.speed = 1.4;
                p2.tiltKick = 0.5;
                A.expr(p2, 'raiva');
                A.renderer.triggerShake(3);
                A.sfx('rope', saw.getSawPositions(p1, p2)[0].x, p1.y, { vol: 0.45 });
            }
            // Garantia: os pés chegam na tampa.
            if (t > SOLVE_GUARANTEE - 0.4 && S.phase === 'walk') {
                p2.x += (s2.x - p2.x) * 0.2; p2.y += (s2.y - p2.y) * 0.2;
                p1.x += (s1.x - p1.x) * 0.2; p1.y += (s1.y - p1.y) * 0.2;
            }

            // 2) P2 pisa: o par completo (som mais agudo, nível médio).
            if (b2.justPressed && !wasP2) {
                wasP2 = true;
                const both = b1.pressed;
                A.sfx('buttonPress', b2.x, b2.y, { vol: 1, rate: both ? 1.12 : 1 });
                A.renderer.triggerShake(6);
                A.renderer.triggerZoomPunch(0.05);
                A.hop(p2, 2.4);
            }
            // Resolução co-op real: os dois juntos por `holdFrames` passos.
            if (S.phase === 'walk') {
                S.hold = b1.pressed && b2.pressed ? S.hold + 1 : 0;
                if (S.hold >= HAZARDS.challenge.holdFrames || t > SOLVE_GUARANTEE) {
                    S.phase = 'solved';
                    S.solveT = t;
                    p2.wobble = 0.2;
                    A.sfx('stoneGrind', door.x, door.y, { vol: 0.8 });
                    A.both(p => A.expr(p, 'olhando_cima'));
                }
            }
            // 3) A porta treme e abre (flash amarelo + clarão + zoom-punch).
            if (S.phase === 'solved') {
                const u = t - S.solveT;
                if (u < 0.32 && ((t * 60) | 0) % 4 === 0) {
                    A.particles.triggerDust(door.x + (Math.random() - 0.5) * 110, door.y + 8, 0, 1, 4);
                    A.renderer.triggerShake(4);
                }
                A.doorOpen.N = clamp01((u - 0.32) / 0.28);
                if (u > 0.32 && S.openT === undefined) {
                    S.openT = t;
                    S.unlockDoors(A);
                    A.impactFlash = 0.28;
                    A.renderer.triggerShake(8);
                    A.both(p => { A.exprFor(p, 'espantado', 0.5); A.hop(p, 3.2); });
                }
            }
            if (S.openT !== undefined && !S._relief && t > S.openT + 0.55) {
                // Alívio: saem dos botões e vão juntos para a porta (a corda folga).
                S._relief = true;
                A.both(p => A.expr(p, 'furia'));
                p1.goal = { x: door.x - 85, y: door.y + 120, speed: 2.6 };
                p2.goal = { x: door.x + 85, y: door.y + 120, speed: 2.6 };
                p1.faceX = p2.faceX = null;
            }

            // Câmera: os dois botões + a porta (a porta cabe pelo enquadramento).
            S.frame(A, t, {
                x: (b1.x + b2.x) / 2, y: 262, zoom: S.openT !== undefined ? 1.52 : 1.45,
                k: 0.07, fit: [p1, p2], pad: 120
            });
        };
        A.snapCamera((b1.x + b2.x) / 2, 262, 1.45 * A.zoomRef);
    }
}
