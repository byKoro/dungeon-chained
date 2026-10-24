export class Tileset {
    constructor(img, tileSize = 16, cols = 10) {
        this.img = img;
        this.tileSize = tileSize;
        this.cols = cols;
    }

    get ready() {
        return this.img && this.img.complete && this.img.naturalWidth > 0;
    }

    draw(ctx, index, dx, dy, dw, dh) {
        if (!this.ready) return;
        const t = this.tileSize;
        const sx = (index % this.cols) * t;
        const sy = ((index / this.cols) | 0) * t;
        ctx.drawImage(this.img, sx, sy, t, t, dx, dy, dw, dh);
    }
}
