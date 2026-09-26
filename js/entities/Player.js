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
        this.hurtDuration = 30;    // duração do balanço/pose de impacto (frames)
        this.scaredTimer = 0;      // após o dano, anda "assustado" por um tempo
        this.scaredDuration = 120; // ~2s a 60fps

        // Configuração do sprite.
        // Spritesheet animado (P1): {
        //   animated:true, frameCount, cellSize, cropX/Y/W/H, drawHeight,
        //   hurt:   { img, frameCount, hurtFrame, cellSize, cropX/Y/W/H },  // pose de impacto
        //   scared: { img, frameCount, cellSize, cropX/Y/W/H }             // andar assustado
        // }
        // Sprite único legado (P2): { animated:false, drawSize }
        this.sprite = spriteConfig || { animated: false, drawSize: 46 };
        this.walkFrame = 0;   // acumulador contínuo do ciclo de andar (compartilhado entre walks)

    }

    // Seleciona a folha e o frame corretos conforme o estado atual do player.
    // Prioridade: impacto (hurt) > assustado (scared) > caminhada normal (walk).
    // Todos os ciclos de caminhada compartilham this.walkFrame, então a troca
    // entre "andar assustado" e "andar normal" fica perfeitamente sincronizada.
    resolveSprite() {
        const s = this.sprite;

        const hasSheet = (cfg) => cfg && cfg.img && cfg.img.complete && cfg.img.naturalWidth > 0;

        // Índice do frame de caminhada atual (0 = parado; 1..frameCount-1 = passos)
        const walkFrameIndex = () => {
            if (this.speedMag <= 0.2) return 0;
            return 1 + (Math.floor(this.walkFrame) % (s.frameCount - 1));
        };

        // Monta o descritor de recorte a partir de uma config de folha
        const build = (img, cfg, frame) => ({
            sheet: img,
            cell: cfg.cellSize,
            cropX: cfg.cropX, cropY: cfg.cropY, cropW: cfg.cropW, cropH: cfg.cropH,
            frame
        });

        // 1) Impacto: pose fixa de dano
        if (this.hurtTimer > 0 && hasSheet(s.hurt)) {
            const frame = Math.min(s.hurt.hurtFrame, s.hurt.frameCount - 1);
            return build(s.hurt.img, s.hurt, frame);
        }

        // 2) Assustado: mesmo ciclo de andar, porém na folha "scared"
        if (this.scaredTimer > 0 && hasSheet(s.scared)) {
            return build(s.scared.img, s.scared, walkFrameIndex());
        }

        // 3) Caminhada normal (folha principal, this.img)
        return build(this.img, s, walkFrameIndex());
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
        this.hurtTimer = this.hurtDuration;
        this.scaredTimer = this.scaredDuration;

        const pushAngle = Math.atan2(this.y - sourceY, this.x - sourceX);
        this.vx += Math.cos(pushAngle) * 16;
        this.vy += Math.sin(pushAngle) * 16;
        return true;
    }

    update(input, bounds) {
        if (this.invulnerableTimer > 0) this.invulnerableTimer--;
        if (this.hurtTimer > 0) this.hurtTimer--;
        if (this.scaredTimer > 0) this.scaredTimer--;

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

        // Balanço BRUSCO ao receber dano (mais forte no impacto, decaindo com o tempo)
        if (this.hurtTimer > 0) {
            const intensity = this.hurtTimer / this.hurtDuration; // 1 -> 0
            const shake = 16 * intensity;
            ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake * 0.5);
            ctx.rotate((Math.random() - 0.5) * 0.55 * intensity);
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
                // Escolhe folha + frame conforme o estado (impacto/assustado/normal)
                const sp = this.resolveSprite();
                const cw = sp.cropW, ch = sp.cropH;
                const srcX = sp.frame * sp.cell + sp.cropX;
                const srcY = sp.cropY;

                // Escala uniforme pela altura desejada, preservando a proporção do boneco
                const scale = s.drawHeight / ch;
                const drawW = cw * scale;
                const drawH = ch * scale;

                ctx.drawImage(
                    sp.sheet,
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

        ctx.restore();
    }
}