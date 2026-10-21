/**
 * Plano C — A CORRENTE ARREBENTA (Bloco 2, "se vocês esticam demais, a
 * corrente arrebenta, a serra cai, e os dois ficam desarmados até voltarem
 * juntos pra buscar").
 *
 * Mesa: pose-base; as duas mãos afastam P1 e P2 e SOLTAM as tiras. O corte
 * acontece no começo do afastamento (as peças ainda nas cruzinhas).
 * Jogo:
 *   1. cabo de guerra: cada um puxa para um lado, a corda estica e treme, a
 *      serra pisca branco cada vez mais rápido (tensão), a câmera fecha devagar;
 *   2. ARREBENTA: hit-stop, faíscas, clarão, a serra cai no meio e os dois são
 *      lançados para trás; a câmera abre de uma vez com giro;
 *   3. pousam, se recompõem, olham a serra no chão e um para o outro;
 *   4. voltam JUNTOS até a serra e RECONECTAM (clarão azul, anel de choque),
 *      com soco de câmera; fúria; a câmera assenta e deriva.
 *
 * Tempos do roteiro em s de SIMULAÇÃO depois do congelamento; câmera em tempo
 * real (camTo).
 */
import { MatchShot, LAYOUT, FREEZE, TAIL } from './MatchShot.js';

const TUG_V = 3.6;          // px/passo de cada um puxando para o seu lado
const STRAIN_AT = 0.12;     // s: começa a tensão
const STRAIN_DUR = 0.85;    // s de tensão até arrebentar
const THROW_V = 7;          // px/passo do arremesso para trás
const THROW_HOP = 6.2;
const BACK_SPEED = 4.6;     // px/passo voltando para a serra (decididos, sem tempo morto)
const RECONNECT_GUARANTEE = 1.9;   // s depois do arrebentar

export class BreakShot extends MatchShot {
    constructor(stage) {
        super(stage, FREEZE + 3.15 + TAIL);
    }

