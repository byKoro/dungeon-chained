/**
 * SeamlessTileset — Tileset do trailer SEM as linhas finas entre tiles.
 *
 * O jogo trava a câmera em escala/posição inteiras, então os tiles casam
 * pixel a pixel. No trailer isso quebra: zoom interpolado, tremor da sala
 * (translate fracionário) e a ROTAÇÃO do drone deixam frestas de 1px entre
 * tiles vizinhos (e às vezes amostram o texel do tile ao lado na folha).
 *
 * Correção: cada tile é desenhado ~1px de TELA maior (sobrepõe o vizinho, que
 * é desenhado por cima na ordem normal) e a origem na folha é recuada uma
 * fração de texel para nunca pegar o tile vizinho.
 */
import { Tileset } from '../../core/Tileset.js';

const INSET = 0.02; // texels

export class SeamlessTileset extends Tileset {
    draw(ctx, index, dx, dy, dw, dh) {
        if (!this.ready) return;
        const t = this.tileSize;
        const sx = (index % this.cols) * t;
        const sy = ((index / this.cols) | 0) * t;
        const m = ctx.getTransform();
        const scale = Math.hypot(m.a, m.b) || 1;   // px de tela por px de mundo
        const ov = 1.25 / scale;                   // ~1px de tela de sobreposição
        ctx.drawImage(this.img, sx + INSET, sy + INSET, t - INSET * 2, t - INSET * 2,
            dx, dy, dw + ov, dh + ov);
    }
}
