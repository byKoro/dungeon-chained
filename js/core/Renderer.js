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

        // Screen shake (em pixels de tela)
        let shakeX = 0, shakeY = 0;
        if (this.screenShake > 0) {
            shakeX = (Math.random() - 0.5) * this.screenShake;
            shakeY = (Math.random() - 0.5) * this.screenShake;
            this.screenShake *= 0.88;
            if (this.screenShake < 0.3) this.screenShake = 0;
        }

        // Câmera via setTransform: um ponto de mundo (wx,wy) vai para a tela em
        //   screen = wx*zoom + tx   (idem para y)
        // Arredondamos tx/ty (translação final em TELA) para pixel inteiro,
        // estabilizando o grid de rasterização e eliminando as costuras finas
        // entre tiles que aparecem ao mover a câmera (sub-pixel seam).
        const tx = Math.round(this.canvas.width / 2 - this.camX * this.zoom + shakeX);
        const ty = Math.round(this.canvas.height / 2 - this.camY * this.zoom + shakeY);
        this.ctx.setTransform(this.zoom, 0, 0, this.zoom, tx, ty);
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

    /** Define o tileset usado para desenhar as salas. */
    setTileset(tileset) {
        this.tileset = tileset;
    }

    /**
     * Preenche toda a área visível (mundo) com um tile de fundo. Usado para o
     * "vazio" fora da sala não ficar preto. Deve ser chamado dentro do
     * beginFrame/endFrame (usa o transform da câmera).
     */
    drawBackground(tileIndex, tile) {
        if (!this.tileset || !this.tileset.ready) return;
        // Cantos da viewport em coordenadas de mundo (com folga p/ o shake).
        const tl = this.screenToWorld(-tile, -tile);
        const br = this.screenToWorld(this.canvas.width + tile, this.canvas.height + tile);
        const x0 = Math.floor(tl.x / tile) * tile;
        const y0 = Math.floor(tl.y / tile) * tile;
        for (let y = y0; y < br.y; y += tile) {
            for (let x = x0; x < br.x; x += tile) {
                this.tileset.draw(this.ctx, tileIndex, x, y, tile, tile);
            }
        }
    }

    /**
     * Desenha a sala atual (tiles chunky) em coordenadas de MUNDO.
     * @param {object} rect     { x, y, w, h } retângulo total da célula
     * @param {object} bounds   { minX,maxX,minY,maxY } área jogável (fallback)
     * @param {RoomTiles} tiles mapa de tiles da sala (floor[][] + props[])
     * @param {number} tile     tamanho do tile no mundo (px)
     * @param {boolean} doorsOpen portas abertas (só para o realce visual)
     * @param {Array} doors     [{dir,x,y}] para realçar batente aberto/fechado
     * @param {number} doorHalf meia-largura do vão (para o realce)
     * @param {Array} boxes     obstáculos
     */
    drawRoom(rect, bounds, tiles, tile, doorsOpen, doors = [], doorHalf = 48) {
        const c = this.ctx;

        // Fallback simples caso o tileset ainda não tenha carregado
        if (!this.tileset || !this.tileset.ready || !tiles) {
            c.fillStyle = "#15141f";
            c.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
            c.fillStyle = "#0a0910";
            c.fillRect(rect.x, rect.y, rect.w, bounds.minY - rect.y);
            c.fillRect(rect.x, bounds.maxY, rect.w, rect.y + rect.h - bounds.maxY);
            c.fillRect(rect.x, rect.y, bounds.minX - rect.x, rect.h);
            c.fillRect(bounds.maxX, rect.y, rect.x + rect.w - bounds.maxX, rect.h);
            return;
        }

        // Desenha a grade de tiles (piso + moldura de parede + portas)
        for (let r = 0; r < tiles.rows; r++) {
            for (let col = 0; col < tiles.cols; col++) {
                const idx = tiles.floor[r][col];
                const dx = rect.x + col * tile;
                const dy = rect.y + r * tile;
                this.tileset.draw(c, idx, dx, dy, tile, tile);
            }
        }

        // Props decorativos (encostados nas paredes)
        for (const p of tiles.props) {
            const dx = rect.x + p.col * tile;
            const dy = rect.y + p.row * tile;
            this.tileset.draw(c, p.index, dx, dy, tile, tile);
        }

        if (!doorsOpen && tiles.doorCells) {
            // Portas FECHADAS (sala trancada): desenha o tile de porta no vão.
            for (const d of tiles.doorCells) {
                const dx = rect.x + d.col * tile;
                const dy = rect.y + d.row * tile;
                this.tileset.draw(c, d.index, dx, dy, tile, tile);
            }
        }
        // O gradiente das portas abertas é desenhado DEPOIS dos stubs de
        // corredor (ver drawDoorGradients, chamado pelo main.js).
    }

    // Público: gradiente das portas abertas (chamado após os stubs de corredor).
    drawDoorGradients(doors, doorHalf, tile, stubTiles = 0) {
        this._drawDoorGradients(doors, doorHalf, tile, stubTiles);
    }

    /**
     * Desenha "stubs" de corredor: tiles de piso projetados para FORA de cada
     * porta aberta, estendendo o chão da passagem alguns tiles para dentro do
     * corredor. Deve ser chamado logo após a sala (antes do gradiente).
     * @param stubTiles quantos tiles de piso projetar para fora
     * @param floorIdx índice do tile de piso a usar
     */
    drawDoorStubs(rect, doors, tile, doorHalf, stubTiles = 2, floorIdx = 17) {
        if (!this.tileset || !this.tileset.ready) return;
        const ctx = this.ctx;
        for (const d of doors) {
            // nº de tiles de piso que cabem na largura do vão (2 tiles)
            const across = Math.round((doorHalf * 2) / tile);
            for (let s = 1; s <= stubTiles; s++) {
                for (let k = 0; k < across; k++) {
                    let dx, dy;
                    if (d.dir === "N") {
                        dx = d.x - doorHalf + k * tile;
                        dy = d.y - s * tile;
                    } else if (d.dir === "S") {
                        dx = d.x - doorHalf + k * tile;
                        dy = d.y + (s - 1) * tile;
                    } else if (d.dir === "W") {
                        dx = d.x - s * tile;
                        dy = d.y - doorHalf + k * tile;
                    } else { // E
                        dx = d.x + (s - 1) * tile;
                        dy = d.y - doorHalf + k * tile;
                    }
                    this.tileset.draw(ctx, floorIdx, dx, dy, tile, tile);
                }
            }
        }
    }

    /**
     * Redesenha a PAREDE FRONTAL (fileira inferior de tiles) por cima das
     * entidades, para que quem encosta nela fique "atrás" da parede.
     * Deve ser chamado depois de desenhar players/inimigos.
     */
    drawFrontWall(rect, tiles, tile, doorsOpen, doors = [], doorHalf = 64, stubTiles = 0) {
        if (!this.tileset || !this.tileset.ready || !tiles) return;
        const r = tiles.rows - 1;

        // Colunas do vão da porta Sul (fileira inferior). Quando a sala está
        // ABERTA, essas células são PASSAGEM: não as redesenhamos por cima do
        // jogador (senão o piso do vão cobriria quem está entrando).
        const southDoorCols = new Set();
        if (doorsOpen && tiles.doorCells) {
            for (const d of tiles.doorCells) {
                if (d.row === r) southDoorCols.add(d.col);
            }
        }

        for (let col = 0; col < tiles.cols; col++) {
            if (southDoorCols.has(col)) continue; // pula o vão aberto
            const idx = tiles.floor[r][col];
            const dx = rect.x + col * tile;
            const dy = rect.y + r * tile;
            this.tileset.draw(this.ctx, idx, dx, dy, tile, tile);
        }

        if (!doorsOpen && tiles.doorCells) {
            // Porta FECHADA da base por cima.
            for (const d of tiles.doorCells) {
                if (d.row === r) {
                    this.tileset.draw(this.ctx, d.index, rect.x + d.col * tile, rect.y + d.row * tile, tile, tile);
                }
            }
        } else if (doorsOpen) {
            // Porta S ABERTA: a parede frontal taparia o gradiente do corredor
            // Sul. Redesenhamos SÓ o gradiente (escuro) por cima — o stub de
            // piso NÃO é redesenhado, para não cobrir os jogadores que estão
            // no corredor (o piso fica atrás deles, como deve ser).
            const south = doors.find(d => d.dir === "S");
            if (south) this._drawDoorGradients([south], doorHalf, tile, stubTiles);
        }
    }

    // Gradiente de entrada em cada porta aberta: da borda interna (transparente)
    // para fora da sala (cor escura), sugerindo a passagem escura adiante.
    _drawDoorGradients(doors, doorHalf, wallDepth, stubTiles = 0) {
        const c = this.ctx;
        // Cor do fundo (tile 78 ≈ rgb(37,19,26)). O gradiente representa um
        // CORREDOR escuro atrás da parede: começa transparente na borda interna
        // (o chão aparece) e escurece atravessando a parede para fora. Não
        // invade o piso jogável; apenas a faixa da parede/vão.
        const dark = "rgba(37, 19, 26, 1)";
        const clear = "rgba(37, 19, 26, 0)";
        // O caminho escuro vai da borda interna PARA FORA (afundando no
        // corredor), cobrindo também os stubs de piso projetados. Não invade o
        // piso jogável da sala.
        const depth = wallDepth * 2.5 + stubTiles * wallDepth;
        for (const d of doors) {
            c.save();
            let grad;
            if (d.dir === "N") {
                grad = c.createLinearGradient(0, d.y, 0, d.y - depth);
                grad.addColorStop(0, clear);
                grad.addColorStop(0.35, dark);
                grad.addColorStop(1, dark);
                c.fillStyle = grad;
                c.fillRect(d.x - doorHalf, d.y - depth, doorHalf * 2, depth);
            } else if (d.dir === "S") {
                grad = c.createLinearGradient(0, d.y, 0, d.y + depth);
                grad.addColorStop(0, clear);
                grad.addColorStop(0.35, dark);
                grad.addColorStop(1, dark);
                c.fillStyle = grad;
                c.fillRect(d.x - doorHalf, d.y, doorHalf * 2, depth);
            } else if (d.dir === "W") {
                grad = c.createLinearGradient(d.x, 0, d.x - depth, 0);
                grad.addColorStop(0, clear);
                grad.addColorStop(0.35, dark);
                grad.addColorStop(1, dark);
                c.fillStyle = grad;
                c.fillRect(d.x - depth, d.y - doorHalf, depth, doorHalf * 2);
            } else if (d.dir === "E") {
                grad = c.createLinearGradient(d.x, 0, d.x + depth, 0);
                grad.addColorStop(0, clear);
                grad.addColorStop(0.35, dark);
                grad.addColorStop(1, dark);
                c.fillStyle = grad;
                c.fillRect(d.x, d.y - doorHalf, depth, doorHalf * 2);
            }
            c.restore();
        }
    }
}