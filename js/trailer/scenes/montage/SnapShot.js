/**
 * Montagem 2 — um demônio dá o bote no meio da corda; os dois pulam cada um
 * para um lado, desengonçados, a corda ARREBENTA e eles são arremessados.
 * Close no P1 batendo na parede (tremor forte). A câmera recua e mostra a
 * serra largada no chão; a horda entra pela porta; os dois correm até a
 * serra desviando de dois botes; a serra RECONECTA (clarão + anel de luz) e
 * eles passam cortando a horda.
 */
import { ArenaShot } from '../../kit/ArenaShot.js';
import { lerp, clamp01 } from '../../anim.js';

export class SnapShot extends ArenaShot {
    constructor(stage) {
        super(stage, { cols: 18, rows: 11, doors: { E: true }, seed: 33, ropeLen: 190 }, 11);
    }

    get isDone() { return this.t >= this.duration || (this._doneAt !== undefined && this.t >= this._doneAt); }

    setup(A) {
        const { p1, p2 } = A;
        const door = { x: A.bounds.maxX, y: A.center.y };
        this.phase = 'run';
        this._doneAt = undefined;
        this._charging = false;
        this._chargeKills = 0;
        this.wallT = this.lookT = this.connT = this.snapT = undefined;
        const S = this;

        A.initPlayer(p1, 330, 285, 4, 0);
        A.initPlayer(p2, 330, 425, 4, 0);
        p1.goal = { vx: 4.2, vy: 0, holdY: 285 };
        p2.goal = { vx: 4.2, vy: 0, holdY: 425 };
        A.minSpin = 0.9;
        A.saw.spin = 1;
        A.expr(p1, 'furia'); A.expr(p2, 'furia');

        const lunger = A.spawnEnemy(720, 355, 'demon', { speed: 0, lookAt: A.midTarget });

        // --- Arremesso / parede ---
        A.onYank = () => {
            if (S.phase !== 'split') return;
            S.phase = 'thrown';
            S.snapT = A.t;
            A.snap();
            A.slowmo(0.35, 0.3);
            p1.airborne = true; p1.vx = -2.6; p1.vy = -12.5; p1.goal = null;
            p2.airborne = true; p2.vx = -1.8; p2.vy = 9.5; p2.goal = null;
            A.both(p => A.expr(p, 'espantado'));
        };
        A.onWallHit = (p) => {
            p.hurtTimer = 30;
            A.particles.triggerDust(p.x, p.y - 10, 0, 1, 18);
            if (p === p1) {
                S.wallT = A.t;
                A.renderer.triggerShake(30);
                A.impactFlash = 0.55;
                A.slowmo(0.3, 0.25);
                A.exprFor(p1, 'olhos_fechados', 0.5);
                A.expr(p1, 'raiva');
                const s = A.ws(p1.x, p1.y);
                A.lens.trigger(s.x, s.y, 1);
            } else {
                A.renderer.triggerShake(10);
                A.exprFor(p2, 'olhos_fechados', 0.35);
                A.expr(p2, 'preocupado');
            }
        };

        A.script = (t) => {
            const sawP = A.sawPos;

            // 1) Correndo; o demônio dá o bote no meio da corda.
            if (S.phase === 'run' && t > 0.42) {
                S.phase = 'split';
                A.lunge(lunger, A.mid.x, A.mid.y, 7);
                A.both(p => { A.hop(p, 5); A.expr(p, 'espantado'); p.accel = 0.35; p.wobble = 0.6; });
                p1.goal = { vx: -1.5, vy: -9 };
                p2.goal = { vx: -1.2, vy: 9 };
                A.renderer.triggerShake(6);
            }

            // Garantia: se o tranco não vier sozinho, a corda arrebenta mesmo assim.
            if (S.phase === 'split' && t > 1.0) A.onYank();
            // Garantia: se o P1 não tocar na parede, segue o roteiro.
            if (S.phase === 'thrown' && S.wallT === undefined && t > S.snapT + 1.2) S.wallT = t;

            // 2) Depois de bater na parede: levanta, sacode e procura a serra.
            if (S.phase === 'thrown' && S.wallT !== undefined && t > S.wallT + 0.9) {
                S.phase = 'look';
                S.lookT = t;
                p1.shiver = 0.6;
                A.both(p => { p.faceX = sawP.x; A.look(p, sawP.x); });
                // A horda entra pela porta.
                for (let i = 0; i < 8; i++) {
                    A.spawnEnemy(door.x + 70 + (i % 3) * 50 + Math.random() * 30, door.y + ((i * 37) % 80) - 40,
                        i % 3 === 2 ? 'bloodMonster' : 'demon',
                        { speed: 1.25, goal: { x: sawP.x + 260, y: sawP.y }, stopDist: 40 + i * 12, entering: true });
                }
                A.renderer.triggerShake(8);
            }
            if (S.phase === 'look' && t > S.lookT + 0.45) {
                S.phase = 'dash';
                p1.shiver = 0;
                A.both(p => { p.faceX = null; p.accel = 0.16; p.wobble = 0.35; A.expr(p, 'assustado'); });
                p1.goal = { x: sawP.x - 10, y: sawP.y - 55, speed: 4.8 };
                p2.goal = { x: sawP.x + 10, y: sawP.y + 55, speed: 4.8 };
                // Dois demônios surgem no caminho de cada um.
                for (const p of [p1, p2]) {
                    const k = 0.55;
                    const ex = lerp(p.x, sawP.x, k) + 26, ey = lerp(p.y, sawP.y, k);
                    const e = A.spawnEnemy(ex, ey, 'demon', { speed: 0.3, chase: p, intro: true });
                    e._target = p; e._armed = true;
                }
            }
            if (S.phase === 'dash') {
                for (const e of A.enemies) {
                    const p = e._target;
                    if (!e._armed || !p) continue;
                    if (Math.hypot(p.x - e.x, p.y - e.y) < 95) {
                        e._armed = false;
                        if (e.frozen) { e.unfreeze(); e.spawnFx = 0; }
                        A.lunge(e, p.x, p.y, 6.5);
                        // Desvio: passo lateral desengonçado + pulinho.
                        const side = p === p1 ? -1 : 1;
                        A.swerve(p, -3.5, side * 2.5, 0.28);
                        A.hop(p, 5);
                        A.exprFor(p, 'espantado', 0.5);
                        e.chase = null; e.goal = { x: e.x + 40, y: e.y };
                    }
                }
                // Chegaram na serra: reconexão!
                const near = Math.hypot(p1.x - sawP.x, p1.y - sawP.y) < 85 && Math.hypot(p2.x - sawP.x, p2.y - sawP.y) < 85;
                if (near || t > S.lookT + 3.5) {
                    S.phase = 'connected';
                    S.connT = t;
                    A.reconnect();
                    A.slowmo(0.45, 0.3);
                    A.both(p => { A.expr(p, 'furia'); A.hop(p, 4); });
                }
            }
            // 3) Conectados: atravessam a horda cortando tudo.
            if (S.phase === 'connected' && t > S.connT + 0.35 && !S._charging) {
                S._charging = true;
                const y = sawP.y;
                p1.goal = { vx: 5.4, vy: 0, holdY: y - 85 };
                p2.goal = { vx: 5.4, vy: 0, holdY: y + 85 };
                A.both(p => { p.accel = 0.1; p.wobble = 0.05; });
                for (const e of A.enemies) { e.goal = null; e.chase = A.midTarget; e.speed = 1.8; e.stopDist = 0; }
            }
            // Corta logo depois do ÚLTIMO abate (antes de chegarem na parede).
            // Garantia: se sobrar alguém, corta ao se aproximarem da parede.
            if (S._charging && S._doneAt === undefined) {
                const alive = A.enemies.filter(e => e.state !== 'dying').length;
                if ((alive === 0 && S._chargeKills > 0) || p1.x > A.bounds.maxX - 300) S._doneAt = S.t + 0.3;
            }

            S._camera(A, t);
        };
        A.onKill = () => {
            if (S._charging) S._chargeKills++;
            if (A.kills === 1) { A.slowmo(0.25, 0.3); A.renderer.triggerZoomPunch(0.05); }
        };
        A.snapCamera(A.mid.x + 60, A.mid.y, 1.9 * A.zoomRef, -0.12);
    }

    _camera(A, t) {
        const { p1, p2 } = A;
        const sawP = A.sawPos;
        if (this.phase === 'run' || this.phase === 'split') {
            A.focus({ x: A.mid.x + 70, y: A.mid.y, zoom: 2.0, rot: -0.12, k: 0.12, fit: [p1, p2] });
        } else if (this.phase === 'thrown' || (this.phase === 'look' && t < this.lookT + 0.2)) {
            // Close bem perto do P1 voando até a parede.
            A.focus({ x: p1.x, y: p1.y - 20, zoom: 4.4, rot: 0.14, k: 0.22 });
        } else if (this.phase === 'look' || this.phase === 'dash') {
            // Recua: mostra a serra no chão, os dois e a horda chegando.
            A.focus({ x: sawP.x + 60, y: sawP.y, zoom: 2.2, rot: lerp(0.1, -0.1, clamp01((t - this.lookT) / 2)), k: 0.07, fit: [p1, p2, sawP], pad: 140 });
        } else {
            A.focus({ x: A.mid.x + 120, y: A.mid.y, zoom: 2.1, rot: lerp(-0.1, 0.12, clamp01((t - this.connT) / 2.5)), k: 0.1, fit: [p1, p2] });
        }
    }
}
