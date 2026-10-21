/**
 * Clipe 4 — SALA TRANCADA ("E toda sala de combate tranca até o último
 * inimigo cair.").
 *
 * Versão comprimida da intro de sala do jogo (ROOM_INTRO): os dois entram
 * pela porta oeste com a câmera colada na porta, as portas BATEM atrás deles
 * (tranco, poeira, zoom-punch, os dois olham para trás), a câmera abre e
 * quatro inimigos nascem das chamas congelados e são liberados. A luta é a
 * regra real: quem encosta na corda ou no disco morre (CombatSystem). O
 * último abate tem hit-stop, câmera lenta e gibs (nível grande); depois as
 * portas destravam com o feixe amarelo, `doorOpen` e o zoom-punch negativo do
 * Game.tryClearCurrent, e os dois seguem para a porta leste.
 */
import { B3Shot } from './B3Shot.js';
import { dressRoom } from '../kit/rushKit.js';
import { clamp01, lerp } from '../anim.js';

const COLS = 16, ROWS = 11;
const SLAM_AT = 0.4;
const SPAWN_AT = 0.75;
const SWEEP_AT = 1.15;
const FOES = [
    { x: 780, y: 300, type: 'demon' }, { x: 860, y: 470, type: 'bloodMonster' },
    { x: 650, y: 560, type: 'demon' }, { x: 700, y: 210, type: 'demon' }
];
const KILL_BY = [2.0, 2.3, 2.6, 2.9];   // garantias (s de simulação)

export class LockShot extends B3Shot {
    constructor(stage) {
        super(stage, { cols: COLS, rows: ROWS, doors: { W: true, E: true }, seed: 72, ropeLen: 230 }, 4.6);
        this.label = 'LOCKED ROOMS';
    }

