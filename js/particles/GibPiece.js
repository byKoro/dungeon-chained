export class GibPiece {
    constructor(x, y, sheet, srcX, srcY, srcW, srcH, drawW, drawH) {
        this.x = x;
        this.y = y;
        this.sheet = sheet;

        this.srcX = srcX;
        this.srcY = srcY;
        this.srcW = srcW;
        this.srcH = srcH;

        const side = Math.max(drawW, drawH);
        this.drawW = side;
        this.drawH = side;

        this.vx = (Math.random() - 0.5) * 6;
        this.vy = -(3 + Math.random() * 5);
        this.gravity = 0.45;

        this.angle = Math.random() * Math.PI * 2;
        this.spin = (Math.random() - 0.5) * 0.4;

        this.done = false;

        this.stains = null;
    }

    setStains(stains) {
        this.stains = stains;
    }

    update(bounds) {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.angle += this.spin;

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
