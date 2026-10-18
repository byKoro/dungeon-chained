/**
 * SpeechBubble — balão de fala em pixel art com cara de calabouço:
 * placa de pedra com tijolos chanfrados, rebites de ferro nos cantos,
 * musgo, uma gema na cor do personagem e um "rabicho" de pedra em degraus.
 *
 * Tudo é desenhado num canvas pequeno em resolução de arte (1 px = 1 pixel
 * de arte) e depois ampliado sem suavização por quem chama.
 */
import { drawText, measureText, wrapText, LINE_HEIGHT } from './PixelFont.js';

const PAL = {
    outline: '#0b0910',
    stone: '#4a4458',
    stoneLight: '#6e6684',
    stoneDark: '#2b2735',
    seam: '#1f1b28',
    panel: '#16131d',
    panelShade: '#0f0d15',
    iron: '#7d8696',
    ironLight: '#c9d1dc',
    ironDark: '#454b57',
    moss: '#3e6b3a',
    mossLight: '#5d9450',
    text: '#efe3c2',
    textShadow: '#000000',
};

const MAX_TEXT_W = 140;  // largura máx. da linha (px de arte)  // largura máx. de uma linha (px de arte)
const PAD_X = 6;         // borda (3) + respiro (3) até o texto
const TOP = 3;           // margem acima do balão (espaço para a gema)
const TAIL_H = 5;

/**
 * Monta o balão. Retorna { canvas, tipX, tipY } — tipX/tipY é a ponta do
 * rabicho (em px de arte), que deve ficar sobre a cabeça do personagem.
 */
