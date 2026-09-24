import { Entity } from './Entity.js';

export class Enemy extends Entity {
    constructor(x, y, spriteCol, spriteRow, isSkeleton, sheet) {
        super(x, y, 18);
        this.spriteCol = spriteCol;
        this.spriteRow = spriteRow;
        this.isSkeleton = isSkeleton;
        this.sheet = sheet;
        this.speed = 1.9;
        this.animTimer = Math.random() * Math.PI * 2;
    }

    update(players, onPlayerHit) {
        // Encontra o player mais próximo
        const d1 = Math.hypot(players[0].x - this.x, players[0].y - this.y);
        const d2 = Math.hypot(players[1].x - this.x, players[1].y - this.y);
        const target = d1 < d2 ? players[0] : players[1];

        // Perseguição
        const angle = Math.atan2(target.y - this.y, target.x - this.x);
        this.vx = this.vx * 0.85 + Math.cos(angle) * this.speed * 0.15;
        this.vy = this.vy * 0.85 + Math.sin(angle) * this.speed * 0.15;

        super.update();

        // Colisão com os jogadores
        players.forEach(p => {
            const dist = Math.hypot(p.x - this.x, p.y - this.y);
            if (dist < p.hitRadius + this.hitRadius + 2) {
                if (p.takeDamage(this.x, this.y)) {
                    onPlayerHit();
                }
            }
        });
    }

    draw(ctx, gw = 16, gh = 16) {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.facingLeft) ctx.scale(-1, 1);

        let bobY = 0, swayAngle = 0;
        if (this.speedMag > 0.1) {
            bobY = -Math.abs(Math.sin(this.animTimer)) * 3.5;
            swayAngle = Math.cos(this.animTimer * 0.5) * 0.09;
        }
        ctx.translate(0, bobY);
        ctx.rotate(swayAngle);

        if (this.sheet && this.sheet.complete) {
            const drawSize = 44;
            const halfH = gh / 2;
            const sx = this.spriteCol * gw;
            const sy = this.spriteRow * gh;

            ctx.drawImage(this.sheet, sx, sy + halfH, gw, halfH, -drawSize / 2, 0, drawSize, drawSize / 2);
            const headDip = this.speedMag > 0.1 ? Math.sin(this.animTimer) * 0.8 : 0;
            ctx.drawImage(this.sheet, sx, sy, gw, halfH, -drawSize / 2, -drawSize / 2 + headDip, drawSize, drawSize / 2);
        }
        ctx.restore();
    }
}