/**
 * TrailerStage — o "palco" compartilhado por todas as cenas do trailer.
 *
 * Guarda o que atravessa as cenas: canvas, renderer, assets, os dois
 * jogadores (com as expressões do trailer), a serra e a camada de sangue em
 * tela (BloodScreen). Também oferece os helpers comuns: expressões, câmera,
 * zoom de referência, brilho da serra, névoa, letterbox, balão de fala e o
 * título do jogo.
 *
 * Cada cena recebe o stage no construtor e o usa como `host`.
 */
import { Renderer } from '../core/Renderer.js';
import { SeamlessTileset as Tileset } from './kit/SeamlessTileset.js';
import { Player } from '../entities/Player.js';
import { SawWeapon } from '../weapons/SawWeapon.js';
import { playerConfigs } from '../config/EntityConfig.js';
import { renderSpeechBubble } from '../ui/SpeechBubble.js';
import { BloodScreen } from './fx/BloodScreen.js';
import { TILE, ROOM_COLS, ROOM_ROWS } from '../config/GameConfig.js';
import { clamp01, lerp, easeOut } from './anim.js';

// Expressões faciais (folhas de 8 frames, mesmo layout de player_walk.png),
// geradas por tools/gen_expressions.py. Carregadas só no trailer.
export const TRAILER_EXPRESSIONS = [
    'neutro', 'assustado', 'espantado', 'raiva', 'furia', 'preocupado',
    'desconfiado', 'olhando_esquerda', 'olhando_direita', 'olhando_cima',
    'olhos_fechados'
];

// Pixel do balão = esta fração do pixel de arte do jogo (1 = mesma escala).
const BUBBLE_PIXEL_RATIO = 0.5;

export class TrailerStage {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {AssetLoader} assets  loader compartilhado (o stage registra nele
     *   as expressões; chame assets.whenReady() depois de criar o stage).
     */
    constructor(canvas, assets) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;
        this.assets = assets;

        this.renderer = new Renderer(canvas, this.ctx);
        this.renderer.setTileset(new Tileset(assets.tileset, 16, 10));
        this.renderer.setAssets(assets);
        this.renderer.setTileWorldSize(TILE);

        // Jogadores (config do jogo). No roteiro, "vermelho" = P1, "azul" = P2.
        const cfgs = playerConfigs(assets);
        this.p1 = new Player(0, 0, cfgs[0].color, cfgs[0].controls, cfgs[0].img, cfgs[0].name, cfgs[0].sprite);
        this.p2 = new Player(0, 0, cfgs[1].color, cfgs[1].controls, cfgs[1].img, cfgs[1].name, cfgs[1].sprite);
        this.redPlayer = this.p1;
        this.bluePlayer = this.p2;
        this._loadExpressions();

        this.saw = new SawWeapon(assets.saw, assets.cable);

        // Camada de sangue em TELA (cartela -> frenesi). Desenhada pelo player
        // por cima de qualquer cena enquanto estiver ativa.
        this.bloodScreen = new BloodScreen(canvas);

