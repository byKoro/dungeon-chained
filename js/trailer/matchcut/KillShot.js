/**
 * Plano A — KILL (Bloco 2, "se um inimigo entra no meio... ele é despedaçado").
 *
 * Mesa: a mão empurra o recorte do demônio DE CIMA PARA BAIXO contra a serra;
 * o corte acontece no meio do empurrão (o demônio na marca da folha 4).
 * Jogo: o demônio segue o mesmo movimento, dá o bote na serra, que acorda
 * girando, e é despedaçado.
 *
 * Game feel do abate (a câmera fica travada no papel até aqui):
 *   - antecipação: a câmera começa a fechar devagar enquanto o bote vem;
 *   - IMPACTO: hit-stop curto, tremor forte, clarão, faíscas e sangue extra
 *     no ponto do corte, pop da serra, os dois recuam com o tranco;
 *   - SOCO de câmera em tempo real: fecha no corte com um leve giro (dutch)
 *     durante a câmera lenta;
 *   - ESTOURO (gibs): segundo tranco — a câmera recua um pouco e gira para o
 *     outro lado, piscada dos dois com o respingo;
 *   - FÚRIA: voltam para a pose, pulinho, e a câmera assenta enquadrando os
 *     dois e deriva devagar para dentro até o fim (sobra para a edição).
 *
 * Tempos do roteiro em s de SIMULAÇÃO depois do congelamento; os da câmera
 * são reais (camTo), então o soco continua rápido mesmo na câmera lenta.
 */
import { MatchShot, LAYOUT, FREEZE, TAIL } from './MatchShot.js';

const PUSH_V = 4.5;      // px de mundo por passo (~velocidade da mão na mesa)
const LUNGE_AT = 0.15;   // s
const LUNGE_POWER = 8;
const SPIN_UP = 0.25;    // s até a serra girar a toda
const KILL_GUARANTEE = 0.6;
const RECOIL = 3.4;      // px/passo do tranco nos dois

export class KillShot extends MatchShot {
    constructor(stage) {
        // congelado + ação (~1.8 s, esticada pela câmera lenta) + sobra
        super(stage, FREEZE + 1.8 + TAIL);
    }

    setup(A) {
        const { p1, p2, saw } = A;
        const d = LAYOUT.shots.A.demon;
        const pose = LAYOUT.pose;
        const cam0 = LAYOUT.camera;
        const sawAt = A.sawPos;
        // Olha "para a frente" (sem espelhar), como o recorte de papel.
        const e = A.spawnEnemy(d.x, d.y, 'demon', { speed: 0, lookAt: { x: d.x, y: d.y + 100 } });
        e.animTime = 0;
        e.facingLeft = false;
        const S = this;
        S.phase = 'push';
        S.killT = S.gibT = S.furiaT = undefined;

        A.onKill = (victim) => {
            if (S.killT !== undefined) return;
            S.killT = A.t;
            S.phase = 'dead';
            const sp = A.sawPos;
            const hx = (sp.x + victim.x) / 2, hy = (sp.y + victim.y) / 2;   // ponto do corte

            // Impacto: congela, treme, clareia.
            S.hitstop(0.09);
            A.slowmo(0.45, 0.22);
            A.renderer.triggerShake(24);
            A.renderer.triggerZoomPunch(0.07);
            A.impactFlash = 0.32;   // o corte cai no fim da luz plana: clarão contido
            A.stage.audio?.duck(-8, 0.05, 0.5);
            A.stage.audio?.play('impact', { vol: 0.7 });

            // Faíscas + sangue extra no ponto do corte; serra dá o "pop".
            A.particles.triggerSparkBurst(hx, hy, saw.discRadius, 34, 2);
            A.particles.triggerFlash(hx, hy, 18, 1.4);
            A.particles.triggerBlood(victim.x, victim.y, 18, 1.25);
            saw.spinKick = 1;
            saw.onHit?.();

            // Tranco: os dois recuam e se espantam.
            p1.goal = null; p2.goal = null;
            p1.vx -= RECOIL; p2.vx += RECOIL;
            p1.tiltKick = -0.5; p2.tiltKick = 0.5;
            A.both(p => { A.expr(p, 'espantado'); A.hop(p, 4.6); });

            // Soco de câmera: fecha no corte com giro.
            S.camTo({ x: hx, y: hy + 8, z: 1.38, rot: -0.07, k: 16 });
        };

        A.script = (t) => {
            A.minSpin = Math.min(1, t / SPIN_UP);

            // Antecipação: a câmera começa a fechar no meio enquanto o bote vem.
            if (t > 0.03 && S.phase === 'push' && !S._creep) {
                S._creep = true;
                S.camTo({ x: sawAt.x, y: (sawAt.y + d.y) / 2 + 30, z: 1.06, rot: 0.012, k: 3 });
            }
            if (S.phase === 'push') {
                // Segue empurrado pela "mão" até o bote.
                e.y += PUSH_V;
                e.animTime++;
                if (t >= LUNGE_AT) {
                    S.phase = 'lunge';
                    A.lunge(e, sawAt.x, sawAt.y, LUNGE_POWER);
                }
            }
            if (S.phase === 'lunge' && t > KILL_GUARANTEE) A.killEnemy(e, 14);

            // Estouro em pedaços: segundo tranco de câmera.
            if (S.killT !== undefined && S.gibT === undefined && !A.enemies.includes(e)) {
                S.gibT = t;
                A.renderer.triggerShake(18);
                A.renderer.triggerZoomPunch(-0.05);
                A.both(p => A.blink(p, 0.22));
                S.camTo({ x: cam0.x, y: sawAt.y - 20, z: 1.2, rot: 0.035, k: 9 });
            }

            // Fúria: voltam para a pose e a câmera assenta nos dois.
            if (S.gibT !== undefined && S.furiaT === undefined && t > S.gibT + 0.3) {
                S.furiaT = t;
                S.phase = 'furia';
                A.both(p => { A.expr(p, 'furia'); A.hop(p, 3.4); p.accel = 0.12; });
                p1.goal = { x: pose.p1.x, y: pose.p1.y, speed: 2.4 };
                p2.goal = { x: pose.p2.x, y: pose.p2.y, speed: 2.4 };
                A.renderer.triggerShake(7);
                S.camTo({ x: cam0.x, y: sawAt.y - 12, z: 1.16, rot: 0, k: 3 });
            }
            // Deriva lenta para dentro até o fim (sobra da edição).
            if (S.furiaT !== undefined && !S._drift && t > S.furiaT + 0.45) {
                S._drift = true;
                S.camTo({ z: 1.24, k: 0.7 });
            }
        };
        // Os dois ficam firmes na pose (um de frente para o outro).
        p1.goal = null; p2.goal = null;
    }
}
