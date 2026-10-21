/**
 * Clipe 6 — MESMO SOFÁ ("E dá pra jogar no mesmo sofá.").
 *
 * Gameplay co-op (a dupla varre a sala cortando inimigos, a corda sempre de
 * través ao movimento) com DOIS CONTROLES na tela, um em cada canto de baixo,
 * na cor de cada jogador. O analógico de cada controle segue o movimento do
 * seu jogador e o controle acende enquanto ele anda; o botão de ação pisca a
 * cada abate. Pixel art desenhada aqui mesmo (sem asset novo).
 */
import { B3Shot } from './B3Shot.js';
import { dressRoom } from '../kit/rushKit.js';
import { drawText, measureText } from '../../ui/PixelFont.js';
import { clamp01 } from '../anim.js';

const COLS = 16, ROWS = 11;
const PX = 7;                      // px de tela por pixel de arte do controle
const COLORS = {
    // Cores dos jogadores no jogo (EntityConfig): P1 amarelo, P2 azul.
    p1: { main: '#ffd166', dark: '#8a6a24', light: '#ffe9b0' },
    p2: { main: '#6bb4db', dark: '#2d5f7c', light: '#b6e0f5' }
};

export class CouchShot extends B3Shot {
    constructor(stage) {
        super(stage, { cols: COLS, rows: ROWS, doors: { N: true, S: true }, seed: 91, ropeLen: 230 }, 3.2);
        this.label = 'SAME COUCH';
        this.pads = [makePadState('P1', COLORS.p1), makePadState('P2', COLORS.p2)];
    }

    setup(A) {
        const { p1, p2 } = A;
        dressRoom(A, { seed: 91, crates: 2, rubble: 10, loot: 2, banners: 2, blood: 6 });
        const C = A.center;
        A.initPlayer(p1, C.x - 160, C.y - 40);
        A.initPlayer(p2, C.x - 60, C.y + 60);
        A.both(p => { p.accel = 0.12; p.wobble = 0.2; });
        A.expr(p1, 'furia'); A.expr(p2, 'raiva');
        A.minSpin = 1; A.saw.spin = 1;
        for (const pad of this.pads) { pad.btn = 0; pad.glow = 0; pad.sx = 0; pad.sy = 0; }

        const S = this;
        // Inimigos chegando pelas portas (perseguem o meio da corda).
        const spots = [[C.x + 300, C.y - 170], [C.x + 340, C.y + 150], [C.x - 330, C.y + 170], [C.x + 120, C.y - 230], [C.x - 280, C.y - 180]];
        S.foes = spots.map(([x, y], i) => {
            const e = A.spawnEnemy(x, y, i % 3 === 1 ? 'bloodMonster' : 'demon', { speed: 1.5 + i * 0.12, chase: A.midTarget, stopDist: 0 });
            e._by = 0.9 + i * 0.45;
            return e;
        });
        A.onKill = () => {
            const pad = S.pads[A.kills % 2];
            pad.btn = 1;
            A.renderer.triggerZoomPunch(0.03);
            A.exprFor(A.kills % 2 ? p2 : p1, 'espantado', 0.25);
        };

        A.script = (t) => {
            // Meio da corda num Lissajous; a corda gira de través ao movimento.
            const mx = C.x + Math.sin(t * 1.25) * 230;
            const my = C.y + Math.sin(t * 2.1 + 0.6) * 110;
            const vx = Math.cos(t * 1.25) * 1.25 * 230, vy = Math.cos(t * 2.1 + 0.6) * 2.1 * 110;
            const ang = Math.atan2(vy, vx) + Math.PI / 2;
            const h = 100;
            p1.goal = { follow: true, x: mx - Math.cos(ang) * h, y: my - Math.sin(ang) * h, gain: 0.22, max: 6.5 };
            p2.goal = { follow: true, x: mx + Math.cos(ang) * h, y: my + Math.sin(ang) * h, gain: 0.22, max: 6.5 };
            // Garantia: cada inimigo encontra a serra no seu tempo.
            for (const e of S.foes) {
                if (e.state === 'dying' || e.isHidden) continue;
                if (!e._lunged && t > e._by - 0.3) { e._lunged = true; A.lunge(e, A.sawPos.x, A.sawPos.y, 7); }
                if (t > e._by) A.killEnemy(e, 8);
            }
            // Controles: analógico = direção do jogador, brilho = velocidade.
            [p1, p2].forEach((p, i) => {
                const pad = S.pads[i];
                const sp = Math.hypot(p.vx, p.vy);
                const k = clamp01(sp / 4);
                pad.sx += ((sp > 0.3 ? p.vx / sp : 0) * k - pad.sx) * 0.3;
                pad.sy += ((sp > 0.3 ? p.vy / sp : 0) * k - pad.sy) * 0.3;
                pad.glow += (k - pad.glow) * 0.2;
                pad.btn = Math.max(0, pad.btn - 1 / 14);
            });

            S.frame(A, t, { x: C.x, y: C.y - 10, zoom: 1.32, k: 0.06, fit: [p1, p2], pad: 140 });
        };
        A.snapCamera(C.x, C.y - 10, 1.32 * A.zoomRef);
    }

