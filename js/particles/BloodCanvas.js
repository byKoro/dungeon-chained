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
    constructor(width, height, palette = null) {
        this.width = width;
        this.height = height;

        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;
        this.ctx = this.canvas.getContext("2d");
        this.ctx.imageSmoothingEnabled = false;

        // Paleta de cores do sangue (controlada externamente). Fallback padrão.
        this.palette = (palette && palette.length)
            ? palette
            : ["#830623", "#a30808", "#c60f0e", "#960e11", "#7a0404"];

        // Zonas de sangue "molhado" (círculos) registradas em código, para
        // detectar passos sem ler pixels (getImageData é custoso). As PEGADAS
        // de sangue NÃO registram zonas — assim o jogador não re-detecta as
        // próprias pegadas (evita o efeito de "espalhar infinito").
        this.zones = [];
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.zones = [];
    }

    // Registra uma zona de sangue "molhado" (círculo) para detecção de passos.
    addZone(x, y, radius) {
        this.zones.push({ x, y, r: radius });
        // Teto simples para não crescer indefinidamente
        if (this.zones.length > 200) this.zones.shift();
    }

    _color() {
        return this.palette[(Math.random() * this.palette.length) | 0];
    }

    // Verifica (por geometria, sem ler pixels) se (x,y) está sobre uma zona de
    // sangue molhado. Rápido: só distância a círculos registrados.
    isBloodZone(x, y) {
        for (let i = 0; i < this.zones.length; i++) {
            const z = this.zones[i];
            const dx = x - z.x, dy = y - z.y;
            if (dx * dx + dy * dy <= z.r * z.r) return true;
        }
        return false;
    }

    // Carimba uma pegada de sangue pixelada (fixa) no buffer, orientada por
    // 'angle' (direção do passo). 'intensity' 0..1 controla o tamanho/opacidade
    // (vai diminuindo a cada passo até "secar").
    stampFootprint(x, y, angle, intensity = 1) {
        const ctx = this.ctx;
        const px = 2;
        const len = (2.5 + 2 * intensity); // comprimento da pegada (menor)
        const wid = (1.5 + 1 * intensity); // largura (menor)
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.globalAlpha = 0.5 + 0.5 * intensity;
        // Elipse pixelada simples (sola do pé)
        for (let yy = -wid; yy <= wid; yy += px) {
            for (let xx = -len; xx <= len; xx += px) {
                const nx = xx / len, ny = yy / wid;
                if (nx * nx + ny * ny <= 1 && Math.random() < 0.85) {
                    ctx.fillStyle = this._color();
                    ctx.fillRect(Math.round(xx), Math.round(yy), px, px);
                }
            }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
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
        // Zona molhada (para pegadas): raio aproximado da mancha central
        this.addZone(x, y, Math.max(rx, ry) + 3);
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
        // Zona molhada da poça (maior)
        this.addZone(x, y, 26 * scale);
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