        this.speech = null;     // { who, text, t, dur }
        this._fogPhase = 0;
        this._onResize = () => this.resize();
        this.resize();
    }

    _loadExpressions() {
        for (const [p, dir] of [[this.p1, 'player_01'], [this.p2, 'player_02']]) {
            const s = p.sprite;
            s.expressions = {};
            for (const name of TRAILER_EXPRESSIONS) {
                s.expressions[name] = {
                    img: this.assets.load(`${dir}_expr_${name}`, `assets/${dir}/expressions/${name}.png`),
                    frameCount: s.frameCount, cellSize: s.cellSize,
                    cropX: s.cropX, cropY: s.cropY, cropW: s.cropW, cropH: s.cropH
                };
            }
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.ctx.imageSmoothingEnabled = false;
    }
    attach() { window.addEventListener('resize', this._onResize); this.resize(); }
    detach() { window.removeEventListener('resize', this._onResize); }

    // Estado limpo dos atores (ao (re)começar o trailer).
    resetActors() {
        for (const p of [this.p1, this.p2]) {
            p.expression = null; p._exprBase = null; p._exprTimer = 0;
            p.scaredTimer = 0; p.hurtTimer = 0; p._faceLock = false;
            p.vx = p.vy = 0;
        }
        const s = this.saw;
        s.spin = 0; s.rotation = 0; s.dragX = s.dragY = 0;
        s.dropped = false;
        this.speech = null;
        this._fogPhase = 0;
        this.bloodScreen.reset();
        this.renderer.screenShake = 0;
        this.renderer.setIntroZoomFactor(1);
        this.renderer.resetSway?.();
    }

    // ---- Expressões ----
    // Expressão permanente (também vira a BASE para onde um susto volta).
    _express(p, name) {
        p.expression = name;
        p._exprBase = name;
        p._exprTimer = 0;
    }
    // Expressão temporária: `name` por `seconds`, depois volta à base.
    _expressFor(p, name, seconds) {
        p._exprBase = p._exprBase ?? p.expression ?? null;
        p.expression = name;
        p._exprTimer = seconds;
    }
    _bothExpressFor(name, seconds) {
        this._expressFor(this.p1, name, seconds);
        this._expressFor(this.p2, name, seconds);
    }
    _tickExpressions(dt) {
        for (const p of [this.p1, this.p2]) {
            if (p._exprTimer > 0) {
                p._exprTimer -= dt;
                if (p._exprTimer <= 0) p.expression = p._exprBase ?? null;
            }
        }
    }

    // ---- Câmera ----
    // Zoom de REFERÊNCIA: o que faz uma sala padrão do jogo caber na tela.
    // As cenas expressam seus zooms como múltiplos dele.
    _zoomFit() {
        const margin = 90;
        return Math.min(
            this.canvas.width / (ROOM_COLS * TILE + margin * 2),
            this.canvas.height / (ROOM_ROWS * TILE + margin * 2)
        );
    }
    // Interpola a câmera (sem clamp de sala, para liberdade cênica).
    _camTo(x, y, zoom, lerpK = 0.12) {
        const r = this.renderer;
        r.camX += (x - r.camX) * lerpK;
        r.camY += (y - r.camY) * lerpK;
        r.zoom += (zoom - r.zoom) * (lerpK * 0.8);
    }

    // ---- Efeitos comuns ----
    // Brilho AZUL-AÇO em volta do disco da serra (no MUNDO, aditivo).
    _drawSawGlow(ctx, pos) {
        if (!pos) return;
        const spin = this.saw.spin ?? 0;
        const r = (this.saw.discRadius ?? 32);
        const intensity = 0.22 + spin * 0.45;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, r * 1.9);
        g.addColorStop(0, `rgba(150, 196, 255, ${0.5 * intensity})`);
        g.addColorStop(0.5, `rgba(120, 170, 255, ${0.22 * intensity})`);
        g.addColorStop(1, 'rgba(120, 170, 255, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 1.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(210, 230, 255, ${0.3 * intensity})`;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Avança a névoa (chamar 1x por frame pela cena que a usa).
    tickFog(dt) { this._fogPhase += dt * 0.06; }

    // Névoa atmosférica: bancos de fumaça radiais derivando pela tela, por
    // cima da iluminação (determinístico, por senoides defasadas).
    _drawFog() {
        this.drawFogOn(this.ctx, this.canvas.width, this.canvas.height, this._fogPhase);
    }

    // Mesma névoa em qualquer canvas (ex.: o canvas próprio de uma ActionArena).
    drawFogOn(ctx, w, h, ph = this._fogPhase) {
        const banks = [
            { cy: h * 0.82, r: h * 0.55, color: '70, 60, 95', base: 0.16, n: 4, speed: 1.0, drift: w * 0.5 },
            { cy: h * 0.35, r: h * 0.45, color: '60, 70, 110', base: 0.08, n: 3, speed: 0.6, drift: w * 0.6 }
        ];
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (const bank of banks) {
            for (let i = 0; i < bank.n; i++) {
                const phase = ph * bank.speed + (i / bank.n) * Math.PI * 2;
                const cx = w * 0.5 + Math.sin(phase) * bank.drift;
                const cy = bank.cy + Math.cos(phase * 0.7) * (h * 0.05);
                const a = bank.base * (0.6 + 0.4 * (0.5 + 0.5 * Math.sin(phase * 1.3)));
                const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, bank.r);
                g.addColorStop(0, `rgba(${bank.color}, ${a})`);
                g.addColorStop(0.6, `rgba(${bank.color}, ${a * 0.4})`);
                g.addColorStop(1, `rgba(${bank.color}, 0)`);
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, w, h);
            }
        }
        ctx.restore();
    }

    // Barras pretas de cinema.
    drawLetterbox() {
        const { ctx, canvas } = this;
        const barH = Math.round(canvas.height * 0.10);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, barH);
        ctx.fillRect(0, canvas.height - barH, canvas.width, barH);
        ctx.restore();
    }

    // Nome do jogo no centro. `red` 0..1 tinge de vermelho e treme.
    drawTitleText(red = 0, alpha = 1) {
        const { ctx, canvas } = this;
        const jx = red > 0 ? (Math.random() - 0.5) * 6 * red : 0;
        const jy = red > 0 ? (Math.random() - 0.5) * 4 * red : 0;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.textAlign = 'center';
        ctx.fillStyle = red > 0.5 ? '#ff3344' : '#fffffe';
        ctx.font = 'bold 42px monospace';
        ctx.fillText('DUNGEON CHAINED', canvas.width / 2 + jx, canvas.height / 2 - 6 + jy);
        ctx.fillStyle = red > 0.5 ? '#b3122a' : '#a7a9be';
        ctx.font = '16px monospace';
        ctx.fillText('acorrentados no calabouço', canvas.width / 2 + jx * 0.5, canvas.height / 2 + 26 + jy * 0.5);
        ctx.restore();
    }

    // ---- Balão de fala ----
    _speak(who, text, dur) { this.speech = { who, text, t: 0, dur }; }
    tickSpeech(dt) {
        if (!this.speech) return;
        this.speech.t += dt;
        if (this.speech.t >= this.speech.dur) this.speech = null;
    }
    // Balão de pedra em pixel art sobre a cabeça de quem fala (máquina de
    // escrever ~40 caracteres/s, pixel = metade do pixel do jogo).
    drawSpeech() {
        if (!this.speech) return;
        const { ctx, renderer, canvas } = this;
        const who = this.speech.who;
        const scr = renderer.worldToScreen(who.x, who.y - 46);

        const inK = easeOut(clamp01(this.speech.t / 0.18));
        const outK = this.speech.t > this.speech.dur - 0.2
            ? clamp01((this.speech.dur - this.speech.t) / 0.2) : 1;
        const alpha = inK * outK;
        const scale = lerp(0.8, 1, inK);

        const text = this.speech.text;
        const chars = Math.floor(this.speech.t * 40);
        const key = `${text}|${chars}|${who.color}`;
        if (!this._bubbleCache || this._bubbleCache.key !== key) {
            this._bubbleCache = { key, ...renderSpeechBubble(text, who.color, chars) };
        }
        const { canvas: art, tipX, tipY } = this._bubbleCache;

        const gamePx = (TILE / 16) * scr.zoom;
        const maxP = Math.floor((canvas.width * 0.55) / art.width);
        const baseP = Math.max(2, Math.min(Math.round(gamePx * BUBBLE_PIXEL_RATIO), maxP));
        const P = baseP * scale;
        const dw = Math.round(art.width * P);
        const dh = Math.round(art.height * P);
        const rise = (1 - inK) * 4 * P;
        let dx = Math.round(scr.x - tipX * P);
        let dy = Math.round(scr.y - 6 - tipY * P + rise);
        const margin = Math.round(canvas.height * 0.10) + 8;
        dx = Math.max(8, Math.min(dx, canvas.width - dw - 8));
        dy = Math.max(margin, dy);

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = alpha;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(art, dx, dy, dw, dh);
        ctx.restore();
    }
}
