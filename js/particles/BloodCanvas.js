/**
 * BloodCanvas — sangue procedural desenhado num buffer offscreen.
 *
 * Em vez de manter centenas de objetos de sangue e redesenhá-los todo frame,
 * "carimbamos" o sangue uma única vez neste buffer do tamanho do mundo e
 * copiamos o buffer inteiro para a tela por frame. O sangue vira parte
 * permanente do chão (até o buffer ser limpo na troca de fase).
 *
 * O visual é montado com geometrias pixeladas: elipses imperfeitas (bordas
 * irregulares) preenchidas em blocos + "quadriculados" (blocos soltos) ao
 * redor, todos com cores amostradas de assets/particles/blood.png.
 */
export class BloodCanvas {
    constructor(width, height, textureImg) {
        this.width = width;
        this.height = height;

        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext("2d");
        this.ctx.imageSmoothingEnabled = false;

        // Paleta amostrada da textura (preenchida quando a imagem carregar)
        this.palette = [
            "#830623", "#a30808", "#c60f0e", "#960e11", "#7a0404"
        ];
        this.textureImg = textureImg || null;
        if (this.textureImg) {
            if (this.textureImg.complete && this.textureImg.naturalWidth > 0) {
                this._extractPalette();
            } else {
                this.textureImg.addEventListener("load", () => this._extractPalette());
            }
        }
    }

    _extractPalette() {
        try {
            const t = document.createElement("canvas");
            t.width = this.textureImg.naturalWidth;
            t.height = this.textureImg.naturalHeight;
            const tctx = t.getContext("2d");
            tctx.drawImage(this.textureImg, 0, 0);
            const { data } = tctx.getImageData(0, 0, t.width, t.height);
            const cols = [];
            for (let i = 0; i < data.length; i += 4) {
                const a = data[i + 3];
                if (a > 10) {
                    cols.push(`rgb(${data[i]}, ${data[i + 1]}, ${data[i + 2]})`);
                }
            }
            if (cols.length) this.palette = cols;
        } catch (e) {
            // Se a leitura falhar (ex.: canvas "tainted"), mantém a paleta padrão.
        }
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    _color() {
        return this.palette[(Math.random() * this.palette.length) | 0];
    }

    /**
     * Carimba uma elipse pixelada imperfeita.
     * @param {number} cx centro X
     * @param {number} cy centro Y
     * @param {number} rx raio horizontal
     * @param {number} ry raio vertical
     * @param {number} px tamanho do "pixel"/bloco
     * @param {number} density 0..1 chance de preencher cada bloco (buracos)
     */
    stampBlob(cx, cy, rx, ry, px = 3, density = 0.92) {
        const ctx = this.ctx;
        const x0 = Math.floor((cx - rx) / px) * px;
        const y0 = Math.floor((cy - ry) / px) * px;
        const x1 = Math.ceil((cx + rx) / px) * px;
        const y1 = Math.ceil((cy + ry) / px) * px;

        for (let y = y0; y <= y1; y += px) {
            for (let x = x0; x <= x1; x += px) {
                // Centro do bloco
                const bx = x + px / 2;
                const by = y + px / 2;
                const nx = (bx - cx) / rx;
                const ny = (by - cy) / ry;
                const d = nx * nx + ny * ny;

                // Ruído na borda: quanto mais perto de 1, mais chance de "falhar",
                // deixando a borda irregular/pixelada.
                const edgeNoise = (Math.random() - 0.5) * 0.35;
                if (d + edgeNoise <= 1) {
                    if (Math.random() <= density) {
                        ctx.fillStyle = this._color();
                        ctx.fillRect(x, y, px, px);
                    }
                }
            }
        }
    }

    /**
     * Espalha "quadriculados" (blocos soltos) em volta de um ponto, para dar
     * o aspecto de respingo sujo.
     */
    stampSpecks(cx, cy, spread, count, px = 3) {
        const ctx = this.ctx;
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * spread;
            const bx = Math.round((cx + Math.cos(a) * r) / px) * px;
            const by = Math.round((cy + Math.sin(a) * r) / px) * px;
            const size = px * (1 + (Math.random() < 0.3 ? 1 : 0)); // alguns 2x
            ctx.fillStyle = this._color();
            ctx.fillRect(bx, by, size, size);
        }
    }

    /**
     * Respingo (ao ferir/receber dano): uma mancha central pequena + specks.
     */
    stampSplat(x, y, scale = 1) {
        const px = 3;
        const rx = (6 + Math.random() * 6) * scale;
        const ry = (4 + Math.random() * 5) * scale;
        this.stampBlob(x, y, rx, ry, px, 0.9);
        this.stampSpecks(x, y, (18 + Math.random() * 14) * scale, 8 + ((Math.random() * 8) | 0), px);
    }

    /**
     * Poça (no local da morte): várias elipses sobrepostas + bastante specks,
     * formando uma geometria maior e mais complexa.
     */
    stampPool(x, y, scale = 1) {
        const px = 3;
        const blobs = 4 + ((Math.random() * 4) | 0);
        for (let i = 0; i < blobs; i++) {
            const ox = (Math.random() - 0.5) * 22 * scale;
            const oy = (Math.random() - 0.5) * 14 * scale;
            const rx = (10 + Math.random() * 12) * scale;
            const ry = (7 + Math.random() * 8) * scale;
            this.stampBlob(x + ox, y + oy, rx, ry, px, 0.94);
        }
        // Respingos ao redor da poça
        this.stampSpecks(x, y, 40 * scale, 20 + ((Math.random() * 16) | 0), px);
    }

    /**
     * Carimba um GibPiece assentado no buffer, uma única vez, para que ele
     * saia do loop de update/draw (grande ganho de performance). Desenha o
     * recorte do sprite com rotação, um overlay de escurecimento e as manchas.
     */
    stampGib(gib) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(gib.x, gib.y);
        ctx.rotate(gib.angle);

        ctx.drawImage(
            gib.sheet,
            gib.srcX, gib.srcY, gib.srcW, gib.srcH,
            -gib.drawW / 2, -gib.drawH / 2, gib.drawW, gib.drawH
        );

        if (gib.stains) gib.stains.draw(ctx, 1);

        ctx.restore();
    }

    draw(ctx) {
        ctx.drawImage(this.canvas, 0, 0);
    }
}
