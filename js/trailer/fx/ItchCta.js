/**
 * ItchCta — chamada final "baixe no itch.io" do VÍDEO do trailer
 * (tools/trailer-render). Fica no lugar do botão START: placa de pedra com
 * face vermelha igual aos botões pixel art do jogo (PixelButton: moldura
 * chanfrada, rebites, gotas de sangue), mas sem interação — ícone de
 * download + "DOWNLOAD NOW". O endereço da página fica na barra de cinema de
 * baixo, com "itch.io" na cor da marca.
 *
 * Mesmo movimento do START: pop elástico ao entrar e "respira" em degraus de
 * 1 pixel de arte (a face acende quando sobe, chamando o olho).
 *
 * Uso: `cta.draw(ctx, W, H, t)` em espaço de TELA, depois do letterbox
 * (t = segundos desde que a chamada apareceu).
 */
import { renderPixelButton, PAD_X } from '../../ui/PixelButton.js';
import { drawText, measureText } from '../../ui/PixelFont.js';

export const ITCH_URL = 'imkoro.itch.io/dungeon-chained';

// Ícone de download (seta entrando na bandeja), 7x7 px de arte.
const ICON = [
    '..###..',
    '..###..',
    '#######',
    '.#####.',
    '..###..',
    '#..#..#',
    '#######'
];
// 3 espaços (3 px cada) reservam a largura do ícone + respiro antes do texto.
const LABEL = '   DOWNLOAD NOW';

const POP_DELAY = 0.15;   // como o CSS do START (.tr-start.visible)
const POP_DUR = 0.45;
const IDLE_DELAY = 0.8;
const IDLE_PERIOD = 1.4;
const URL_IN = 0.55;      // o endereço entra logo depois da placa
const URL_FADE = 0.35;

// cubic-bezier(0.34, 1.7, 0.64, 1) do pop do START (resolve x -> t por Newton).
function popEase(x) {
    const x1 = 0.34, y1 = 1.7, x2 = 0.64, y2 = 1;
    const bx = (t) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
    const by = (t) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
    let t = x;
    for (let i = 0; i < 8; i++) {
        const d = (bx(t + 1e-4) - bx(t)) / 1e-4;
        if (Math.abs(d) < 1e-6) break;
        t -= (bx(t) - x) / d;
        t = Math.max(0, Math.min(1, t));
    }
    return by(t);
}

export class ItchCta {
    constructor() {
        this._plates = {};   // 'idle' | 'hover' -> canvas em resolução de arte
        this._url = null;
    }

    // Placa no estilo do PixelButton com o ícone pintado na reserva do texto.
    _plate(state) {
        if (this._plates[state]) return this._plates[state];
        const c = renderPixelButton(LABEL, state, document.createElement('canvas'), { face: 'red' });
        const g = c.getContext('2d');
        const x = 3 + PAD_X, y = 3 + 2;   // início do texto na face / topo do ícone
        const face = state === 'hover' ? '#fff6dc' : '#efe3c2';
        for (const [dy, color] of [[1, '#3a0610'], [0, face]]) {
            g.fillStyle = color;
            ICON.forEach((row, r) => {
                for (let k = 0; k < row.length; k++) if (row[k] === '#') g.fillRect(x + k, y + r + dy, 1, 1);
            });
        }
        return (this._plates[state] = c);
    }

    // Endereço em PixelFont, "itch.io" na cor da marca, sombra de 1 px.
    _urlArt() {
        if (this._url) return this._url;
        const parts = [['imkoro.', '#efe3c2'], ['itch.io', '#fa5c5c'], ['/dungeon-chained', '#efe3c2']];
        const c = document.createElement('canvas');
        c.width = measureText(ITCH_URL) + 1;
        c.height = 8;
        const g = c.getContext('2d');
        let x = 0;
        for (const [text, color] of parts) {
            drawText(g, text, x, 1, '#1a0508');
            drawText(g, text, x, 0, color);
            x += measureText(text) + 1;
        }
        return (this._url = c);
    }

