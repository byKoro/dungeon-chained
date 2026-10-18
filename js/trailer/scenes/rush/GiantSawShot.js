/**
 * Desespero 4 — SERRA GIGANTE (fim da sequência).
 *
 * Fugindo de uma horda, os dois correm para a esquerda e ESBARRAM na parede.
 * A horda fecha um semicírculo em volta. Closes rápidos: um com raiva, o
 * outro com fúria. Eles esticam a corda ao máximo em direções opostas (a
 * serra pisca de tensão) e a serra CRESCE até engolir o semicírculo inteiro,
 * serrando todos de uma vez. Por fim o drone mergulha na serra gigante, que
 * enche a tela — gancho para a próxima cena.
 *
 * Última cena (por enquanto): fica em loop na serra girando.
 */
import { RushShot, dressRoom, handheld } from '../../kit/rushKit.js';
import { lerp, clamp01, easeIn, easeInOut } from '../../anim.js';

const SPEED = 6.2;
const GROW_DUR = 0.85;
const BIG = 8.6;          // escala final do disco (raio ~275 px de mundo)
const ZOOM_DUR = 1.7;

const backOut = (v, s = 1.6) => { const u = v - 1; return 1 + (s + 1) * u * u * u + s * u * u; };

export class GiantSawShot extends RushShot {
    constructor(stage) {
        super(stage, { cols: 20, rows: 13, doors: { E: true }, seed: 91, ropeLen: 230 }, 99);
    }

    get isDone() { return false; }
    get reachedEnd() { return this._zoomT !== undefined && this.arena.t > this._zoomT + ZOOM_DUR + 0.3; }

    setup(A) {
        const { p1, p2 } = A;
        const S = this;
        const b = A.bounds, cy = A.center.y;
        this.phase = 'flee';
        this._zoomT = undefined;
        let tW = 0, tT = 0, tS = 0, tG = 0;
        A.ropeLen = 230;
        A.sawScale = 1;
        A.saw.setStrain(0);
        A.red = 0.7; A.redHz = 2.4;
        dressRoom(A, { seed: 91, crates: 3, rubble: 14, loot: 2, banners: 3, blood: 12 });

        A.initPlayer(p1, 700, cy - 70, -SPEED, 0);
        A.initPlayer(p2, 720, cy + 70, -SPEED, 0);
        p1.goal = { vx: -SPEED, vy: 0, holdY: cy - 70 };
        p2.goal = { vx: -SPEED, vy: 0, holdY: cy + 70 };
        A.both(p => { p.accel = 0.22; p.wobble = 0.45; A.expr(p, 'assustado'); });
        A.minSpin = 0.8; A.saw.spin = 0.9;

        // Horda logo atrás (parte entrando pela porta leste).
        const C = { x: b.minX + 150, y: cy };
        const horde = [];
        for (let i = 0; i < 15; i++) {
            const e = A.spawnEnemy(930 + (i % 5) * 70 + (i / 5 | 0) * 40, cy + ((i * 53) % 300) - 150,
                i % 4 === 2 ? 'bloodMonster' : 'demon',
                { speed: 5.0 + (i % 3) * 0.3, chase: A.midTarget, stopDist: 90 + (i % 4) * 30, entering: true });
            horde.push(e);
        }
        // Lugares do semicírculo em volta deles (todos dentro do alcance da serra gigante).
        const slots = horde.map((e, i) => {
            const ring = i % 3, a = lerp(-1.25, 1.25, ((i * 7) % 15) / 14);
            const r = 175 + ring * 42;
            return { x: C.x + 40 + Math.cos(a) * r, y: C.y + Math.sin(a) * r * 1.05 };
        });

        A.onKill = () => {
            if (S.phase === 'grow' && !S._slowed) {
                S._slowed = true;
                A.slowmo(0.7, 0.3);
                A.renderer.triggerShake(30);
                A.impactFlash = 0.5;
            }
        };
        S._slowed = false;

        A.script = (t) => {
            const m = A.mid;
            // 1) Fogem e ESBARRAM na parede.
            if (S.phase === 'flee' && m.x < b.minX + 40) {
                S.phase = 'wall'; tW = t;
                A.renderer.triggerShake(26);
                A.impactFlash = 0.4;
                A.slowmo(0.3, 0.3);
                A.both(p => {
                    p.goal = null; p.vx = 3.4; p.stumble = 0.25; p.hurtTimer = 24;
                    A.particles.triggerDust(p.x - 10, p.y, 1, 0, 14);
                    A.exprFor(p, 'olhos_fechados', 0.3);
                    A.expr(p, 'espantado');
                });
                const s = A.ws(p1.x, p1.y);
                A.lens.trigger(s.x, s.y, 0.8);
            }
            // 2) Viram para a horda, que fecha o semicírculo.
            if (S.phase === 'wall' && t > tW + 0.45) {
                S.phase = 'trapped'; tT = t;
                p1.goal = { x: b.minX + 80, y: cy - 66, speed: 2 };
                p2.goal = { x: b.minX + 80, y: cy + 66, speed: 2 };
                A.both(p => { p.faceX = C.x + 400; p.shiver = 0.4; A.expr(p, 'assustado'); });
                horde.forEach((e, i) => { e.chase = null; e.goal = slots[i]; e.speed = 3; e.lookAt = m; });
                A.renderer.triggerShake(8);
            }
            if (S.phase === 'trapped') {
                const u = t - tT;
                // Botes curtos de ameaça.
                if (((t * 60) | 0) % 20 === 0) {
                    const e = horde[(Math.random() * horde.length) | 0];
                    if (e.state !== 'dying' && u > 0.3) A.lunge(e, m.x, m.y, 2.2);
                }
                if (u > 0.5 && u < 0.52) { p1.shiver = 0; A.expr(p1, 'raiva'); A.renderer.triggerShake(6); }
                if (u > 0.95 && u < 0.97) { p2.shiver = 0; A.expr(p2, 'furia'); A.renderer.triggerShake(6); }
                if (u > 1.3) {
                    // 3) Esticam a corda em direções opostas.
                    S.phase = 'stretch'; tS = t;
                    A.ropeLen = 720;
                    p1.goal = { x: b.minX + 150, y: b.minY + 34, speed: 8 };
                    p2.goal = { x: b.minX + 150, y: b.maxY - 16, speed: 8 };
                    A.both(p => { p.accel = 0.3; p.faceX = null; A.expr(p, 'furia'); A.hop(p, 4); });
                    A.minSpin = 1;
                    A.renderer.triggerShake(12);
                }
            }
            if (S.phase === 'stretch') {
                A.saw.setStrain(clamp01((t - tS) / 0.5));
                if (((t * 60) | 0) % 4 === 0) A.renderer.triggerShake(4 + 6 * clamp01((t - tS) / 0.5));
                if (t > tS + 0.55) {
                    // 4) A serra CRESCE e engole o semicírculo.
                    S.phase = 'grow'; tG = t;
                    A.saw.setStrain(0);
                    A.connectFlash = 1; A._connectAt = { ...A.sawPos };
                    A.renderer.triggerShake(24);
                    A.renderer.triggerZoomPunch(-0.06);
                    A.red = 1;
                }
            }
            if (S.phase === 'grow' || S.phase === 'zoom') {
                const u = clamp01((t - tG) / GROW_DUR);
                A.sawScale = 1 + (BIG - 1) * backOut(easeIn(u) ** 0.6, 1.2);
                const sp = A.sawPos, R = A.saw.discRadius * A.sawScale;
                A.particles.triggerSparks(sp.x, sp.y, R, -1, 3);
                // Garantia: no auge ninguém escapa (quem ficou na borda também vai).
                if (u >= 1) for (const e of A.enemies) A.killEnemy(e, 10);
                if (((t * 60) | 0) % 3 === 0) A.renderer.triggerShake(5 + 8 * (1 - u));
                // Os dois seguram firme nas pontas.
                A.both(p => { p.goal = { follow: true, x: b.minX + 150, y: p === p1 ? b.minY + 34 : b.maxY - 16, gain: 0.3, max: 6 }; });
            }
            if (S.phase === 'grow' && t > tG + GROW_DUR + 0.6) {
                // 5) Mergulho na serra gigante.
                S.phase = 'zoom'; S._zoomT = t;
                S._z0 = { x: A.renderer.camX, y: A.renderer.camY, z: A.renderer.zoom, rot: A.rot };
            }

            S._camera(A, t, { tW, tT, tS, tG });
        };
        A.snapCamera(800, cy, 2.3 * A.zoomRef, 0.36);
    }