export function renderSpeechBubble(text, accentColor = '#ffd166', maxChars = Infinity) {
    const lines = wrapText(text, MAX_TEXT_W);
    const textW = Math.max(...lines.map(measureText));
    const W = Math.max(textW + PAD_X * 2, 24);
    // texto: topo das maiúsculas em y=7 (acima ficam acentos), cada linha
    // ocupa LINE_HEIGHT; abaixo: descendente(1) + respiro(2) + borda(3).
    const H = 7 + (lines.length - 1) * LINE_HEIGHT + 6 + 5;

    const cw = W + 1;                    // +1 da sombra projetada
    const ch = TOP + H + TAIL_H + 1;
    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d');
    const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); };
    const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
    // Retângulo com cantos chanfrados (1 px cortado em cada canto).
    const chamfer = (x, y, w, h, c) => {
        rect(x + 1, y, w - 2, h, c);
        rect(x, y + 1, w, h - 2, c);
    };

    const oy = TOP;
    const tipX = Math.floor(W / 2);

    // --- Sombra projetada ---
    ctx.globalAlpha = 0.45;
    chamfer(1, oy + 1, W, H, '#000');
    tail(1, '#000', '#000');
    ctx.globalAlpha = 1;

    // --- Moldura de pedra ---
    chamfer(0, oy, W, H, PAL.outline);
    chamfer(1, oy + 1, W - 2, H - 2, PAL.stone);
    // Luz em cima/esquerda, sombra embaixo/direita (bisel).
    rect(2, oy + 1, W - 4, 1, PAL.stoneLight);
    rect(1, oy + 2, 1, H - 4, PAL.stoneLight);
    rect(2, oy + H - 2, W - 4, 1, PAL.stoneDark);
    rect(W - 2, oy + 2, 1, H - 4, PAL.stoneDark);

    // Juntas dos tijolos: verticais em cima/embaixo, horizontais nas laterais.
    for (let x = 7, i = 0; x < W - 6; x += 9 + (i++ % 3)) {
        rect(x, oy + 1, 1, 2, PAL.seam);
        px(x + 1, oy + 1, PAL.stoneLight);
    }
    for (let x = 11, i = 0; x < W - 6; x += 8 + (i++ % 4)) {
        rect(x, oy + H - 3, 1, 2, PAL.seam);
    }
    for (let y = oy + 6; y < oy + H - 5; y += 6) {
        rect(1, y, 2, 1, PAL.seam);
        rect(W - 3, y + 3 < oy + H - 4 ? y + 3 : y, 2, 1, PAL.seam);
    }

    // --- Painel interno (escuro, com sombra interna no topo/esquerda) ---
    rect(3, oy + 3, W - 6, H - 6, PAL.panel);
    rect(3, oy + 3, W - 6, 1, PAL.panelShade);
    rect(3, oy + 3, 1, H - 6, PAL.panelShade);

    // --- Rebites de ferro nos 4 cantos ---
    const rivet = (x, y) => {
        px(x, y, PAL.iron); px(x + 1, y, PAL.iron);
        px(x, y + 1, PAL.iron); px(x + 1, y + 1, PAL.ironDark);
        px(x, y, PAL.ironLight);
    };
    rivet(1, oy + 1);
    rivet(W - 3, oy + 1);
    rivet(1, oy + H - 3);
    rivet(W - 3, oy + H - 3);

    // --- Musgo escorrendo (canto inferior esquerdo e topo à direita) ---
    [[4, H - 2], [5, H - 2], [6, H - 2], [5, H - 1], [8, H - 2]].forEach(([x, y]) =>
        px(x, oy + y, PAL.moss));
    px(5, oy + H, PAL.moss);
    px(4, oy + H - 2, PAL.mossLight);
    [[W - 9, 1], [W - 8, 1], [W - 7, 1], [W - 8, 0]].forEach(([x, y]) =>
        px(x, oy + y, PAL.moss));
    px(W - 8, oy + 1, PAL.mossLight);

    // --- Rabicho de pedra em degraus (aponta para a cabeça) ---
    tail(0, PAL.outline, PAL.stone);

    // --- Gema na cor do personagem, cravada no topo ---
    const gx = tipX, gy = oy + 1;
    for (let r = -2; r <= 2; r++) {
        const half = 2 - Math.abs(r);
        rect(gx - half - 1, gy + r, half * 2 + 3, 1, PAL.outline);
    }
    for (let r = -1; r <= 1; r++) {
        const half = 1 - Math.abs(r);
        rect(gx - half, gy + r, half * 2 + 1, 1, accentColor);
    }
    px(gx - 1, gy, accentColor);
    px(gx + 1, gy, shade(accentColor, -0.35));
    px(gx, gy + 1, shade(accentColor, -0.35));
    px(gx, gy - 1, shade(accentColor, 0.45));

    // --- Texto (com sombra de 1 px) ---
    let remaining = maxChars;
    lines.forEach((line, i) => {
        if (remaining <= 0) return;
        const lx = Math.floor((W - measureText(line)) / 2);
        const ly = oy + 7 + i * LINE_HEIGHT;
        drawText(ctx, line, lx, ly + 1, PAL.textShadow, remaining);
        const n = drawText(ctx, line, lx, ly, PAL.text, remaining);
        remaining -= n + 1; // +1 = espaço consumido pela quebra de linha
    });

    return { canvas, tipX, tipY: oy + H - 1 + TAIL_H - 1 };

    // Rabicho: degraus de 7 -> 1 px, com contorno; dx = deslocamento (sombra).
    function tail(dx, outlineColor, fillColor) {
        // Começa na linha do contorno inferior e "abre" a pedra para baixo.
        const top = oy + H - 1;
        for (let r = 0; r < TAIL_H; r++) {
            const ow = 9 - r * 2;           // contorno: 9,7,5,3,1
            rect(tipX - (ow >> 1) + dx, top + r + dx, ow, 1, outlineColor);
            const fw = ow - 2;              // preenchimento: 7,5,3,1
            if (fillColor === outlineColor || fw <= 0) continue;
            rect(tipX - (fw >> 1) + dx, top + r + dx, fw, 1, fillColor);
            px(tipX + (fw >> 1) + dx, top + r + dx, PAL.stoneDark);
        }
    }
}

// Clareia (k>0) ou escurece (k<0) uma cor #rrggbb.
function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
    const r = ch((n >> 16) & 255), g = ch((n >> 8) & 255), b = ch(n & 255);
    return `rgb(${r},${g},${b})`;
}