    render() {
        super.render();
        const { ctx, canvas } = this.stage;
        const W = canvas.width, H = canvas.height;
        const pw = PAD_W * PX, ph = PAD_H * PX, m = 56;
        drawPad(ctx, this.pads[0], m, H - m - ph);
        drawPad(ctx, this.pads[1], W - m - pw, H - m - ph);
    }
}

// ---------------------------------------------------------------------------
// Controle em pixel art (arte 30x18, desenhada em blocos de PX px).
const PAD_W = 30, PAD_H = 18;

function makePadState(name, colors) {
    return { name, colors, btn: 0, glow: 0, sx: 0, sy: 0, _label: null };
}

// Corpo do controle (máscara de arte): 1 = corpo, 0 = vazio. Alças embaixo.
function bodyCell(x, y) {
    if (y < 2 || y >= PAD_H) return false;
    const inMid = x >= 3 && x < PAD_W - 3 && y < 12;
    const gripL = x >= 1 && x < 10 && y >= 4 && y < PAD_H - (x < 3 ? 2 : 0);
    const gripR = x >= PAD_W - 10 && x < PAD_W - 1 && y >= 4 && y < PAD_H - (x >= PAD_W - 3 ? 2 : 0);
    const top = y >= 2 && y < 4 && x >= 4 && x < PAD_W - 4;
    return inMid || gripL || gripR || top;
}

function drawPad(ctx, pad, x0, y0) {
    const c = pad.colors;
    const g = pad.glow;
    const px = (x, y, w = 1, h = 1) => ctx.fillRect(x0 + x * PX, y0 + y * PX, w * PX, h * PX);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;

    // Brilho atrás (na cor do jogador) enquanto ele se move.
    if (g > 0.02) {
        ctx.globalAlpha = 0.35 * g;
        ctx.fillStyle = c.main;
        px(-1, 1, PAD_W + 2, PAD_H);
        ctx.globalAlpha = 1;
    }
    // Contorno + corpo.
    ctx.fillStyle = '#120c16';
    for (let y = 0; y < PAD_H + 1; y++) for (let x = -1; x <= PAD_W; x++) {
        if (bodyCell(x, y)) continue;
        if (bodyCell(x - 1, y) || bodyCell(x + 1, y) || bodyCell(x, y - 1) || bodyCell(x, y + 1)) px(x, y);
    }
    for (let y = 0; y < PAD_H; y++) for (let x = 0; x < PAD_W; x++) {
        if (!bodyCell(x, y)) continue;
        ctx.fillStyle = y >= 12 ? '#2b2433' : y < 4 ? '#4a4157' : '#3a3245';
        px(x, y);
    }
    // Faixa na cor do jogador (acende com o movimento).
    ctx.fillStyle = mix(c.dark, c.light, g);
    px(5, 2, PAD_W - 10, 1);

    // D-pad (esquerda).
    ctx.fillStyle = '#18121d';
    px(4, 7, 5, 1); px(6, 5, 1, 5);
    // Analógico esquerdo (segue o jogador).
    const sx = Math.round(pad.sx * 1.4), sy = Math.round(pad.sy * 1.4);
    ctx.fillStyle = '#18121d';
    px(10, 9, 4, 4);
    ctx.fillStyle = g > 0.3 ? c.light : '#6f6680';
    px(11 + sx, 10 + sy, 2, 2);
    // Analógico direito (parado).
    ctx.fillStyle = '#18121d';
    px(16, 9, 4, 4);
    ctx.fillStyle = '#6f6680';
    px(17, 10, 2, 2);
    // Botões (direita): o de ação pisca a cada abate.
    const b = pad.btn;
    ctx.fillStyle = '#18121d';
    px(23, 5, 2, 2); px(21, 7, 2, 2); px(25, 7, 2, 2); px(23, 9, 2, 2);
    ctx.fillStyle = b > 0.05 ? mix(c.main, '#ffffff', b * 0.6) : c.dark;
    px(23, 9, 2, 2);

    // Rótulo P1/P2 acima.
    pad._label ??= labelArt(pad.name, c.light);
    const L = pad._label, s = PX - 2;
    ctx.drawImage(L, x0 + Math.round((PAD_W * PX - L.width * s) / 2), y0 - L.height * s - 6, L.width * s, L.height * s);
    ctx.restore();
}

function labelArt(text, color) {
    const cv = document.createElement('canvas');
    cv.width = measureText(text) + 1;
    cv.height = 7;
    const g = cv.getContext('2d');
    drawText(g, text, 0, 1, '#120c16');
    drawText(g, text, 0, 0, color);
    return cv;
}

// Mistura duas cores #rrggbb (k 0..1).
function mix(a, b, k) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = (s) => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
    return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
