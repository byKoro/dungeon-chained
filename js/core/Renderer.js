export class Renderer {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.zoom = 1.50;         // zoom atual (animado)
        this.screenShake = 0;

        // Câmera: ponto do MUNDO que fica no centro da tela.
        this.camX = canvas.width / 2;
        this.camY = canvas.height / 2;
    }

    triggerShake(amount = 14) {
        this.screenShake = Math.max(this.screenShake, amount);
    }

    /**
     * Atualiza a câmera para seguir um alvo (px de mundo) com um zoom desejado,
     * de forma suave. Faz clamp para não mostrar além dos limites da sala.
     * @param {object} t { x, y, zoom, bounds } — bounds da sala (opcional)
     */
    updateCamera(t) {
        this.camX += (t.x - this.camX) * 0.12;
        this.camY += (t.y - this.camY) * 0.12;
        if (t.zoom) this.zoom += (t.zoom - this.zoom) * 0.08;

        // Clamp: mantém a câmera dentro dos limites da sala (não revela o vazio
        // fora dela). Só clampa no eixo se a sala for maior que a viewport.
        if (t.bounds) {
            const halfW = (this.canvas.width / 2) / this.zoom;
            const halfH = (this.canvas.height / 2) / this.zoom;
            const b = t.bounds;
            if (b.maxX - b.minX > halfW * 2) {
                this.camX = Math.max(b.minX + halfW, Math.min(b.maxX - halfW, this.camX));
            } else {
                this.camX = (b.minX + b.maxX) / 2;
            }
            if (b.maxY - b.minY > halfH * 2) {
                this.camY = Math.max(b.minY + halfH, Math.min(b.maxY - halfH, this.camY));
            } else {
                this.camY = (b.minY + b.maxY) / 2;
            }
        }
    }

    // Converte um ponto de tela (px) para coordenadas de mundo.
    screenToWorld(sx, sy) {
        return {
            x: this.camX + (sx - this.canvas.width / 2) / this.zoom,
            y: this.camY + (sy - this.canvas.height / 2) / this.zoom
        };
    }

    beginFrame() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();

        // Screen Shake
        if (this.screenShake > 0) {
            const sx = (Math.random() - 0.5) * this.screenShake;
            const sy = (Math.random() - 0.5) * this.screenShake;
            this.ctx.translate(sx, sy);
            this.screenShake *= 0.88;
            if (this.screenShake < 0.3) this.screenShake = 0;
        }

        // Câmera: centro da tela -> zoom -> desloca para o ponto (camX, camY).
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.translate(-this.camX, -this.camY);
    }

    endFrame() {
        this.ctx.restore();
    }

    drawRoundShadow(x, y, baseRadius, bounceFactor = 0) {
        this.ctx.save();
        const currentR = Math.max(6, baseRadius - bounceFactor * 1.5);
        this.ctx.translate(x, y + 17);

        const grad = this.ctx.createRadialGradient(0, 0, 1, 0, 0, currentR);
        grad.addColorStop(0, "rgba(0, 0, 0, 0.65)");
        grad.addColorStop(0.6, "rgba(0, 0, 0, 0.35)");
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");

        this.ctx.beginPath();
        this.ctx.arc(0, 0, currentR, 0, Math.PI * 2);
        this.ctx.fillStyle = grad;
        this.ctx.fill();
        this.ctx.restore();
    }

    /**
     * Desenha a sala atual em coordenadas de MUNDO (a câmera já aplicou o
     * transform em beginFrame).
     * @param {object} rect   { x, y, w, h } retângulo total da célula
     * @param {object} bounds { minX, maxX, minY, maxY } área jogável (interna)
     * @param {Array}  doors  [{ dir, x, y }] portas da sala
     * @param {number} doorHalf meia-largura do vão da porta
     * @param {boolean} doorsOpen portas abertas (sala limpa) ou fechadas
     * @param {Array}  boxes  obstáculos (opcional)
     */
    drawRoom(rect, bounds, doors, doorHalf, doorsOpen, boxes = []) {
        const c = this.ctx;
        const wallColor = "#0a0910";
        const floorColor = "#15141f";

        // Piso da área jogável
        c.fillStyle = floorColor;
        c.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

        // Grade do chão
        c.strokeStyle = "#1e1d2d";
        c.lineWidth = 2;
        for (let x = bounds.minX; x <= bounds.maxX; x += 40) {
            c.beginPath(); c.moveTo(x, bounds.minY); c.lineTo(x, bounds.maxY); c.stroke();
        }
        for (let y = bounds.minY; y <= bounds.maxY; y += 40) {
            c.beginPath(); c.moveTo(bounds.minX, y); c.lineTo(bounds.maxX, y); c.stroke();
        }

        // Paredes (moldura). Desenhamos as 4 barras ao redor da área jogável.
        c.fillStyle = wallColor;
        // topo e base
        c.fillRect(rect.x, rect.y, rect.w, bounds.minY - rect.y);
        c.fillRect(rect.x, bounds.maxY, rect.w, rect.y + rect.h - bounds.maxY);
        // esquerda e direita
        c.fillRect(rect.x, rect.y, bounds.minX - rect.x, rect.h);
        c.fillRect(bounds.maxX, rect.y, rect.x + rect.w - bounds.maxX, rect.h);

        // Vãos das portas: abre um "buraco" na parede pintando o piso no vão.
        for (const d of doors) {
            c.fillStyle = floorColor;
            if (d.dir === "N" || d.dir === "S") {
                const y0 = d.dir === "N" ? rect.y : bounds.maxY;
                c.fillRect(d.x - doorHalf, y0, doorHalf * 2, this.wallSizeY(rect, bounds, d.dir));
            } else {
                const x0 = d.dir === "W" ? rect.x : bounds.maxX;
                c.fillRect(x0, d.y - doorHalf, this.wallSizeX(rect, bounds, d.dir), doorHalf * 2);
            }

            // Batente da porta (fechada = vermelho, aberta = ciano)
            c.fillStyle = doorsOpen ? "#00ebc7" : "#e5484d";
            const t = 6;
            if (d.dir === "N" || d.dir === "S") {
                c.fillRect(d.x - doorHalf, d.y - t / 2, doorHalf * 2, t);
            } else {
                c.fillRect(d.x - t / 2, d.y - doorHalf, t, doorHalf * 2);
            }
        }

        // Contorno interno da área jogável
        c.strokeStyle = "#2d2a3e";
        c.lineWidth = 4;
        c.strokeRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

        // Caixas
        boxes.forEach(b => {
            this.drawRoundShadow(b.x + b.w / 2, b.y + b.h / 2, 22, 0);
            c.fillStyle = "#4a3c2c";
            c.fillRect(b.x, b.y, b.w, b.h);
            c.strokeStyle = "#282016";
            c.lineWidth = 3;
            c.strokeRect(b.x, b.y, b.w, b.h);
            c.beginPath();
            c.moveTo(b.x, b.y); c.lineTo(b.x + b.w, b.y + b.h);
            c.moveTo(b.x + b.w, b.y); c.lineTo(b.x, b.y + b.h);
            c.stroke();
        });
    }

    // Espessura da parede no eixo vertical para o vão N/S
    wallSizeY(rect, bounds, dir) {
        return dir === "N" ? (bounds.minY - rect.y) : (rect.y + rect.h - bounds.maxY);
    }
    // Espessura da parede no eixo horizontal para o vão E/W
    wallSizeX(rect, bounds, dir) {
        return dir === "W" ? (bounds.minX - rect.x) : (rect.x + rect.w - bounds.maxX);
    }
}