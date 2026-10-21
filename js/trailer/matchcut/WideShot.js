/**
 * Plano D — "NO JOGO FICA ASSIM" (Bloco 2: plano aberto; cobre também o
 * clipe 2, "vocês se posicionam").
 *
 * Mesa: pose-base; as duas mãos levam P1 e P2 PARA A ESQUERDA (P1 sobe, P2
 * desce, a corda fica em pé). O corte acontece no começo do movimento (peças
 * ainda nas cruzinhas).
 * Jogo:
 *   1. se olham, a serra acorda; andam para a esquerda e se POSICIONAM em
 *      linha (corda de pé), virando para a porta; a câmera RECUA até mostrar
 *      a sala inteira (a folha era só o miolo dela);
 *   2. a porta NORTE (no alto do quadro aberto) treme, apanha por dentro e
 *      abre: rugido, luz vermelha, a horda desce e se amontoa à direita;
 *   3. se olham, fúria, e ATRAVESSAM a horda cortando (câmera lenta no 1º
 *      abate, a câmera acompanha de perto);
 *   4. freiam antes da parede, se viram; a câmera abre e assenta.
 *
 * Tempos do roteiro em s de SIMULAÇÃO depois do congelamento; câmera em tempo
 * real (camTo).
 */
import { MatchShot, LAYOUT, FREEZE, TAIL } from './MatchShot.js';
import { clamp01 } from '../anim.js';

const WALK_AT = 0.3;        // s: começam a andar
const WALK_SPEED = 4.2;     // px/passo
const SPOT = { x: 230, y1: 240, y2: 472 };   // posição de cada um (corda em pé; fora dos props)
const WIDE = { x: 576, y: 332, z: 0.56 };    // sala inteira no quadro (porta N visível)
const KNOCK_AT = [1.15, 1.4, 1.62];          // pancadas na porta
const DOOR_AT = 1.85;       // porta abre
const DOOR_DUR = 0.25;
const HORDE = 12;
const HORDE_GAP = 0.05;     // s entre um inimigo e outro passando pela porta
// "Bolo" da horda: cabe ENTRE os dois em Y (a corda em pé varre todos).
// Um pouco abaixo do meio: o sprite sobe ~1 tile acima dos pés, então o
// bolo visual fica centrado e não engole o P1; a faixa de baixo fica fora
// da zona morta do P2 (PLAYER_SAFE_ZONE 46).
const BLOB = { x: 770, y: 368, rx: 120, ry: 44 };
const HORDE_RUSH = 2.2;     // px/passo da horda vindo ao encontro na investida
const NOD_AT = 3.0;         // se olham antes da investida
const CHARGE_AT = 3.3;
const CHARGE_V = 5.6;
const BRAKE_X = 900;        // P1 passou daqui: freia
const CHARGE_GUARANTEE = 2.2;   // s de investida até forçar a freada

export class WideShot extends MatchShot {
    constructor(stage) {
        super(stage, FREEZE + 5.5 + TAIL, { doors: { N: true } });
    }

