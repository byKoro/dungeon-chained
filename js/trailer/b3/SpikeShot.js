/**
 * Clipe 2 — ESPINHOS E FLECHAS ("Tem corredor com espinhos e flechas, onde
 * um passo errado dele te arrasta pro perigo.").
 *
 * Corredor com uma faixa de espinhos (SpikeTrap reais, em onda) entre duas
 * faixas seguras e um atirador de flechas (ArrowTrap real) na parede leste.
 * Os dois andam para a direita pela faixa de baixo: o P1 na frente, mais
 * embaixo (fora da linha da flecha); o P2 atrás, bem na altura dela. A flecha
 * passa raspando pelo P1 e chega no P2, que pula para CIMA atravessando os
 * espinhos ainda recolhidos — e a corda estica e arrasta o P1 para dentro da
 * faixa bem quando os espinhos da frente sobem: dano real
 * (Player.takeDamage: pose de dano, empurrão, invulnerável piscando) + flash
 * vermelho, tremor e hit-stop (nível médio). O P1 atravessa o resto da faixa
 * piscando e olha feio para o P2.
 */
import { B3Shot } from './B3Shot.js';
import { ArenaHazards } from './arenaHazards.js';
import { dressRoom } from '../kit/rushKit.js';

const COLS = 17, ROWS = 9;
const STRIP = { r0: 4, r1: 5, c0: 3, c1: 14 };   // faixa de espinhos (2 linhas)
const P1_Y = 490;            // P1: faixa de baixo, abaixo da linha da flecha (y 416)
const P2_Y = 440;            // P2: na altura da flecha
const TOP_Y = 120;           // faixa segura de cima (para onde o P2 pula)
const DODGE_DIST = 120;      // px da flecha até o P2 para o desvio
const WALK = 1.8;
const HURT_GUARANTEE = 2.4;
const DEBUG = false;        // true = log de cada dano no console
// Ciclo real do SpikeTrap: [escondido, subindo, subindo, exposto] (s).
const SPIKE_CYCLE = [6, 0.15, 0.15, 1.2];
const LETHAL = SPIKE_CYCLE[0] + SPIKE_CYCLE[1] + SPIKE_CYCLE[2];
// s depois do desvio até cada linha ficar letal (5 = de baixo).
const ROW_DELAY = { 5: 0.55, 4: 0.72 };

export class SpikeShot extends B3Shot {
    constructor(stage) {
        super(stage, { cols: COLS, rows: ROWS, doors: { W: true, E: true }, seed: 58, ropeLen: 220 }, 3.6);
        this.label = 'SPIKES & ARROWS';
        const hz = this.hz = new ArenaHazards(this.arena);
        // Espinhos recolhidos até o desvio; aí sobem em onda, da linha de
        // baixo para a de cima, logo atrás do P2 (ver _armSpikes).
        for (let c = STRIP.c0; c <= STRIP.c1; c++) {
            for (let r = STRIP.r0; r <= STRIP.r1; r++) hz.spike(c, r, { durations: SPIKE_CYCLE });
        }
        // Flecha na linha 6 (y 416), a cada 1,5 s.
        hz.trap('E', 6, { fireAt: 0.02 });
    }

