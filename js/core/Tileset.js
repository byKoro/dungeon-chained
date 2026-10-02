/**
 * Tileset — carrega uma folha de tiles e desenha tiles por índice.
 *
 * O tileset.png é uma grade de 10x10 tiles de 16x16px. O índice é
 * linha * cols + coluna (0..99). Desenhamos com nearest-neighbor (pixel art)
 * em qualquer tamanho de mundo — usar tamanhos grandes dá o visual "chunky".
 */
export class Tileset {
    constructor(img, tileSize = 16, cols = 10) {
        this.img = img;
        this.tileSize = tileSize;
        this.cols = cols;
    }

    get ready() {
        return this.img && this.img.complete && this.img.naturalWidth > 0;
    }

    // Desenha o tile de índice 'index' cobrindo o retângulo (dx,dy,dw,dh) do mundo.
    // A câmera já cai em pixel inteiro de tela (ver Renderer.beginFrame), então
    // mantemos as coordenadas de mundo exatas e só estendemos levemente a
    // largura/altura (overlap) para fechar qualquer costura residual entre tiles.
    draw(ctx, index, dx, dy, dw, dh) {
        if (!this.ready) return;
        const t = this.tileSize;
        const sx = (index % this.cols) * t;
        const sy = ((index / this.cols) | 0) * t;
        const overlap = 0.5;
        ctx.drawImage(this.img, sx, sy, t, t, dx, dy, dw + overlap, dh + overlap);
    }
}
