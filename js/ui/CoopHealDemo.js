import { ActionArena } from '../trailer/kit/ActionArena.js';
import { dressRoom } from '../trailer/kit/rushKit.js';
import { playerConfigs } from '../config/EntityConfig.js';
import { TILE } from '../config/GameConfig.js';
import { BUTTON_PROMPT } from '../config/ButtonPromptConfig.js';
import { CoopHeal } from '../systems/CoopHeal.js';
import { CoopHealFeedback } from '../systems/CoopHealFeedback.js';
import { drawText, measureText } from './PixelFont.js';

// "Vídeo" do card do Vínculo, no mesmo kit do DashDemo: os dois começam separados com 2 de 3 vidas, andam um até o
// outro, o anel do CoopHealFeedback real enche e cada um ganha +1 vida. Os corações nos cantos imitam o HUD.
// O tempo de proximidade é encurtado (o jogo usa 6 s/4 s) para o loop caber no card.
const COLS = 12, ROWS = 7;
// Recorte menor que o do dash: a ação acontece num ponto só, então os personagens ficam maiores.
const VIEW_COLS = 7, VIEW_ROWS = 4;
const VIEW_CX = 6 * TILE, VIEW_CY = 3.2 * TILE;
const ROW_Y = 3.4 * TILE;
const HOLD_STEPS = 132;
const WALK_AT = 0.3;
const LOOP = 4.8;
const MAX_LIVES = 3;
const HEART = 16;
const POP_SECS = 0.3;

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

export class CoopHealDemo {
    constructor(assets) {
        this.heartImg = assets.get?.('heart') ?? assets.heart ?? null;
        const A = this.arena = new ActionArena(stageFor(assets), { cols: COLS, rows: ROWS, seed: 57, ambient: '40, 32, 50', vignette: 0.6 });
        // Nada da linha 2 para baixo: a ação e os corações do canto ficam limpos.
        dressRoom(A, { seed: 57, crates: 1, rubble: 6, loot: 0, banners: 1, blood: 0, avoid: (c, r) => r >= 2 });
        const players = () => [A.p1, A.p2];
        this.heal = new CoopHeal({ getPlayers: players, particleSystem: A.particles });
        this.heal.setParams({ holdSteps: HOLD_STEPS, cooldownSteps: 100000 });
        this.feedback = new CoopHealFeedback({ coopHeal: this.heal, getPlayers: players, particleSystem: A.particles,
            reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false });
        this.restart();
    }

    size(k) {
        return { w: VIEW_COLS * 16 * k, h: VIEW_ROWS * 16 * k };
    }

    static scaleFor(maxW, maxH) {
        return Math.max(2, Math.min(8, Math.floor(Math.min(maxW / (VIEW_COLS * 16), maxH / (VIEW_ROWS * 16)))));
    }

    restart() {
        const A = this.arena, { p1, p2 } = A;
        A.reset();
        A.connected = false;
        A.sawVisible = false;
        A.initPlayer(p1, 3.4 * TILE, ROW_Y + 0.2 * TILE);
        A.initPlayer(p2, 8.6 * TILE, ROW_Y - 0.2 * TILE);
        for (const p of [p1, p2]) Object.assign(p, { lives: MAX_LIVES - 1, maxLives: MAX_LIVES, damageTaken: 0, falling: false });
        p1.faceX = p2.x;
        p2.faceX = p1.x;
        this.heal.reset();
        this.feedback.reset();
        this._popAt = [-Infinity, -Infinity];
        let walking = false;
        A.script = (t) => {
            if (!walking && t > WALK_AT) {
                walking = true;
                p1.goal = { x: 6 * TILE - 26, y: ROW_Y, speed: 3.4 };
                p2.goal = { x: 6 * TILE + 26, y: ROW_Y, speed: 3.4 };
            }
            this.heal.update();
            this.feedback.update();
            for (const p of this.heal.healed) {
                this._popAt[p === p1 ? 0 : 1] = t;
                A.hop(p, 4);
            }
        };
        A.onDrawFloor = (ctx) => this.feedback.drawFloor(ctx);
        A.onDrawOver = (ctx) => { this.feedback.drawOverlay(ctx); A.particles.drawDamageNumbers(ctx); };
        A.onLights = (pp, ws) => this.feedback.renderLights({ worldToScreen: ws }, pp);
    }

    // Sem botão no card: nada para afundar.
    get pressed() { return false; }

    update(dt) {
        if (this.arena.t >= LOOP) this.restart();
        this.arena.update(Math.min(dt, 0.05));
    }

    render(w, h, k) {
        const A = this.arena;
        A.setCam(VIEW_CX, VIEW_CY, k * 16 / TILE);
        A.render(w, h);
        this._drawHearts(A.ctx, w, h, k);
        return A.canvas;
    }

    // Corações nos cantos de baixo, como o HUD: P1 à esquerda, P2 à direita (espelhado). O que acabou de encher pula.
    _drawHearts(ctx, w, h, k) {
        if (!this.heartImg?.complete || !this.heartImg.naturalWidth) return;
        const s = Math.max(1, Math.floor(k / 2)), size = HEART * s, gap = 2 * s, margin = 4 * s;
        const colors = BUTTON_PROMPT.playerColors;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        [this.arena.p1, this.arena.p2].forEach((p, i) => {
            const right = i === 1;
            const y = h - margin - size;
            const tag = `P${i + 1}`, tagW = measureText(tag) * s;
            const tagX = right ? w - margin - tagW : margin;
            ctx.save();
            ctx.translate(tagX, y - 7 * s);
            ctx.scale(s, s);
            drawText(ctx, tag, 0, 1, '#000');
            drawText(ctx, tag, 0, 0, colors[i]);
            ctx.restore();
            const pop = Math.max(0, 1 - (this.arena.t - this._popAt[i]) / POP_SECS);
            for (let j = 0; j < MAX_LIVES; j++) {
                const cx = right ? w - margin - j * (size + gap) - size / 2 : margin + j * (size + gap) + size / 2;
                const full = j < p.lives;
                const scale = full && j === p.lives - 1 ? 1 + 0.5 * pop * pop : 1;
                const d = Math.round(size * scale / s) * s;
                ctx.drawImage(this.heartImg, (full ? 0 : 1) * HEART, 0, HEART, HEART,
                    Math.round(cx - d / 2), Math.round(y + size / 2 - d / 2), d, d);
            }
        });
        ctx.restore();
    }
}
