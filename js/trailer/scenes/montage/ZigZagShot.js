/**
 * Montagem 1 — correm PARA CIMA num corredor comprido, em zigue-zague,
 * cortando uma fila de inimigos espalhados no caminho. Câmera drone: segue
 * à frente, girando devagar e aproximando.
 */
import { ArenaShot } from '../../kit/ArenaShot.js';
import { lerp, clamp01 } from '../../anim.js';

const SPEED = 6.4;     // px de mundo por passo (correria)
const AMP = 140;       // amplitude do zigue-zague
const WAVE = 170;      // comprimento de onda (px de subida por radiano)
const HALF = 95;       // meia distância entre os dois (corda horizontal)

export class ZigZagShot extends ArenaShot {
    constructor(stage) {
        super(stage, { cols: 14, rows: 28, doors: { N: true }, seed: 21 }, 3.4);
    }

    setup(A) {
        const cx = A.center.x;
        const y0 = A.bounds.maxY - 80;
        const pathX = (y) => cx + AMP * Math.sin((y0 - y) / WAVE);
        this.pathX = pathX;

        A.initPlayer(A.p1, pathX(y0) - HALF, y0, 0, -SPEED);
        A.initPlayer(A.p2, pathX(y0) + HALF, y0, 0, -SPEED);
        A.minSpin = 1;
        A.saw.spin = 1;
        A.expr(A.p1, 'furia');
        A.expr(A.p2, 'raiva');
        A.both(p => { p.wobble = 0.08; p.accel = 0.3; });

        // Inimigos no caminho (cortados pela corda) + alguns nos flancos.
        for (let i = 0; i < 10; i++) {
            const y = y0 - 240 - i * 108;
            const side = i % 2 ? 1 : -1;
            const e = A.spawnEnemy(pathX(y) + side * 38, y, i % 3 === 2 ? 'bloodMonster' : 'demon',
                { speed: 0.9, chase: A.midTarget, stopDist: 0 });
            e._lungeArmed = true;
        }
        for (let i = 0; i < 5; i++) {
            const y = y0 - 380 - i * 210;
            const side = i % 2 ? 1 : -1;
            A.spawnEnemy(pathX(y) + side * 230, y, null, { speed: 0.5, chase: A.midTarget, stopDist: 170 });
        }

        let kills = 0;
        A.onKill = () => {
            kills++;
            if (kills === 3 || kills === 7) { A.slowmo(0.22, 0.35); A.renderer.triggerZoomPunch(0.05); }
            const p = kills % 2 ? A.p1 : A.p2;
            A.hop(p, 3);
            A.exprFor(p, kills % 3 ? 'furia' : 'raiva', 0.5);
        };

        // Câmera à frente da dupla. Vídeo vertical: o quadro alto já mostra o
        // corredor à frente; com o avanço da paisagem a dupla desceria para a
        // faixa da legenda do Reels (~75% da altura) — menos avanço = ~62%.
        const lead = this.stage.portrait ? 90 : 150;

        // Roteiro: alvo de subida + zigue-zague; inimigos dão bote ao chegar perto.
        A.script = (t) => {
            const my = y0 - SPEED * 60 * t;
            const mx = pathX(my);
            A.p1.goal = { follow: true, x: mx - HALF, y: my, gain: 0.3, max: 9 };
            A.p2.goal = { follow: true, x: mx + HALF, y: my, gain: 0.3, max: 9 };
            for (const e of A.enemies) {
                if (e._lungeArmed && e.state !== 'dying' && Math.abs(e.y - my) < 120) {
                    e._lungeArmed = false;
                    A.lunge(e, mx, my, 4);
                }
            }
            // Drone: à frente da dupla, girando de -20° a +9° e aproximando.
            const k = clamp01(t / 3.2);
            A.focus({
                x: mx, y: my - lead, zoom: lerp(1.9, 2.5, k),
                rot: lerp(-0.35, 0.16, k) + Math.sin(t * 2.1) * 0.03,
                k: 0.14, fit: [A.p1, A.p2], pad: 90
            });
        };
        A.snapCamera(pathX(y0), y0 - lead, 1.9 * A.zoomRef, -0.35);
    }
}
