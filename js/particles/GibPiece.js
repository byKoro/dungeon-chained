/**
 * Fragmento de corpo (gib) gerado quando um inimigo morre.
 *
 * O corpo se estilhaça em vários QUADRADOS (recortes do sprite) que são
 * lançados com força para fora e VOAM PARA FORA DA TELA, girando. Não assentam
 * nem ficam no chão: são removidos assim que saem dos limites visíveis.
 */
export class GibPiece {
    constructor(x, y, sheet, srcX, srcY, srcW, srcH, drawW, drawH) {
        this.x = x;
        this.y = y;
        this.sheet = sheet;

        // Região da folha que este pedaço mostra
        this.srcX = srcX;
        this.srcY = srcY;
        this.srcW = srcW;
        this.srcH = srcH;

        // Desenha como QUADRADO (usa o maior lado para ficar quadradinho)
        const side = Math.max(drawW, drawH);
        this.drawW = side;
        this.drawH = side;

        // Estilhaço: espalha um pouco na horizontal e é lançado para cima; a
        // gravidade puxa e os pedaços CAEM para fora pela parte de baixo da tela.
        this.vx = (Math.random() - 0.5) * 6;
        this.vy = -(3 + Math.random() * 5); // impulso inicial para cima
        this.gravity = 0.45;

        // Rotação animada (gira enquanto voa/cai)
        this.angle = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 0.4;

        this.done = false;

        // Manchas de sangue leves sobre o pedaço (opcional)
        this.stains = null;
    }

    setStains(stains) {
        this.stains = stains;
    }

    update(bounds) {
        this.vy += this.gravity;   // gravidade puxa para baixo
        this.x += this.vx;
        this.y += this.vy;
        this.angle += this.spin;

        // Removido ao sair da área visível (principalmente caindo por baixo).
        if (bounds) {
            const margin = 80;
            if (this.y > bounds.maxY + margin ||
                this.x < bounds.minX - margin || this.x > bounds.maxX + margin) {
                this.done = true;
            }
        }
    }

    draw(ctx) {
        if (!this.sheet || !this.sheet.complete || this.sheet.naturalWidth === 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.drawImage(
            this.sheet,
            this.srcX, this.srcY, this.srcW, this.srcH,
            -this.drawW / 2, -this.drawH / 2, this.drawW, this.drawH
        );

        if (this.stains) this.stains.draw(ctx, 1);

        ctx.restore();
    }
}
