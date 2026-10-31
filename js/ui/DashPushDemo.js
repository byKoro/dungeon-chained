import { CardDemo, TILE } from './cardDemoKit.js';
import { FORGE, PLAYER_UPGRADES } from '../config/ForgeConfig.js';
import { DashPush } from '../systems/DashPush.js';
import { DashPushFeedback } from '../systems/DashPushFeedback.js';

// "Vídeo" do card do Impacto: o Amarelo dá dash num demônio perto da parede e ele voa até bater nela. Usa o
// DashPush e o DashPushFeedback reais com o impulso do nível 1; o hit-stop congela o vídeo.
const ROW_Y = 3.4 * TILE;
// Perto da parede leste (o arena limita inimigos a `bounds.maxX - 14`): chega lá ainda rápido e a batida aparece.
const ENEMY_X = 9.9 * TILE;
const DASH_AT = 0.7;
const PRESS_SECS = 0.3;

export class DashPushDemo extends CardDemo {
    static VIEW = { cols: 8, rows: 4, cx: 7.4 * TILE, cy: 3.2 * TILE };

    constructor(assets) {
        super(assets, { seed: 73, view: DashPushDemo.VIEW, loop: 3.4 });
        const A = this.arena;
        this.feedback = new DashPushFeedback({ particleSystem: A.particles, renderer: A.renderer,
            hitStop: s => this.hitStop(s), endSpeed: PLAYER_UPGRADES.dashPush.launchEndSpeed,
            reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false });
        this.push = new DashPush({ getPlayers: () => [A.p1], getRoom: () => A, feedback: this.feedback });
        this.restart();
    }

    get pressed() {
        const since = this.arena.t - this._pressAt;
        return since >= 0 && since < PRESS_SECS;
    }

    setup(A) {
        const { p1, p2 } = A;
        A.connected = false;
        A.sawVisible = false;
        A.initPlayer(p1, 5.6 * TILE, ROW_Y);
        A.initPlayer(p2, 5 * TILE, ROW_Y + 1 * TILE);
        p1.dashPushImpulse = FORGE.recipes.dashPush.impulse[0];
        p2.faceX = ENEMY_X;
        this.push.reset();
        this._pressAt = -Infinity;
        A.spawnEnemy(ENEMY_X, ROW_Y, 'demon', { speed: 0, lookAt: p1 });
        let dashed = false;
        A.script = (t) => {
            this.feedback.update();
            if (!dashed && t > DASH_AT) {
                dashed = true;
                this._pressAt = t;
                A.dash(p1, ENEMY_X - 40, ROW_Y, { steps: 10, sound: false });
                p1.justDashed = true;
            }
            this.push.update();
            p1.justDashed = false;
        };
    }
}
