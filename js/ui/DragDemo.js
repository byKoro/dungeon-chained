import { CardDemo, TILE } from './cardDemoKit.js';
import { SawDrag } from '../systems/SawDrag.js';
import { sawDragStats } from '../systems/ForgeState.js';

// "Vídeo" do card do Arrastar: cabo arrebentado, a serra largada atrás do Amarelo e o parceiro do outro lado. O
// Amarelo volta até ela, segura interagir, puxa a serra pelo cabo curto (o SawDrag real, com o mesmo limite e velocidade do jogo) até o
// parceiro, e a serra reconecta.
const ROW_Y = 3.4 * TILE;
const SAW_X = 3.9 * TILE;
const WALK = 3.2;
const HOLD_AT = 0.7;

export class DragDemo extends CardDemo {
    static VIEW = { cols: 8, rows: 4, cx: 5.8 * TILE, cy: 3.2 * TILE };

    constructor(assets) {
        super(assets, { seed: 61, view: DragDemo.VIEW, loop: 4.6 });
        const A = this.arena;
        this.holding = false;
        this.stats = sawDragStats(TILE);
        this.drag = new SawDrag({
            chain: { hasSaw: true, get isConnected() { return A.connected; }, get weapon() { return A.saw; } },
            getPlayers: () => [A.p1, A.p2],
            input: { isDown: k => k === 'e' && this.holding },
            getStats: () => this.stats,
            getBounds: () => A.bounds
        });
        this.restart();
    }

    get pressed() { return this.holding; }

    setup(A) {
        const { p1, p2, saw } = A;
        A.connected = false;
        A.sawVisible = true;
        saw.drop(SAW_X, ROW_Y, { inertia: false });
        A.initPlayer(p1, 5.2 * TILE, ROW_Y);
        A.initPlayer(p2, 8.8 * TILE, ROW_Y - 0.1 * TILE);
        for (const p of [p1, p2]) Object.assign(p, { lives: 3, falling: false });
        p1.faceX = SAW_X;
        p2.faceX = p1.x;
        this.holding = false;
        this.drag.reset();
        let phase = 'walk';
        p1.goal = { x: SAW_X + 34, y: ROW_Y, speed: 2.6 };
        A.script = (t) => {
            this.drag.update();
            if (phase === 'walk' && t > HOLD_AT) { phase = 'grab'; this.holding = true; }
            if (phase === 'grab' && this.drag.active) {
                phase = 'drag';
                p1.faceX = null;
                p1.goal = { x: 7 * TILE, y: ROW_Y, speed: WALK * this.stats.speedScale * 1.6 };
                p2.goal = { x: 5.6 * TILE, y: ROW_Y, speed: 2.4 };
                p2.faceX = null;
            }
            if (phase === 'drag' && Math.hypot(p2.x - saw.dropX, p2.y - saw.dropY) < 60) {
                phase = 'linked';
                this.holding = false;
                this.drag.reset();
                A.reconnect();
                p1.goal = { x: p1.x, y: ROW_Y, speed: 1 };
                p2.goal = { x: p2.x + 30, y: ROW_Y, speed: 1 };
            }
        };
        A.onDrawFloor = (ctx) => this.drag.drawRope(ctx);
    }
}