    setup(A) {
        const { p1, p2, saw } = A;
        const y0 = LAYOUT.pose.p1.y;
        const cam0 = LAYOUT.camera;
        const S = this;
        S.phase = 'tug';
        S.snapT = S.backT = S.connT = undefined;
        S.landed = new Set();
        S._up = new Map();

        // Cabo de guerra: cada um puxa para o seu lado, de cara fechada.
        for (const [p, dir] of [[p1, -1], [p2, 1]]) {
            p.faceX = null;
            p.accel = 0.22;
            p.wobble = 0.25;
            p.goal = { vx: TUG_V * dir, vy: 0, holdY: y0 };
            A.expr(p, 'raiva');
        }

        const throwBack = () => {
            const at = A.sawPos;
            S.snapT = A.t;
            S.phase = 'thrown';
            S.dropAt = { x: at.x, y: at.y };
            saw.setStrain(0);
            A.post.setVignetteBreath(0);
            A.snap();
            // Impacto: congela, treme, clareia; mundo lento.
            S.hitstop(0.1);
            A.slowmo(0.42, 0.25);
            A.renderer.triggerShake(26);
            A.renderer.triggerZoomPunch(-0.06);
            A.impactFlash = 0.3;    // (o snap() põe 0.6: contido para não estourar)
            A.particles.triggerSparkBurst(at.x, at.y, saw.discRadius, 40, 2.2);
            A.stage.audio?.play('impact', { vol: 0.6 });
            // Os dois lançados para trás (olhando para a serra ao frear).
            for (const [p, dir] of [[p1, -1], [p2, 1]]) {
                p.goal = null;
                p.vx = THROW_V * dir;
                p.vy = (dir < 0 ? -0.6 : 0.6);
                p.shiver = 0;
                p.tiltKick = 0.75 * dir;
                p.faceX = at.x;
                A.hop(p, THROW_HOP);
                A.expr(p, 'espantado');
                A.particles.triggerDust(p.x, p.y + 20, -dir, -0.3, 14);
            }
            // A câmera abre de uma vez, com giro (explosão).
            S.camTo({ x: at.x, y: y0 - 6, z: 0.92, rot: -0.05, k: 10 });
        };

        A.script = (t) => {
            // 1) Tensão: serra pisca, corda treme, câmera fecha devagar.
            if (S.phase === 'tug' && t > STRAIN_AT) {
                const k = Math.min(1, (t - STRAIN_AT) / STRAIN_DUR);
                saw.setStrain(k);
                A.post.setVignetteBreath(k);
                A.minSpin = 0.25 + 0.5 * k;
                A.renderer.triggerShake(1.5 + 5 * k * k);
                p1.shiver = p2.shiver = 0.25 + 0.6 * k;
                if (!S._creep) {
                    S._creep = true;
                    S.camTo({ x: cam0.x, y: y0 - 8, z: 1.12, rot: 0.01, k: 1.6 });
                }
                if (k > 0.7 && !S._panic) {
                    S._panic = true;
                    A.both(p => A.expr(p, 'espantado'));
                }
                if (k >= 1) throwBack();
            }

            if (S.snapT === undefined) return;

            // 2) Pouso de cada um: cambaleia, poeira, baque, piscada.
            for (const p of [p1, p2]) {
                const up = p.hopZ > 3;
                if (S._up.get(p) && !up && !S.landed.has(p)) {
                    S.landed.add(p);
                    p.stumble = 0.3;
                    A.renderer.triggerShake(9);
                    A.particles.triggerDust(p.x, p.y + 20, 0, -1, 16);
                    A.sfx('thud', p.x, p.y, { vol: 0.75 });
                    A.exprFor(p, 'olhos_fechados', 0.28);
                }
                S._up.set(p, up);
            }
            if (S.landed.size === 2 && !S._settle) {
                S._settle = true;
                S.settleT = t;
                S.camTo({ x: S.dropAt.x, y: y0 - 4, z: 1.0, rot: 0, k: 2.5 });
            }

            // 3) Olham a serra no chão... e um para o outro.
            if (S._settle && !S._lookSaw && t > S.settleT + 0.08) {
                S._lookSaw = true;
                A.both(p => { p.faceX = S.dropAt.x; A.expr(p, 'preocupado'); });
            }
            if (S._lookSaw && !S._lookEach && t > S.settleT + 0.26) {
                S._lookEach = true;
                A.both(p => A.expr(p, 'desconfiado'));
                A.hop(p1, 2.2); A.hop(p2, 2.2);
            }

            // 4) Voltam juntos até a serra.
            if (S._lookEach && S.backT === undefined && t > S.settleT + 0.42) {
                S.backT = t;
                S.phase = 'back';
                A.both(p => { A.expr(p, 'furia'); p.accel = 0.2; p.faceX = null; });
                p1.goal = { x: S.dropAt.x - 70, y: y0, speed: BACK_SPEED };
                p2.goal = { x: S.dropAt.x + 70, y: y0, speed: BACK_SPEED };
                S.camTo({ x: S.dropAt.x, y: y0 - 10, z: 1.14, rot: 0, k: 1.8 });
            }
            if (S.phase === 'back') {
                const d = S.dropAt;
                const near = Math.hypot(p1.x - d.x, p1.y - d.y) < 110 && Math.hypot(p2.x - d.x, p2.y - d.y) < 110;
                if (near || t > S.snapT + RECONNECT_GUARANTEE) {
                    S.connT = t;
                    S.phase = 'connected';
                    A.reconnect();
                    A.connectFlash = 0.75;  // clarão azul mais curto (não lava a tela)
                    S.hitstop(0.07);
                    A.slowmo(0.16, 0.4);
                    A.minSpin = 0.9;
                    A.both(p => { A.expr(p, 'furia'); A.hop(p, 4); p.faceX = p === p1 ? p2.x : p1.x; });
                    p1.goal = { x: p1.x, y: y0, speed: 1 };
                    p2.goal = { x: p2.x, y: y0, speed: 1 };
                    // Soco de câmera na reconexão.
                    S.camTo({ x: d.x, y: d.y - 10, z: 1.34, rot: 0.05, k: 14 });
                }
            }
            if (S.connT !== undefined && !S._rest && t > S.connT + 0.35) {
                S._rest = true;
                S.camTo({ z: 1.2, rot: 0, k: 3 });
            }
            if (S._rest && !S._drift && t > S.connT + 0.8) {
                S._drift = true;
                S.camTo({ z: 1.27, k: 0.7 });
            }
        };
    }
}
