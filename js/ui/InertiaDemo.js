import { CardDemo, TILE } from './cardDemoKit.js';
import { FORGE } from '../config/ForgeConfig.js';

// "Vídeo" do card da Inércia: a dupla arrebenta o cabo de propósito, a serra cai girando no chão (nível 1:
// `seconds[0]`) e os demônios que vêm atrás do Amarelo passam por cima dela e são cortados.
const ROW_Y = 3.4 * TILE;
const MID_X = 6 * TILE;
const PULL_AT = 0.3;
const STRAIN_SECS = 0.3;
const SPIN_SECS = FORGE.recipes.inertia.seconds[0];

export class InertiaDemo extends CardDemo {
    static VIEW = { cols: 9, rows: 4, cx: 6 * TILE, cy: 3.2 * TILE };

    constructor(assets) {
        super(assets, { seed: 71, view: InertiaDemo.VIEW, loop: 4.4 });
        this.restart();
    }

    setup(A) {
        const { p1, p2, saw } = A;
        A.connected = true;
        A.sawVisible = true;
        saw.inertiaSteps = Math.round(SPIN_SECS * 60);
        A.initPlayer(p1, MID_X - 0.9 * TILE, ROW_Y);
        A.initPlayer(p2, MID_X + 0.9 * TILE, ROW_Y);
        // Vêm da direita por baixo da linha da dupla (não cruzam a serra presa no cabo) e chegam no ponto da queda
        // enquanto ela ainda gira.
        const enemies = [[10.2, 0.9], [10.8, 1.2]].map(([c, r]) =>
            A.spawnEnemy(c * TILE, ROW_Y + r * TILE, 'demon', { speed: 2.2, chase: p1, lookAt: p1 }));
        let phase = 'idle', at = 0;
        A.script = (t) => {
            if (phase === 'idle' && t > PULL_AT) {
                phase = 'pull';
                p1.goal = { x: 2.4 * TILE, y: ROW_Y, speed: 3.4 };
                p2.goal = { x: 9.6 * TILE, y: ROW_Y - 0.4 * TILE, speed: 3.4 };
            } else if (phase === 'pull' && Math.hypot(p2.x - p1.x, p2.y - p1.y) >= A.ropeLen - 2) {
                phase = 'strain'; at = t;
            } else if (phase === 'strain') {
                A.renderer.triggerShake(2 + 3 * (t - at) / STRAIN_SECS);
                if (t - at >= STRAIN_SECS) {
                    phase = 'spin'; at = t;
                    A.snap();
                    p1.goal = { x: p1.x - 20, y: ROW_Y, speed: 1 };
                    p2.goal = { x: p2.x + 20, y: p2.y, speed: 1 };
                }
            }
            if (phase === 'spin' && saw.dropped) {
                const spinning = t - at < SPIN_SECS;
                if (!spinning) saw.inertiaLeft = 0;
                for (const e of enemies) {
                    if (!spinning || e.state === 'dying' || e.frozen) continue;
                    if (Math.hypot(e.x - saw.dropX, e.y - saw.dropY) < saw.discRadius + e.hitRadius) {
                        A.killEnemy(e, 8);
                        A.particles.triggerSparks(saw.dropX, saw.dropY, saw.discRadius, saw.spinDir, 8);
                    }
                }
            }
        };
    }
}
