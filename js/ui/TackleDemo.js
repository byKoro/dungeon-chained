import { ActionArena } from '../trailer/kit/ActionArena.js';
import { dressRoom } from '../trailer/kit/rushKit.js';
import { playerConfigs } from '../config/EntityConfig.js';
import { TILE } from '../config/GameConfig.js';
import { SAW_TACKLE } from '../config/SawTackleConfig.js';

// "Vídeo" do card da Investida, no mesmo kit do DashDemo: a serra está solta no chão, o Amarelo dá dash nela e ela
// voa por cima do vão até um demônio numa ilha cercada de buracos (inalcançável a pé), corta e volta para onde estava.
// A velocidade, o hit stop e o tempo presa saem do SAW_TACKLE para o vídeo bater com o jogo.
const COLS = 12, ROWS = 7;
const VIEW_COLS = 9, VIEW_ROWS = 5;
const VIEW_CX = 6 * TILE, VIEW_CY = 3.4 * TILE;
const ROW_Y = 3.5 * TILE;
const SAW_X = 4.4 * TILE;
const ENEMY_X = 9 * TILE;
// Vão (cols 6-7) e o anel de buracos em volta da ilha (cols 8-9, linhas 2-4).
const GAP_COLS = [6, 7, 10];
const ISLAND_COLS = [8, 9];
const LOOP = 4.5;
const DASH_AT = 1.0;
const PRESS_SECS = 0.3;
const STEP = 1 / 60;
const FREEZE_SECS = Math.max(STEP, SAW_TACKLE.hitStopSeconds);
const STUCK_SECS = SAW_TACKLE.hits * SAW_TACKLE.hitIntervalSeconds * 0.7;

const stageFor = (assets) => {
    const [c1, c2] = playerConfigs(assets);
    return {
        assets, p1: c1, p2: c2, audio: null,
        refSize: COLS * TILE, portrait: false, fitW: 0.5, fitH: 0.4, fitDown: 0.4, barH: 0,
        drawFogOn() {}, _drawSawGlow() {},
        _express(p, name) { p.expression = name; p._exprBase = name; p._exprTimer = 0; },
        _expressFor(p, name, secs) { p._exprBase = p._exprBase ?? p.expression ?? null; p.expression = name; p._exprTimer = secs; }
    };
};

export class TackleDemo {
    constructor(assets) {
        const A = this.arena = new ActionArena(stageFor(assets), { cols: COLS, rows: ROWS, seed: 41, ambient: '40, 32, 50', vignette: 0.6 });
        const cells = [];
        for (let r = 1; r < ROWS - 1; r++) {
            for (const c of GAP_COLS) cells.push([c, r]);
            if (r === 1 || r === ROWS - 2) for (const c of ISLAND_COLS) cells.push([c, r]);
        }
        A.setHoles(cells);
        dressRoom(A, { seed: 41, crates: 1, rubble: 5, loot: 0, banners: 1, blood: 0,
            avoid: (c, r) => r >= 2 && r <= 4 });
        this.restart();
    }

    size(k) {
        return { w: VIEW_COLS * 16 * k, h: VIEW_ROWS * 16 * k };
    }

    static scaleFor(maxW, maxH) {
        return Math.max(2, Math.min(8, Math.floor(Math.min(maxW / (VIEW_COLS * 16), maxH / (VIEW_ROWS * 16)))));
    }

    restart() {
        const A = this.arena, { p1, p2, saw } = A;
        A.reset();
        A.connected = false;
        A.sawVisible = true;
        saw.drop(SAW_X, ROW_Y, { inertia: false });
        A.initPlayer(p1, 1.7 * TILE, ROW_Y);
        A.initPlayer(p2, 1.5 * TILE, ROW_Y + 1.1 * TILE);
        const enemy = A.spawnEnemy(ENEMY_X, ROW_Y, 'demon', { speed: 0, lookAt: p1 });
        p1.faceX = ENEMY_X;
        p2.faceX = ENEMY_X;
        const contact = saw.discRadius * SAW_TACKLE.contactScale + 16;
        p1.goal = { x: SAW_X - contact - 46, y: ROW_Y, speed: 2.4 };
        let phase = 'walk', at = 0;
        const origin = { x: SAW_X, y: ROW_Y };
        this._pressAt = -Infinity;
        A.script = (t) => {
            if (phase === 'walk' && t > DASH_AT) {
                phase = 'dash';
                this._pressAt = t;
                A.dash(p1, SAW_X, ROW_Y, { steps: 10, sound: false });
            } else if (phase === 'dash' && Math.hypot(p1.x - SAW_X, p1.y - ROW_Y) < contact + 6) {
                phase = 'impact'; at = t;
                p1.dashT = 0; p1.dashing = false; p1.goal = null;
                p1.dashFreeze = Math.round(FREEZE_SECS * 60);
                A.swerve(p1, -SAW_TACKLE.recoilSpeed, 0, SAW_TACKLE.reactionSteps * STEP);
                A.particles.triggerHitSparks?.(SAW_X - contact * 0.5, ROW_Y, 1, 0, SAW_TACKLE.impactSparks, 1, 0.9);
                A.particles.triggerFlash(SAW_X, ROW_Y, 8, 0.8);
                A.renderer.triggerShake(SAW_TACKLE.impactShake);
                A.freeSaw = { x: SAW_X, y: ROW_Y, vx: 0, vy: 0 };
                saw.dropped = false;
            } else if (phase === 'impact' && t - at >= FREEZE_SECS) {
                phase = 'flight';
                A.freeSaw.vx = SAW_TACKLE.speed;
            } else if (phase === 'flight' && enemy.state === 'dying') {
                phase = 'stuck'; at = t;
                A.freeSaw.vx = 0;
            } else if (phase === 'stuck' && t - at >= STUCK_SECS) {
                phase = 'return';
                A.freeSaw.vx = -SAW_TACKLE.speed;
            } else if (phase === 'return' && A.freeSaw.x <= origin.x) {
                phase = 'landed';
                A.freeSaw = null;
                saw.drop(origin.x, origin.y, { inertia: false });
                A.particles.triggerSparkBurst(origin.x, origin.y, saw.discRadius * 0.5, 8, 0.8);
                A.renderer.triggerShake(3);
            }
        };
    }

    // O botão do card aparece apertado enquanto o jogador do vídeo dá o dash.
    get pressed() {
        const since = this.arena.t - this._pressAt;
        return since >= 0 && since < PRESS_SECS;
    }

    update(dt) {
        if (this.arena.t >= LOOP) this.restart();
        this.arena.update(Math.min(dt, 0.05));
    }

    render(w, h, k) {
        const A = this.arena;
        A.setCam(VIEW_CX, VIEW_CY, k * 16 / TILE);
        A.render(w, h);
        return A.canvas;
    }
}
