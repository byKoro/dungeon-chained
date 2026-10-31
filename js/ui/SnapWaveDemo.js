import { CardDemo, TILE } from './cardDemoKit.js';
import { FORGE } from '../config/ForgeConfig.js';

// "Vídeo" do card do Estalo: a dupla com a serra no meio de um grupo de demônios, corre cada um para um lado,
// o cabo estica, arrebenta e a onda (raio do nível 1, cores do jogo) corta todo mundo em volta da serra.
const ROW_Y = 3.4 * TILE;
const MID_X = 6 * TILE;
const PULL_AT = 0.5;
const STRAIN_SECS = 0.45;

export class SnapWaveDemo extends CardDemo {
    static VIEW = { cols: 8, rows: 4, cx: 6 * TILE, cy: 3.2 * TILE };

    constructor(assets) {
        super(assets, { seed: 67, view: SnapWaveDemo.VIEW, loop: 3.8 });
        this.restart();
    }

    setup(A) {
        const { p1, p2 } = A;
        A.connected = true;
        A.sawVisible = true;
        A.initPlayer(p1, MID_X - 0.9 * TILE, ROW_Y);
        A.initPlayer(p2, MID_X + 0.9 * TILE, ROW_Y);
        const radius = FORGE.recipes.snapWave.radius[0];
        // Acima e abaixo da linha da dupla, dentro do raio da onda e fora do alcance da serra presa no cabo.
        const enemies = [[-0.45, -0.7], [0.45, -0.7], [-0.45, 0.55], [0.45, 0.55]].map(([dx, dy]) =>
            A.spawnEnemy(MID_X + dx * radius, ROW_Y + dy * radius, 'demon', { speed: 0, lookAt: A.midTarget }));
        let phase = 'idle', at = 0;
        A.script = (t) => {
            if (phase === 'idle' && t > PULL_AT) {
                phase = 'pull'; at = t;
                p1.goal = { x: 2 * TILE, y: ROW_Y, speed: 3.4 };
                p2.goal = { x: 10 * TILE, y: ROW_Y, speed: 3.4 };
            } else if (phase === 'pull' && Math.hypot(p2.x - p1.x, p2.y - p1.y) >= A.ropeLen - 2) {
                phase = 'strain'; at = t;
            } else if (phase === 'strain') {
                A.renderer.triggerShake(2 + 4 * (t - at) / STRAIN_SECS);
                if (t - at >= STRAIN_SECS) {
                    phase = 'snap';
                    const s = A.saw.getSawPositions(p1, p2)[0];
                    A.snap();
                    const fx = FORGE.snapWave;
                    A.particles.triggerShockRing(s.x, s.y, radius, { life: fx.ringLife, color: fx.ringColor });
                    A.particles.triggerSparkBurst(s.x, s.y, radius * 0.5, fx.sparks, 1.4);
                    for (const e of enemies) if (Math.hypot(e.x - s.x, e.y - s.y) <= radius + e.hitRadius) A.killEnemy(e, 6);
                    p1.goal = { x: p1.x - 30, y: ROW_Y, speed: 1 };
                    p2.goal = { x: p2.x + 30, y: ROW_Y, speed: 1 };
                }
            }
        };
    }
}