    setup(A) {
        const { p1, p2 } = A;
        dressRoom(A, {
            seed: 58, crates: 1, rubble: 8, loot: 1, banners: 2, blood: 4,
            avoid: (c, r) => r >= STRIP.r0 - 1 && r <= ROWS - 2
        });

        A.initPlayer(p1, 770, P1_Y);
        A.initPlayer(p2, 590, P2_Y);
        A.both(p => { p.accel = 0.12; p.wobble = 0.2; p.goal = { vx: WALK, vy: 0, holdY: p.y }; });
        A.expr(p1, 'neutro');
        A.expr(p2, 'neutro');
        A.minSpin = 0.5; A.saw.spin = 0.6;

        const S = this;
        S.phase = 'walk';
        S.hurtT = S.dodgeT = S._climbAt = undefined;
        S._climb = S._glare = S._dragged = S._seen = false;
        this.onHurtExtra = (p) => {
            if (p !== p1 || S.hurtT !== undefined) return;
            S.hurtT = A.t;
            S.phase = 'hurt';
            A.renderer.triggerZoomPunch(0.04);
            A.expr(p1, 'assustado');
            // O P2 para e olha para trás; o P1 (piscando, invulnerável)
            // atravessa o resto da faixa até o parceiro.
            p2.goal = { vx: 0, vy: 0, holdY: TOP_Y };
            p2.brakeT = 0.3;
            p1.accel = 0.3;              // o empurrão do dano não vira um voo
            S._climbAt = A.t + 0.2;
        };

        A.script = (t) => {
            const arrow = S.hz.arrows[0];
            // A flecha passa raspando pelo P1 (ele se encolhe).
            if (!S._seen && arrow && arrow.x - p1.x < 60) {
                S._seen = true;
                A.exprFor(p1, 'espantado', 0.4);
                A.hop(p1, 2);
            }
            // 1) A flecha chega no P2: ele pula para cima, atravessando a faixa.
            if (S.phase === 'walk' && arrow && arrow.x > p2.x && arrow.x - p2.x < DODGE_DIST) {
                S.phase = 'dodge';
                S.dodgeT = t;
                A.swerve(p2, 0.4, -3, 0.3);
                A.hop(p2, 6.2);
                p2.goal = { vx: 0.4, vy: -6.2 };
                p2.accel = 0.3;
                A.expr(p2, 'espantado');
                A.sfx('whoosh', p2.x, p2.y, { vol: 0.4, rate: 1.4 });
                p1.goal = { vx: 0.8, vy: 0, holdY: P1_Y };
                S._armSpikes(p2.x);
            }
            // P2 "segue a vida" na faixa de cima.
            if (S.phase === 'dodge' && p2.y < TOP_Y + 40) p2.goal = { vx: 0.4, vy: 0, holdY: TOP_Y };
            // A corda estica: o P1 é arrastado para dentro da faixa.
            if (S.phase === 'dodge' && !S._dragged && Math.hypot(p2.x - p1.x, p2.y - p1.y) > A.ropeLen - 4) {
                S._dragged = true;
                A.renderer.triggerShake(3);
                A.expr(p1, 'assustado');
                p1.stumble = 0.3;
                p1.tiltKick = -0.4;
                A.particles.triggerDust(p1.x, p1.y + 18, 0, 1, 8);
            }
            // Garantia: se os espinhos não pegarem, o mais perto pega.
            if (S.phase === 'dodge' && t > HURT_GUARANTEE) {
                let best = null, bd = Infinity;
                for (const s of S.hz.spikes) {
                    const d = Math.hypot(s.x - p1.x, s.y - p1.y);
                    if (d < bd) { bd = d; best = s; }
                }
                if (best) p1.takeDamage(best.x, best.y);
            }
            // 2) Depois do dano: sai da faixa e fecha a cara para o P2.
            if (S._climbAt !== undefined && t > S._climbAt && !S._climb) {
                S._climb = true;
                p1.goal = { x: p2.x + 120, y: TOP_Y + 40, speed: 4.2 };
                p1.accel = 0.2;
            }
            if (S.hurtT !== undefined && !S._glare && t > S.hurtT + 0.9) {
                S._glare = true;
                p1.faceX = p2.x;
                p2.faceX = p1.x;
                A.expr(p1, 'raiva');
                A.expr(p2, 'preocupado');
                A.hop(p2, 2.4);
            }

            // Câmera: enquadra os dois e a faixa de espinhos.
            const m = A.mid;
            const after = S._climb && t > S._climbAt + 0.6;
            S.frame(A, t, {
                x: m.x, y: after ? Math.max(190, m.y + 30) : Math.max(250, Math.min(330, m.y)),
                zoom: after ? 1.8 : S.hurtT !== undefined ? 1.62 : 1.5, k: 0.08, fit: [p1, p2], pad: 140
            });
        };
        A.snapCamera((p1.x + p2.x) / 2, 330, 1.5 * A.zoomRef);
    }

    // A armadilha "arma" com o pulo do P2: cada espinho entra no ciclo real
    // de forma a subir (frames de aviso) e ficar letal ROW_DELAY s depois,
    // com uma onda leve a partir da coluna do pulo.
    _armSpikes(x0) {
        for (const s of this.hz.spikes) {
            const row = Math.floor(s.y / 64), col = s.x / 64;
            const delay = ROW_DELAY[row] + Math.abs(col - x0 / 64) * 0.025;
            s.elapsed = LETHAL - delay;
        }
    }

    onHurt(A, p) {
        super.onHurt(A, p);
        if (DEBUG) {
            console.log(`[spike] dano ${p === A.p1 ? 'P1' : 'P2'} t=${A.t.toFixed(2)} pos=(${p.x | 0},${p.y | 0})`);
        }
        this.onHurtExtra?.(p);
    }
}