    setup(A) {
        const { p1, p2 } = A;
        const S = this;
        const door = { x: A.center.x, y: A.bounds.minY };
        S.phase = 'nod';
        S.chargeT = S.brakeT = S.clearT = undefined;
        S.spawned = 0;
        S.knocks = 0;
        S._flags = {};
        A.doorOpen = { N: 0 };
        A.red = 0;
        p1._placed = p2._placed = false;

        const once = (k) => (S._flags[k] ? false : (S._flags[k] = true));

        A.onKill = () => {
            if (once('kill1')) {
                S.hitstop(0.06);
                A.slowmo(0.3, 0.3);
                A.renderer.triggerZoomPunch(0.05);
                S.camTo({ z: 0.86, rot: -0.04, k: 12 });
            }
        };

        A.script = (t) => {
            A.minSpin = Math.min(0.85, t * 1.2);
            // Se olham (só depois do congelamento: o quadro 0 = papel).
            if (t > 0.05 && once('hop')) {
                A.both(p => A.expr(p, 'desconfiado'));
                A.hop(p1, 2.6); A.hop(p2, 2.6);
            }

            // 1) Andam para a esquerda e se posicionam (corda em pé).
            if (t > WALK_AT && once('walk')) {
                S.phase = 'walk';
                A.both(p => { p.faceX = null; p.accel = 0.12; p.wobble = 0.22; A.expr(p, 'raiva'); });
                p1.goal = { x: SPOT.x, y: SPOT.y1, speed: WALK_SPEED };
                p2.goal = { x: SPOT.x, y: SPOT.y2, speed: WALK_SPEED * 1.08 };
                // A câmera recua até a sala inteira.
                S.camTo({ x: WIDE.x, y: WIDE.y, z: WIDE.z, rot: 0, k: 2.2 });
            }
            if (S.phase === 'walk') {
                for (const p of [p1, p2]) {
                    if (!p._placed && Math.hypot(p.goal.x - p.x, p.goal.y - p.y) < 22) {
                        p._placed = true;
                        p.faceX = door.x;
                        A.particles.triggerDust(p.x, p.y + 20, 0, -1, 6);
                    }
                }
            }

            // 2) A porta apanha por dentro... e abre.
            if (S.knocks < KNOCK_AT.length && t > KNOCK_AT[S.knocks]) {
                S.knocks++;
                A.renderer.triggerShake(5 + S.knocks * 2);
                A.particles.triggerDust(door.x + (Math.random() - 0.5) * 90, door.y + 6, 0, 1, 6);
                A.sfx('thud', door.x, door.y, { vol: 0.45 + S.knocks * 0.1, rate: 1.3, cool: 0 });
                if (S.knocks === 1) A.both(p => { p.faceX = door.x; A.exprFor(p, 'espantado', 0.4); A.expr(p, 'preocupado'); });
                A.red = Math.max(A.red, 0.08 * S.knocks);
            }
            if (t > DOOR_AT) {
                const k = clamp01((t - DOOR_AT) / DOOR_DUR);
                A.doorOpen.N = k;
                if (once('door')) {
                    A.sfx('doorOpen', door.x, door.y, { vol: 0.85 });
                    A.sfx('roar', door.x, door.y, { vol: 0.5, rate: 1.2 });
                    A.renderer.triggerShake(16);
                    A.particles.triggerSparkBurst(door.x, door.y, 30, 24, 2);
                    A.both(p => { A.expr(p, 'assustado'); p.shiver = 0.3; A.hop(p, 3); });
                    S.stage.audio?.duck(-6, 0.05, 0.6);
                    // Leve empurrão da câmera na direção da porta.
                    S.camTo({ y: WIDE.y - 20, z: WIDE.z * 1.06, rot: -0.02, k: 6 });
                }
                A.red = Math.min(0.32, A.red + 0.01);
                // A horda passa pela porta, um atrás do outro.
                const due = Math.min(HORDE, Math.floor((t - DOOR_AT - 0.1) / HORDE_GAP) + 1);
                while (S.spawned < due) S._spawn(A, door, S.spawned++);
            }
            if (S._flags.door && t > DOOR_AT + 0.5 && once('settleWide')) {
                S.camTo({ y: WIDE.y, z: WIDE.z, rot: 0.015, k: 2 });
            }

            // 3) Se olham, fúria... e atravessam a horda.
            if (t > NOD_AT && once('nod')) {
                A.both(p => { p.shiver = 0; p.faceX = p === p1 ? p2.x : p1.x; A.expr(p, 'furia'); A.hop(p, 3.4); });
                A.renderer.triggerShake(6);
            }
            if (t > CHARGE_AT && once('charge')) {
                S.phase = 'charge';
                S.chargeT = t;
                A.minSpin = 1;
                A.saw.spin = 1;
                A.both(p => { p.faceX = null; p.accel = 0.1; p.wobble = 0.05; });
                p1.goal = { vx: CHARGE_V, vy: 0, holdY: SPOT.y1 + 8 };
                p2.goal = { vx: CHARGE_V, vy: 0, holdY: SPOT.y2 - 8 };
                // A horda vem ao encontro em linha reta (cada um na sua faixa
                // de Y, entre os dois): a corda em pé passa por todos.
                for (const e of A.enemies) {
                    e.chase = null;
                    e.goal = { x: e.x - 600, y: e._lane ?? e.y };
                    e.speed = HORDE_RUSH; e.stopDist = 0;
                }
                S.camTo({ y: BLOB.y - 10, z: 0.78, rot: 0.03, k: 2.6 });
            }
            if (S.phase === 'charge') {
                S.camTo({ x: Math.min(A.mid.x + 110, 760) });
                // Quem ainda vem descendo da porta entra na SUA faixa antes de
                // encontrar a corda (senão a horda chega alta e engole o P1).
                for (const e of A.enemies) {
                    if (e.state === 'dying' || e._lane === undefined) continue;
                    const off = Math.abs(e._lane - e.y);
                    e.goal = { x: e.x - 60, y: e._lane };
                    e.speed = off > 12 ? 4.2 : HORDE_RUSH;
                }
                // Freia logo depois do último abate (ou perto da parede).
                const alive = A.enemies.some(e => e.state !== 'dying');
                if (!alive && A.kills > 0 && S.clearT === undefined) S.clearT = t;
                if ((S.clearT !== undefined && t > S.clearT + 0.25) || p1.x > BRAKE_X || t > S.chargeT + CHARGE_GUARANTEE) S._brake(A, t);
            }

            // 4) Freiam, se viram para a sala; a câmera abre e assenta.
            if (S.phase === 'brake') {
                if (t > S.brakeT + 0.25 && once('turn')) {
                    A.both(p => { p.faceX = WIDE.x; A.hop(p, 2.4); });
                }
                if (t > S.brakeT + 0.3 && once('rest')) S.camTo({ x: 700, y: WIDE.y, z: 0.72, rot: 0, k: 2 });
                if (t > S.brakeT + 0.9 && once('drift')) S.camTo({ z: 0.76, k: 0.6 });
                A.red = Math.max(0, A.red - 0.004);
            }
        };
    }

