/**
 * Desespero 1 — CHUVA DE FLECHAS.
 *
 * Continua o mergulho da geração de mapas: a câmera cai lá de cima na sala
 * (zoom contínuo) até colar nos dois, que correm para a ESQUERDA com uma
 * revoada de flechas vindo de trás. O drone fica à frente deles e deixa o
 * lado direito do quadro livre para as flechas. Flechas cravam no chão em
 * volta, passam raspando (pulinhos, caretas), espetam demônios no caminho.
 * No fim a revoada fica tão densa que COBRE a tela (ArrowWipe) e vira a
 * transição para a próxima cena.
 */
import { RushShot, dressRoom, handheld } from '../../kit/rushKit.js';
import { ArrowWipe } from '../../fx/ArrowWipe.js';
import { lerp, clamp01, easeInOut, hash01 } from '../../anim.js';

const SPEED = 6.3;
const DIVE = 1.0;        // s do mergulho
const WIPE_AT = 3.9;     // s (simulação) em que a cortina começa

export class ArrowRunShot extends RushShot {
    constructor(stage) {
        super(stage, { cols: 36, rows: 11, doors: { W: true }, seed: 71, ropeLen: 200 }, 9);
        this.cutIn = null;   // continua o mergulho do mapa (sem corte)
    }

    get isDone() { return !!this.wipe && this.wipe.covered; }

    setup(A) {
        const { p1, p2 } = A;
        const S = this;
        this.wipe = null;
        A.renderer.screenShake = 0;
        dressRoom(A, { seed: 71, crates: 4, rubble: 18, loot: 3, banners: 4, blood: 12 });

        const cy = A.center.y;
        const x0 = A.bounds.maxX - 300;
        A.initPlayer(p1, x0, cy - 78, -SPEED, 0);
        A.initPlayer(p2, x0 + 20, cy + 82, -SPEED, 0);
        p1.goal = { vx: -SPEED, vy: 0, holdY: cy - 78 };
        p2.goal = { vx: -SPEED, vy: 0, holdY: cy + 82 };
        A.both(p => { p.accel = 0.2; p.wobble = 0.4; A.expr(p, 'assustado'); });
        A.minSpin = 0.8; A.saw.spin = 0.9;
        A.arrowsKill = true;
        A.red = 0;
        A.impactFlash = 0.9;    // sai do clarão do mergulho

        // Demônios no caminho (as flechas os espetam antes da serra chegar).
        const foes = [];
        for (let i = 0; i < 4; i++) {
            const e = A.spawnEnemy(x0 - 700 - i * 230, cy + (i % 2 ? 150 : -150) + (hash01(i) - 0.5) * 60,
                i === 2 ? 'bloodMonster' : 'demon', { speed: 1.1, chase: A.midTarget, stopDist: 30 });
            foes.push(e);
        }

        // Câmera: começa com a sala inteira (continuação do mergulho do mapa).
        const W = A.canvas.width, H = A.canvas.height;
        const zFit = Math.min(W / A.rect.w, H * 0.8 / A.rect.h);
        const camStart = { x: A.center.x, y: A.center.y, z: zFit, rot: 0.32 };
        const camAt = (t) => {
            const m = A.mid, z = lerp(2.25, 2.7, clamp01(t / 3.6)) * A.zoomRef * A.camClose;
            const h = handheld(t, 1.2);
            // À frente dos dois, com o lado direito livre para as flechas.
            return {
                x: m.x + (W * 0.2) / z + h.x, y: m.y - 10 + h.y, z,
                rot: lerp(-0.2, 0.14, easeInOut(clamp01((t - 0.6) / 3.2))) + h.r
            };
        };
        A.setCam(camStart.x, camStart.y, camStart.z, camStart.rot);

        let nextArrow = 0.35, nextClose = 0.9, closeN = 0, nextShake = 0;
        A.onKill = (e) => {
            A.slowmo(0.16, 0.35);
            A.renderer.triggerZoomPunch(0.04);
            A.both(p => A.exprFor(p, 'espantado', 0.35));
        };

        A.script = (t) => {
            // --- Câmera: mergulho -> drone colado ---
            const g = camAt(t);
            if (t < DIVE) {
                const u = easeInOut(t / DIVE);
                const r = A.renderer;
                const lz = Math.log(camStart.z) + (Math.log(g.z) - Math.log(camStart.z)) * u;
                A.setCam(lerp(camStart.x, g.x, u), lerp(camStart.y, g.y, u), Math.exp(lz), lerp(camStart.rot, g.rot, u));
                if (t > DIVE - 0.02) r.zoom = g.z;
            } else {
                A.camGoal = { x: g.x, y: g.y, zoom: g.z, rot: g.rot, k: 0.16 };
            }
            A.red = clamp01((t - 0.8) / 1.2) * 0.75;

            // --- Flechas vindo de trás (direita), cada vez mais densas ---
            const r = A.renderer;
            const z = r.zoom;
            const right = Math.min(A.bounds.maxX + 40, r.camX + (W * 0.75) / z + 80);
            const left = r.camX - (W * 0.6) / z;
            const rate = t < WIPE_AT - 0.5 ? 5 + 22 * clamp01((t - 0.3) / 3) : 60;
            while (t >= nextArrow) {
                nextArrow += 1 / rate;
                const y = A.bounds.minY + 20 + Math.random() * (A.bounds.maxY - A.bounds.minY - 30);
                // Evita atravessar o corpo deles (passa por cima/baixo).
                if (Math.abs(y - p1.y) < 26 || Math.abs(y - p2.y) < 26) continue;
                const vx = -(17 + Math.random() * 7);
                const stick = Math.random() < 0.42;
                A.fireArrow(right + Math.random() * 120, y, vx, 0, stick
                    ? { stopX: lerp(left, A.mid.x + 260, Math.random()), stuckDur: 2.6 + Math.random() } : {});
            }
            // Passa-raspando: flecha logo à frente/atrás de um deles.
            if (t >= nextClose && t < WIPE_AT) {
                nextClose += 0.42 + Math.random() * 0.2;
                const p = closeN++ % 2 ? p2 : p1;
                const dy = (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 10);
                A.fireArrow(right, p.y + dy, -26, 0, { stopX: p.x - 120 - Math.random() * 120, stuckDur: 2.5 });
                A.hop(p, 4.5);
                A.exprFor(p, 'espantado', 0.4);
                A.look(p, p.x + 300);
                A.swerve(p, -2, -Math.sign(dy) * 2.5, 0.2);
                A.renderer.triggerShake(5);
            }
            // Mira nos demônios do caminho (espeta cada um).
            for (const e of foes) {
                if (e.state === 'dying' || e._shot) continue;
                if (e.x > left + 120 && e.x < A.mid.x - 140) {
                    e._shot = true;
                    A.fireArrow(right, e.y + 4, -30);
                }
            }
            // Olhadas para trás e tremido constante.
            if (t >= nextShake) {
                nextShake += 0.22;
                A.renderer.triggerShake(2.5 + 5 * clamp01((t - 1) / 3));
                const p = Math.random() < 0.5 ? p1 : p2;
                if (Math.random() < 0.35) { A.look(p, p.x + 400); A.exprFor(p, 'olhando_direita', 0.3); }
            }
            // --- Revoada final: cobre a tela e vira transição ---
            if (t >= WIPE_AT && !S.wipe) {
                S.wipe = new ArrowWipe(A.arrowSprite);
                S.stage.overlay = S.wipe;
                A.both(p => { A.expr(p, 'espantado'); A.hop(p, 5); });
                A.renderer.triggerShake(16);
            }
        };
    }
}