    setup(A) {
        const { p1, p2 } = A;
        dressRoom(A, { seed: 72, crates: 3, rubble: 12, loot: 2, banners: 2, blood: 7 });
        A.doorOpen = { W: 1, E: 1 };
        const yC = A.center.y;
        const doorW = A.doorList.find(d => d.dir === 'W') ?? { x: A.bounds.minX, y: yC };
        const doorE = A.doorList.find(d => d.dir === 'E') ?? { x: A.bounds.maxX, y: yC };

        // Saindo da porta oeste, corda na vertical (P1 em cima).
        A.initPlayer(p1, A.bounds.minX + 20, yC - 50, 3.2, 0);
        A.initPlayer(p2, A.bounds.minX + 14, yC + 60, 3.2, 0);
        A.both(p => { p.accel = 0.12; p.wobble = 0.2; });
        p1.goal = { x: 330, y: yC - 80, speed: 3 };
        p2.goal = { x: 320, y: yC + 80, speed: 3 };
        A.expr(p1, 'neutro'); A.expr(p2, 'neutro');
        A.minSpin = 0.4; A.saw.spin = 0.6;

        const S = this;
        S.phase = 'enter';
        S.lastT = S.unlockT = S.slamT = undefined;
        S._exit = false;
        S.foes = [];
        const alive = (skip) => S.foes.filter(f => f.state !== 'dying' && !f.isHidden && f !== skip).length;

        A.onKill = (e) => {
            if (alive(e) > 0) {
                A.renderer.triggerZoomPunch(0.03);
                A.exprFor(A.kills % 2 ? p1 : p2, 'furia', 0.4);
                return;
            }
            // ÚLTIMO inimigo: impacto grande.
            S.lastT = A.t;
            S.hitstop(0.1);
            A.slowmo(0.35, 0.25);
            A.renderer.triggerShake(18);
            A.renderer.triggerZoomPunch(0.07);
            A.impactFlash = 0.22;
            A.particles.triggerBlood(e.x, e.y, 18, 1.2);
            A.stage.audio?.duck(-8, 0.05, 0.5);
            A.stage.audio?.play('impact', { vol: 0.55 });
            A.both(p => { A.expr(p, 'espantado'); A.hop(p, 3.6); });
        };

        A.script = (t) => {
            // 1) As portas batem atrás deles (intro da sala).
            if (S.phase === 'enter' && t >= SLAM_AT) {
                S.phase = 'locked';
                S.slamT = t;
                A.renderer.triggerShake(14);
                A.renderer.triggerZoomPunch(0.06);
                for (const d of A.doorList) {
                    const out = d.dir === 'W' ? 1 : -1;
                    A.particles.triggerDust(d.x + out * 12, d.y - 20, out, 0, 16);
                    A.particles.triggerDust(d.x + out * 12, d.y + 20, out, 0, 16);
                    A.sfx('thud', d.x, d.y, { vol: 1, rate: 0.85 });
                }
                A.sfx('stoneClick', doorW.x, doorW.y, { vol: 0.7 });
                A.both(p => {
                    A.expr(p, 'assustado');
                    A.look(p, doorW.x);
                    A.hop(p, 2.6);
                    p.goal = { vx: 0, vy: 0, holdY: p.y };
                    p.brakeT = 0.2;
                });
            }
            if (S.slamT !== undefined && S.unlockT === undefined) {
                A.doorOpen.W = A.doorOpen.E = 1 - clamp01((t - S.slamT) / 0.08);
            }
            // 2) Inimigos nascem das chamas, congelados, e são liberados.
            if (S.phase === 'locked' && t >= SPAWN_AT) {
                S.phase = 'spawn';
                FOES.forEach((f, i) => {
                    const e = A.spawnEnemy(f.x, f.y, f.type, { speed: 0, chase: A.midTarget, stopDist: 0, intro: true });
                    e._i = i;
                    S.foes.push(e);
                });
                A.renderer.triggerShake(6);
                A.both(p => { A.look(p, 800); A.expr(p, 'preocupado'); });
            }
            // 3) Luta: atacam o meio da corda; a dupla varre a sala.
            if (S.phase === 'spawn' && t >= SWEEP_AT) {
                S.phase = 'fight';
                for (const e of S.foes) e.speed = 1.9 + e._i * 0.2;
                A.both(p => { A.expr(p, 'raiva'); p.faceX = null; });
                A.minSpin = 1;
            }
            if (S.phase === 'fight') {
                // Meio da corda avança e oscila; corda sempre de través.
                const u = t - SWEEP_AT;
                const mx = lerp(330, 640, clamp01(u / 1.6)) + Math.sin(u * 3.1) * 40;
                const my = yC + Math.sin(u * 2.3) * 70;
                const ang = Math.PI / 2 + Math.sin(u * 2.3) * 0.5;
                const h = 105;
                p1.goal = { follow: true, x: mx - Math.cos(ang) * h, y: my - Math.sin(ang) * h, gain: 0.2, max: 6 };
                p2.goal = { follow: true, x: mx + Math.cos(ang) * h, y: my + Math.sin(ang) * h, gain: 0.2, max: 6 };
                // Garantias: cada inimigo dá o bote no disco e morre até KILL_BY.
                for (const e of S.foes) {
                    if (e.state === 'dying' || e.isHidden) continue;
                    const by = KILL_BY[e._i];
                    if (!e._lunged && t > by - 0.3) { e._lunged = true; A.lunge(e, A.sawPos.x, A.sawPos.y, 7); }
                    if (t > by) A.killEnemy(e, 10);
                }
                if (S.lastT !== undefined) {
                    S.phase = 'clear';
                    A.both(p => { p.goal = { vx: 0, vy: 0, holdY: p.y }; p.brakeT = 0.3; });
                }
            }
            // 4) Sala limpa: as portas destravam (os corpos ainda caindo não contam).
            if (S.phase === 'clear' && S.unlockT === undefined && t > S.lastT + 0.3 && alive() === 0) {
                S.unlockT = t;
                S.unlockDoors(A);
                A.both(p => { A.expr(p, 'furia'); A.hop(p, 3); A.look(p, doorE.x); });
            }
            if (S.unlockT !== undefined) {
                A.doorOpen.W = A.doorOpen.E = clamp01((t - S.unlockT) / 0.25);
                // Seguem para a porta leste (a sala liberou a saída).
                if (!S._exit && t > S.unlockT + 0.3) {
                    S._exit = true;
                    p1.goal = { x: doorE.x - 150, y: doorE.y - 60, speed: 2.8 };
                    p2.goal = { x: doorE.x - 170, y: doorE.y + 60, speed: 2.8 };
                    A.both(p => { p.faceX = null; });
                }
            }

            // Câmera: colada na porta oeste na entrada, enquadra a luta,
            // e no fim abre puxando para a porta leste.
            const m = A.mid;
            let cam;
            if (S.phase === 'enter' || (S.phase === 'locked')) {
                cam = { x: doorW.x + 230, y: yC, zoom: 1.75, k: 0.1 };
            } else if (S.unlockT !== undefined) {
                cam = { x: lerp(m.x, doorE.x, 0.4), y: lerp(m.y, yC, 0.6), zoom: 1.4, k: 0.05 };
            } else {
                cam = { x: lerp(m.x, A.center.x, 0.45), y: lerp(m.y, yC, 0.5) - 10, zoom: 1.5, k: 0.08 };
            }
            S.frame(A, t, { ...cam, fit: [p1, p2, ...S.foes.filter(e => e.state !== 'dying')], pad: 120 });
        };
        A.snapCamera(doorW.x + 230, yC, 1.75 * A.zoomRef);
    }
}
