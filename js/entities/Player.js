import { Entity } from './Entity.js';

export class Player extends Entity {
    constructor(x, y, color, controls, spriteImg, name, spriteConfig = null) {
        super(x, y, 16);
        this.color = color;
        this.controls = controls; // ['up', 'down', 'left', 'right']
        this.img = spriteImg;
        this.name = name;
        this.speed = 4.2;
        this.lives = 3;
        this.invulnerableTimer = 0;
        this.hurtTimer = 0;

        // Configuração do sprite.
        // Spritesheet animado (P1): { animated:true, frameCount, cellSize, crop, drawSize }
        // Sprite único legado (P2):  { animated:false, drawSize }
        this.sprite = spriteConfig || { animated: false, drawSize: 46 };
        this.walkFrame = 0;   // acumulador contínuo do ciclo de andar
    }

    handleInput(input) {
        let moveX = 0;
        let moveY = 0;
        if (input.isDown(this.controls[0])) moveY -= 1;
        if (input.isDown(this.controls[1])) moveY += 1;
        if (input.isDown(this.controls[2])) moveX -= 1;
        if (input.isDown(this.controls[3])) moveX += 1;

        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.7071;
            moveY *= 0.7071;
        }

        this.vx = this.vx * 0.76 + moveX * this.speed * 0.24;
        this.vy = this.vy * 0.76 + moveY * this.speed * 0.24;
    }

    takeDamage(sourceX, sourceY) {
        if (this.invulnerableTimer > 0) return false;
        
        this.lives--;
        this.invulnerableTimer = 65;
        this.hurtTimer = 30;

        const pushAngle = Math.atan2(this.y - sourceY, this.x - sourceX);
        this.vx += Math.cos(pushAngle) * 16;
        this.vy += Math.sin(pushAngle) * 16;
        return true;
    }

    update(input, bounds) {
        if (this.invulnerableTimer > 0) this.invulnerableTimer--;
        if (this.hurtTimer > 0) this.hurtTimer--;

        this.handleInput(input);
        super.update();

        // Avança o ciclo de caminhada proporcional à velocidade real
        if (this.speedMag > 0.2) {
            this.walkFrame += this.speedMag * 0.18;
        } else {
            // Volta suavemente para a pose parada (frame 0)
            this.walkFrame = 0;
        }

        // Limites da arena
        this.x = Math.max(bounds.minX + this.hitRadius, Math.min(bounds.maxX - this.hitRadius, this.x));
        this.y = Math.max(bounds.minY + this.hitRadius, Math.min(bounds.maxY - this.hitRadius, this.y));
    }

    draw(ctx) {
        ctx.save();
        if (this.invulnerableTimer % 6 >= 3 && this.hurtTimer === 0) {
            ctx.globalAlpha = 0.4;
        }

        ctx.translate(this.x, this.y);

        // Tremor de dano
        if (this.hurtTimer > 0) {
            ctx.translate((Math.random() - 0.5) * 8, 0);
            ctx.rotate((Math.random() - 0.5) * 0.3);
        }

        if (this.facingLeft) ctx.scale(-1, 1);

        // Swaying orgânico bem sutil (o bobbing vertical já vem do próprio spritesheet)
        let swayAngle = 0;
        if (this.speedMag > 0.1) {
            swayAngle = Math.cos(this.animTimer * 0.5) * 0.02;
        }
        ctx.rotate(swayAngle);

        // Renderização do sprite
        if (this.img && this.img.complete && this.img.naturalWidth > 0) {
            const s = this.sprite;

            if (s.animated) {
                // Spritesheet de caminhada (ex.: 8 frames de 100x100)
                // Frame 0 = parado; frames 1..(frameCount-1) = ciclo de andar
                let frame = 0;
                if (this.speedMag > 0.2) {
                    frame = 1 + (Math.floor(this.walkFrame) % (s.frameCount - 1));
                }

                const cell = s.cellSize;             // tamanho da célula (ex.: 100)
                // Janela de recorte JUSTA em volta do boneco (bounding box + margem)
                const cw = s.cropW, ch = s.cropH;
                const srcX = frame * cell + s.cropX;
                const srcY = s.cropY;

                // Escala uniforme pela altura desejada, preservando a proporção do boneco
                const scale = s.drawHeight / ch;
                const drawW = cw * scale;
                const drawH = ch * scale;

                ctx.drawImage(
                    this.img,
                    srcX, srcY, cw, ch,
                    -drawW / 2, -drawH / 2, drawW, drawH
                );
            } else {
                // Sprite único legado, fatiado em topo/base com micro-bobbing
                const drawW = 36, drawH = 46;
                const halfH = this.img.naturalHeight / 2;
                ctx.drawImage(this.img, 0, halfH, this.img.naturalWidth, halfH, -drawW / 2, 0, drawW, drawH / 2);
                const headDip = this.speedMag > 0.1 ? Math.sin(this.animTimer) * 0.8 : 0;
                ctx.drawImage(this.img, 0, 0, this.img.naturalWidth, halfH, -drawW / 2, -drawH / 2 + headDip, drawW, drawH / 2);
            }
        }

        // Tint vermelho de dano
        if (this.hurtTimer > 0) {
            ctx.globalCompositeOperation = "source-atop";
            ctx.fillStyle = `rgba(255, 30, 30, ${Math.min(0.85, this.hurtTimer / 25)})`;
            ctx.fillRect(-50, -50, 100, 100);
        }

        ctx.restore();
    }
}