/**
 * Fragmento de corpo (gib) gerado quando um inimigo é ferido/morto.
 *
 * É um recorte aleatório do sprite do inimigo que cai no chão e pode ser
 * ARRASTADO pela física de empurrão das entidades (tem pushVx/pushVy e
 * hitRadius, então participa de Physics.resolveEntityCollisions).
 *
 * Escurece gradualmente depois de assentar, como o cadáver fazia antes.
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
        this.drawW = drawW;
        this.drawH = drawH;

        // Raio de colisão aproximado (para ser empurrável/arrastável)
        this.hitRadius = Math.max(5, Math.min(drawW, drawH) * 0.4);

        // Canal de empurrão (mesmo esquema do MeleeEnemy)
        this.pushVx = 0;
        this.pushVy = 0;

        // Espalhamento inicial ao se partir
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 4.5;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        // Atrito menor => desliza mais fácil (mais arrastável)
        this.friction = 0.90;

        // Janela em que o corpo ainda pode ser ARRASTADO pela física. Depois
        // disso ele "assenta" no chão e passa a ignorar empurrões, integrando
        // ao ambiente. Curta pois há muitos fragmentos (~2.5s a 60fps).
        this.dragTimer = 150;
        this.settled = false;

        // Leve rotação estática para variedade visual
        this.angle = (Math.random() - 0.5) * 0.9;

        // Escurecimento progressivo
        this.settleTimer = 0;

        // Manchas de sangue permanentes leves sobre o pedaço (definidas via
        // stainWith, para usar a paleta da textura)
        this.stains = null;
    }

    // Preenchido pelo main.js com o componente BloodStains já populado.
    setStains(stains) {
        this.stains = stains;
    }

    // Depois que assenta, empurrões não têm mais efeito.
    canBeDragged() {
        return !this.settled;
    }

    update(bounds) {
        // Enquanto pode ser arrastado, aplica o empurrão da física.
        if (!this.settled) {
            this.x += this.pushVx;
            this.y += this.pushVy;
            this.dragTimer--;
            if (this.dragTimer <= 0) this.settled = true;
        } else {
            // Assentado: descarta qualquer empurrão residual
            this.pushVx = 0;
            this.pushVy = 0;
        }

        // Movimento do espalhamento inicial (sempre decai)
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.pushVx *= 0.88;
        this.pushVy *= 0.88;

        if (Math.abs(this.vx) < 0.03) this.vx = 0;
        if (Math.abs(this.vy) < 0.03) this.vy = 0;
        if (Math.abs(this.pushVx) < 0.01) this.pushVx = 0;
        if (Math.abs(this.pushVy) < 0.01) this.pushVy = 0;

        // Limites da arena
        if (bounds) {
            this.x = Math.max(bounds.minX, Math.min(bounds.maxX, this.x));
            this.y = Math.max(bounds.minY, Math.min(bounds.maxY, this.y));
        }

        this.settleTimer++;
    }

    draw(ctx) {
        if (!this.sheet || !this.sheet.complete || this.sheet.naturalWidth === 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Desenha o pedaço do sprite (sem ctx.filter, que é caro). O
        // escurecimento é aplicado só no carimbo final do BloodCanvas, quando o
        // gib é aposentado — enquanto ativo ele vive pouco, então dispensamos o
        // custo de escurecer em tempo real.
        ctx.drawImage(
            this.sheet,
            this.srcX, this.srcY, this.srcW, this.srcH,
            -this.drawW / 2, -this.drawH / 2, this.drawW, this.drawH
        );

        // Manchas de sangue sobre o pedaço (integra ao chão ensanguentado)
        if (this.stains) this.stains.draw(ctx, 1);

        ctx.restore();
    }
}
