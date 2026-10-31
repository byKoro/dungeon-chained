import { ActionArena } from '../trailer/kit/ActionArena.js';
import { dressRoom } from '../trailer/kit/rushKit.js';
import { playerConfigs } from '../config/EntityConfig.js';
import { TILE } from '../config/GameConfig.js';

// "Vídeo" do card do dash: uma sala de verdade (tiles, tochas, luz e névoa do jogo) renderizada fora da tela pelo
// mesmo kit dos trailers (`ActionArena`), com o dash real do Player (rastro, esticada, flash, poeira). O Amarelo
// cruza um vão com dash e, em seguida, desvia de um demônio que avança. Repete em loop.
const COLS = 12, ROWS = 7;
// Enquadramento do "vídeo": recorte da sala em volta da ação (tiles), para os personagens ficarem grandes.
const VIEW_COLS = 9, VIEW_ROWS = 5;
const VIEW_CX = 5.7 * TILE, VIEW_CY = 3.1 * TILE;
const ROW_Y = 3.5 * TILE;
const HOLE_COLS = [5, 6];
const LOOP = 3.8;
const PRESS_SECS = 0.3;

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

export class DashDemo {
    constructor(assets) {
        const A = this.arena = new ActionArena(stageFor(assets), { cols: COLS, rows: ROWS, seed: 23, ambient: '40, 32, 50', vignette: 0.6 });
        const cells = [];
        for (let r = 1; r < ROWS - 1; r++) for (const c of HOLE_COLS) cells.push([c, r]);
        A.setHoles(cells);
        dressRoom(A, { seed: 23, crates: 1, rubble: 6, loot: 0, banners: 1, blood: 0,
            avoid: (c, r) => r >= 2 && r <= 4 });
        this.restart();
    }

    // Tamanho do quadro em px de tela: o recorte VIEW em escala inteira de arte (1 px de arte = `k` px).
    size(k) {
        return { w: VIEW_COLS * 16 * k, h: VIEW_ROWS * 16 * k };
    }

    // Maior escala inteira que cabe em `maxW`×`maxH` px.
    static scaleFor(maxW, maxH) {
        return Math.max(2, Math.min(8, Math.floor(Math.min(maxW / (VIEW_COLS * 16), maxH / (VIEW_ROWS * 16)))));
    }

    restart() {
        const A = this.arena, { p1, p2 } = A;
        A.reset();
        A.connected = false;
        A.sawVisible = false;
        A.initPlayer(p1, 2.2 * TILE, ROW_Y);
        A.initPlayer(p2, 2.1 * TILE, ROW_Y + 0.9 * TILE);
        p2.faceX = 9 * TILE;
        const holeL = HOLE_COLS[0] * TILE, holeR = (HOLE_COLS.at(-1) + 1) * TILE;
        let dashed = false, enemy = null, lunged = -1, dodged = false;
        this._pressAt = -Infinity;
        p1.goal = { x: holeL - 26, y: ROW_Y, speed: 3.2 };
        A.script = (t) => {
            if (!dashed && t > 0.8) {
                dashed = true;
                this._pressAt = t;
                A.dash(p1, holeR + 46, ROW_Y, { steps: 14, sound: false });
            }
            if (!enemy && t > 1.7) {
                enemy = A.spawnEnemy(9.8 * TILE, ROW_Y, 'demon', { speed: 2.4, chase: p1, lookAt: p1, intro: true });
                p1.faceX = enemy.x;
            }
            if (enemy && lunged < 0 && Math.hypot(enemy.x - p1.x, enemy.y - p1.y) < 130) {
                lunged = t;
                A.lunge(enemy, p1.x, p1.y, 7);
            }
            if (lunged >= 0 && !dodged && t - lunged > 0.06) {
                dodged = true;
                p1.faceX = null;
                this._pressAt = t;
                A.dash(p1, p1.x - 20, ROW_Y - 1.5 * TILE, { steps: 12, sound: false });
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

    // Renderiza o quadro (`w`×`h` px) com a câmera no recorte da ação, em `k` px por px de arte.
    render(w, h, k) {
        const A = this.arena;
        A.setCam(VIEW_CX, VIEW_CY, k * 16 / TILE);
        A.render(w, h);
        return A.canvas;
    }
}