    _camera(A, t, { tT }) {
        const { p1, p2 } = A;
        const h = handheld(t, 1.3);
        const m = A.mid;
        const ph = this.phase;
        if (ph === 'flee' || ph === 'wall') {
            // À frente deles, horda no quadro atrás (direita).
            A.focus({ x: m.x + 220 + h.x, y: m.y + h.y, zoom: 2.0, rot: lerp(0.36, 0.08, clamp01(t / 1.6)) + h.r, k: 0.15, fit: [p1, p2], pad: 70 });
        } else if (ph === 'trapped') {
            const u = t - tT;
            // Closes rápidos (chicote do drone): vermelho, azul, depois os dois.
            if (u < 0.5) A.focus({ x: m.x + 120 + h.x, y: m.y + h.y, zoom: 2.0, rot: -0.12 + h.r, k: 0.16 });
            else if (u < 0.95) A.focus({ x: p1.x + 10, y: p1.y - 14, zoom: 3.8, rot: 0.22, k: 0.3 });
            else A.focus({ x: p2.x + 10, y: p2.y - 14, zoom: 3.8, rot: -0.24, k: 0.3 });
        } else if (ph === 'stretch' || ph === 'grow') {
            const sp = A.sawPos;
            A.focus({ x: sp.x + 170 + h.x, y: sp.y + h.y, zoom: 1.7, rot: 0.1 * Math.sin(t * 2) + h.r, k: 0.12, fit: [p1, p2], pad: 90 });
        } else {
            // Mergulho: zoom exponencial no centro do disco, girando.
            const z0 = this._z0, sp = A.sawPos;
            const u = easeInOut(clamp01((t - this._zoomT) / ZOOM_DUR));
            // O disco passa um pouco da diagonal da tela (enche o quadro).
            const R = A.saw.discRadius * A.sawScale;
            const zEnd = 1.05 * Math.hypot(A.canvas.width, A.canvas.height) / (2 * R);
            const lz = Math.log(z0.z) + (Math.log(zEnd) - Math.log(z0.z)) * u;
            A.setCam(lerp(z0.x, sp.x, u) + h.x * 0.3, lerp(z0.y, sp.y, u) + h.y * 0.3, Math.exp(lz), z0.rot + u * 0.9 + (t - this._zoomT) * 0.05);
        }
    }
}
