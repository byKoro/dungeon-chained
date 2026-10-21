/**
 * Clipe 0 — ABERTURA ("E todo o resto do jogo foi pensado pra testar essa
 * corrente.").
 *
 * Close na corrente: o P2 sai na frente, a corda estica entre os dois e dá
 * um tranco leve (nível pequeno: tremor 3). A câmera recua devagar e revela a
 * sala à frente: o buraco, a fileira de espinhos subindo e descendo, o
 * atirador de flechas na parede e a porta trancada com os dois botões — tudo
 * o que os próximos clipes vão testar.
 */
import { B3Shot } from './B3Shot.js';
import { ArenaHazards } from './arenaHazards.js';
import { dressRoom } from '../kit/rushKit.js';
import { clamp01, easeInOut, lerp } from '../anim.js';

const COLS = 18, ROWS = 13;
const PIT = { c0: 2, c1: 5, r0: 4, r1: 7 };         // buraco à esquerda
const SPIKES = { c0: 12, c1: 15, r0: 5, r1: 6 };    // fileira de espinhos à direita
const PULL_BACK = 0.55;   // s: começa a revelar a sala

export class OpenShot extends B3Shot {
    constructor(stage) {
        super(stage, { cols: COLS, rows: ROWS, doors: { N: true }, seed: 33, ropeLen: 210 }, 2.5);
        this.label = 'EVERYTHING TESTS THE CHAIN';
        const hz = this.hz = new ArenaHazards(this.arena);
        for (let c = SPIKES.c0; c <= SPIKES.c1; c++) {
            for (let r = SPIKES.r0; r <= SPIKES.r1; r++) {
                hz.spike(c, r, { phase: 0.55 + (c - SPIKES.c0) * 0.11 + (r - SPIKES.r0) * 0.04 });
            }
        }
        hz.trap('E', 3, { fireAt: 1.15 });
        hz.button(6, 2).button(11, 2);
        this._built = false;
    }

    setup(A) {
        const { p1, p2 } = A;
        if (!this._built) {
            this._built = true;
            const cells = [];
            for (let r = PIT.r0; r <= PIT.r1; r++) for (let c = PIT.c0; c <= PIT.c1; c++) cells.push([c, r]);
            A.setHoles(cells);
        }
        const inBox = (c, r, b, m = 1) => c >= b.c0 - m && c <= b.c1 + m && r >= b.r0 - m && r <= b.r1 + m;
        dressRoom(A, {
            seed: 33, crates: 2, rubble: 10, loot: 1, banners: 2, blood: 5,
            avoid: (c, r) => inBox(c, r, SPIKES) || (r <= 3 && c >= 5 && c <= 12) || (c >= 7 && c <= 10)
        });
        A.doorOpen = { N: 0 };

        const y0 = 690;
        A.initPlayer(p1, 548, y0);
        A.initPlayer(p2, 640, y0 - 6);
        p1.faceX = 900; p2.faceX = 900;
        A.both(p => { p.accel = 0.12; p.wobble = 0.25; });
        A.expr(p1, 'desconfiado');
        A.expr(p2, 'olhando_cima');
        // P2 sai na frente (subindo em diagonal); o P1 demora a reagir.
        p2.goal = { vx: 1.2, vy: -2.6 };
        A.minSpin = 0.4; A.saw.spin = 0.4;

        const S = this;
        S._yanked = S._p1Go = S._look = false;
        A.onYank = () => {
            if (S._yanked) return;
            S._yanked = true;
            // Tranco pequeno: a corda estica e puxa o P1.
            A.renderer.triggerShake(3);
            A.hop(p1, 2.4);
            p1.tiltKick = 0.35;
            A.exprFor(p1, 'espantado', 0.35);
        };

        const sp0 = A.sawPos;
        A.snapCamera(sp0.x, sp0.y - 30, 3.3 * A.zoomRef);

        A.script = (t) => {
            // O P1 vai atrás depois do tranco (garantia de tempo).
            if (!S._p1Go && (S._yanked || t > 0.45)) {
                S._p1Go = true;
                p1.faceX = null;
                p1.goal = { vx: 0.5, vy: -2.4 };
                p2.goal = { vx: 0.2, vy: -2.3 };
                A.expr(p1, 'preocupado');
            }
            if (t > 1.5 && !S._look) {
                S._look = true;
                A.look(p2, 900);       // olha os espinhos
                A.look(p1, 200);       // olha o buraco
            }

            // Câmera: colada na corda -> recua revelando a sala inteira.
            const sp = A.sawPos;
            if (t < PULL_BACK) {
                S.frame(A, t, { x: sp.x, y: sp.y - 30, zoom: 3.3, k: 0.2, amp: 0.2 });
            } else {
                const k = easeInOut(clamp01((t - PULL_BACK) / 1.6));
                S.frame(A, t, {
                    x: lerp(sp.x, A.center.x, k), y: lerp(sp.y - 30, A.center.y - 46, k),
                    zoom: lerp(3.3, 1.08, k), k: 0.12, amp: 0.3
                });
            }
        };
    }
}
