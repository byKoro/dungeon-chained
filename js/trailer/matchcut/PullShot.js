/**
 * Plano B — PUXÃO (Bloco 2, "se o seu parceiro se mexe errado, você é puxado").
 *
 * Mesa: pose-base; a mão arrasta o recorte do P2 PARA A DIREITA. O corte
 * acontece no começo do arrasto (P2 ainda na cruzinha).
 * Jogo: o P2 dispara para a direita, a corda estica e dá o TRANCO: o P1 é
 * arrancado do chão (espantado), voa atrás dele e cai cambaleando; o P2 freia,
 * olha para trás preocupado e o P1 fecha a cara.
 *
 * Game feel: a câmera fica no papel até o tranco; no tranco, hit-stop, tremor,
 * poeira e um soco de câmera no P1 com giro; depois ela acompanha os dois para
 * a direita, sente o pouso (tremor + poeira) e assenta enquadrando os dois.
 *
 * Tempos do roteiro em s de SIMULAÇÃO depois do congelamento; câmera em tempo
 * real (camTo).
 */
import { MatchShot, LAYOUT, FREEZE, TAIL } from './MatchShot.js';

const DASH_V = 6.6;        // px/passo do P2 disparando
const YANK_GUARANTEE = 0.4;
const YANK_BOOST = 3.2;    // px/passo extra no P1 (além do tranco da corda)
const YANK_HOP = 7;        // pulo "visual" do P1 arrancado
const RUN_AFTER = 0.42;    // s que o P2 ainda corre depois do tranco

export class PullShot extends MatchShot {
    constructor(stage) {
        super(stage, FREEZE + 1.75 + TAIL);
    }

    setup(A) {
        const { p1, p2 } = A;
        const y0 = LAYOUT.pose.p2.y;
        const S = this;
        S.phase = 'dash';
        S.yankT = S.brakeT = S.landT = S.glareT = undefined;
        S._wasUp = false;

        // P2 dispara para a direita (sem "andar de costas" no 1º passo).
        p2.faceX = null;
        p2.accel = 0.35;
        p2.wobble = 0.2;
        p2.goal = { vx: DASH_V, vy: 0, holdY: y0 };

        A.onYank = () => {
            if (S.yankT !== undefined) return;
            S.yankT = A.t;
            S.phase = 'yanked';
            // Tranco: congela um instante, treme e arranca o P1 do chão.
            S.hitstop(0.07);
            A.slowmo(0.32, 0.3);
            A.renderer.triggerShake(16);
            A.renderer.triggerZoomPunch(0.05);
            A.impactFlash = 0.18;
            p1.faceX = null;
            p1.goal = null;
            p1.vx += YANK_BOOST;
            p1.tiltKick = 0.7;
            A.hop(p1, YANK_HOP);
            A.expr(p1, 'espantado');
            A.particles.triggerDust(p1.x, p1.y + 20, -1, -0.3, 16);
            A.sfx('swish', p1.x, p1.y, { vol: 0.5 });
            // Soco de câmera no meio da corda (os dois no quadro: a causa e o
            // efeito do tranco), com giro.
            S.camTo({ x: A.mid.x + 20, y: y0 - 18, z: 1.3, rot: 0.06, k: 14 });
        };

        A.script = (t) => {
            // Garantia: se a corda não der o tranco sozinha, ele vem mesmo assim.
            if (S.phase === 'dash' && t > YANK_GUARANTEE) {
                p1.vx += 5;
                A.onYank();
            }

            if (S.yankT !== undefined) {
                // Câmera acompanha os dois para a direita (após o soco).
                if (t > S.yankT + 0.15) {
                    if (!S._follow) {
                        S._follow = true;
                        S.camTo({ y: y0 - 10, z: 1.16, rot: -0.025, k: 3.5 });
                    }
                    S.camTo({ x: A.mid.x + 30 });
                }

                // P2 freia e olha para trás.
                if (S.brakeT === undefined && t > S.yankT + RUN_AFTER) {
                    S.brakeT = t;
                    S.phase = 'brake';
                    p2.goal = { vx: 0, vy: 0, holdY: y0 };
                    p2.accel = 0.16;
                    p2.brakeT = 0.25;
                    A.particles.triggerDust(p2.x, p2.y + 20, 1, -0.2, 12);
                }
                if (S.brakeT !== undefined && t > S.brakeT + 0.12 && !S._looked) {
                    S._looked = true;
                    p2.faceX = p1.x;
                    A.expr(p2, 'preocupado');
                    A.hop(p2, 2.6);
                }

                // Pouso do P1: cambaleia, poeira e tremor.
                const up = p1.hopZ > 3;
                if (S._wasUp && !up && S.landT === undefined) {
                    S.landT = t;
                    p1.stumble = 0.32;
                    p1.tiltKick = -0.4;
                    A.renderer.triggerShake(10);
                    A.particles.triggerDust(p1.x, p1.y + 20, 0, -1, 18);
                    A.sfx('thud', p1.x, p1.y, { vol: 0.8 });
                }
                S._wasUp = up;

                // P1 fecha a cara para o parceiro.
                if (S.landT !== undefined && S.glareT === undefined && t > S.landT + 0.32) {
                    S.glareT = t;
                    p1.faceX = p2.x;
                    A.expr(p1, 'raiva');
                    A.renderer.triggerShake(5);
                    S.camTo({ z: 1.22, rot: 0, k: 2.2 });
                }
                // Deriva lenta até o fim (sobra da edição).
                if (S.glareT !== undefined && !S._drift && t > S.glareT + 0.5) {
                    S._drift = true;
                    S.camTo({ z: 1.28, k: 0.7 });
                }
            }
        };
    }
}
