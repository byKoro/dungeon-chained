import { ActionArena } from '../trailer/kit/ActionArena.js';
import { dressRoom } from '../trailer/kit/rushKit.js';
import { playerConfigs } from '../config/EntityConfig.js';
import { TILE } from '../config/GameConfig.js';

// Base comum dos "vídeos" do AbilityCard (Vínculo, Arrastar, Estalo, Inércia, Impacto): uma sala real do kit do
// trailer, recorte `viewCols`×`viewRows` tiles em escala inteira de arte, loop por `loop` segundos e hit-stop
// opcional (`freeze`) em tempo real. A subclasse implementa `setup(A)` e, se tiver botão, `pressed`.
const COLS = 12, ROWS = 7;

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

export class CardDemo {
    constructor(assets, { seed, view, loop, holes = [], dress = {} }) {
        this.assets = assets;
        this.view = view;
        this.loop = loop;
        const A = this.arena = new ActionArena(stageFor(assets), { cols: COLS, rows: ROWS, seed, ambient: '40, 32, 50', vignette: 0.6 });
        if (holes.length) A.setHoles(holes);
        dressRoom(A, { seed, crates: 1, rubble: 6, loot: 0, banners: 1, blood: 0, avoid: (c, r) => r >= 2, ...dress });
        this._freeze = 0;
    }

    static scaleFor(maxW, maxH) {
        return Math.max(2, Math.min(8, Math.floor(Math.min(maxW / (this.VIEW.cols * 16), maxH / (this.VIEW.rows * 16)))));
    }

    size(k) {
        return { w: this.view.cols * 16 * k, h: this.view.rows * 16 * k };
    }

    get pressed() { return false; }

    hitStop(seconds) {
        this._freeze = Math.max(this._freeze, seconds);
    }

    restart() {
        const A = this.arena;
        A.reset();
        this._freeze = 0;
        this.setup(A);
    }

    update(dt) {
        if (this.arena.t >= this.loop) this.restart();
        if (this._freeze > 0) { this._freeze -= dt; return; }
        this.arena.update(Math.min(dt, 0.05));
    }

    render(w, h, k) {
        const A = this.arena;
        A.setCam(this.view.cx, this.view.cy, k * 16 / TILE);
        A.render(w, h);
        this.drawOver?.(A.ctx, w, h, k);
        return A.canvas;
    }
}

export { TILE };