    // Inimigo i da horda: nasce do lado de fora da porta e vai a um lugar no
    // "bolo" do meio da sala (girassol achatado, sem sobreposição).
    _spawn(A, door, i) {
        const ang = i * 2.39996, r = Math.sqrt((i + 0.5) / HORDE);
        const goal = { x: BLOB.x + Math.cos(ang) * r * BLOB.rx, y: BLOB.y + Math.sin(ang) * r * BLOB.ry };
        const e = A.spawnEnemy(door.x + ((i * 37) % 60) - 30, door.y - 50, i % 3 === 2 ? 'bloodMonster' : 'demon',
            { speed: 4 + (i % 4) * 0.3, goal, stopDist: 0, entering: true, lookAt: A.midTarget });
        e._lane = goal.y;
        if (i % 4 === 0) A.renderer.triggerShake(4);
        return e;
    }

    _brake(A, t) {
        const { p1, p2 } = A;
        this.phase = 'brake';
        this.brakeT = t;
        for (const p of [p1, p2]) {
            p.goal = { vx: 0, vy: 0, holdY: p.y };
            p.accel = 0.14;
            p.brakeT = 0.22;
            A.particles.triggerDust(p.x, p.y + 20, 1, -0.2, 12);
        }
        A.minSpin = 0.7;
        // O que sobrar persegue a serra (é cortado ao encostar).
        for (const e of A.enemies) { e.chase = A.midTarget; e.speed = 2.4; }
    }
}