    draw(ctx, W, H, t) {
        if (t < POP_DELAY) return;
        if (H > W) { this._drawPortrait(ctx, W, H, t); return; }
        const s = Math.max(3, Math.min(9, Math.round(H / 140)));   // = pixelScale() do START
        const barH = Math.round(H * 0.10);
        const raised = t > IDLE_DELAY && ((t - IDLE_DELAY) % IDLE_PERIOD) >= IDLE_PERIOD / 2;
        const plate = this._plate(raised ? 'hover' : 'idle');
        const pw = plate.width * s, ph = plate.height * s;
        // Mesmo lugar do START: centrado, base a 10% + 22 px do fundo.
        const cx = W / 2;
        const cy = H - (barH + 22) - ph / 2;
        const k = popEase(Math.min(1, (t - POP_DELAY) / POP_DUR));
        const sc = 0.2 + 0.8 * k;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        const dy = raised ? -s : 0;
        const w = pw * sc, h = ph * sc;
        ctx.drawImage(plate, Math.round(cx - w / 2), Math.round(cy - h / 2 + dy), Math.round(w), Math.round(h));

        // Endereço centrado na barra de cinema de baixo.
        const u = Math.min(1, Math.max(0, (t - URL_IN) / URL_FADE));
        if (u > 0) {
            const art = this._urlArt();
            const us = Math.max(2, Math.round(s * 0.6));
            const uw = art.width * us, uh = art.height * us;
            ctx.globalAlpha = u;
            ctx.drawImage(art, Math.round((W - uw) / 2), Math.round(H - barH / 2 - (uh - us) / 2), uw, uh);
        }
        ctx.restore();
    }

    /**
     * Vídeo VERTICAL (Reels/Shorts): placa grande a ~2/3 da altura e o
     * endereço legível logo abaixo — fora da barra de baixo e acima da área
     * que a legenda/botões do app cobrem. Uma faixa escura translúcida atrás
     * destaca os dois do fundo (explosão do plano final).
     */
    _drawPortrait(ctx, W, H, t) {
        const raised = t > IDLE_DELAY && ((t - IDLE_DELAY) % IDLE_PERIOD) >= IDLE_PERIOD / 2;
        const plate = this._plate(raised ? 'hover' : 'idle');
        const s = Math.max(3, Math.min(14, Math.floor(W * 0.8 / plate.width)));
        const pw = plate.width * s, ph = plate.height * s;
        const cx = W / 2, cy = Math.round(H * 0.675);
        const art = this._urlArt();
        const us = Math.max(2, Math.min(9, Math.floor(W * 0.78 / art.width)));
        const uw = art.width * us, uh = art.height * us;
        const uy = Math.round(cy + ph / 2 + s * 4);
        const k = popEase(Math.min(1, (t - POP_DELAY) / POP_DUR));
        const sc = 0.2 + 0.8 * k;

        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.globalCompositeOperation = 'source-over';
        // Faixa escura atrás da placa + endereço (entra junto com a placa).
        const band = Math.min(1, (t - POP_DELAY) / 0.35);
        const y0 = cy - ph * 1.1, y1 = uy + uh + ph * 0.7;
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, 'rgba(8, 2, 4, 0)');
        g.addColorStop(0.3, `rgba(8, 2, 4, ${0.55 * band})`);
        g.addColorStop(0.7, `rgba(8, 2, 4, ${0.55 * band})`);
        g.addColorStop(1, 'rgba(8, 2, 4, 0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, y0, W, y1 - y0);

        const dy = raised ? -s : 0;
        const w = pw * sc, h = ph * sc;
        ctx.drawImage(plate, Math.round(cx - w / 2), Math.round(cy - h / 2 + dy), Math.round(w), Math.round(h));

        const u = Math.min(1, Math.max(0, (t - URL_IN) / URL_FADE));
        if (u > 0) {
            ctx.globalAlpha = u;
            ctx.drawImage(art, Math.round((W - uw) / 2), uy, uw, uh);
        }
        ctx.restore();
    }
}
