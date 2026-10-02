import { HAZARDS } from '../config/GameConfig.js';

/**
 * Arrow — projétil de flecha. Viaja em linha reta na direção (dirX,dirY) até
 * sair dos bounds ou acertar um player. Forma geométrica por enquanto.
 */
export class Arrow {
    constructor(x, y, dirX, dirY) {
        this.x = x;
        this.y = y;
        const cfg = HAZARDS.arrow;
        const len = Math.hypot(dirX, dirY) || 1;
        this.dx = (dirX / len) * cfg.speed;
        this.dy = (dirY / len) * cfg.speed;
        this.angle = Math.atan2(this.dy, this.dx);
        this.hitRadius = cfg.hitRadius;
        this.life = cfg.maxLifeFrames;
        this.dead = false;
    }

    // Avança e checa colisão. Devolve o player atingido (ou null).
    update(players, bounds) {
        this.x += this.dx;
        this.y += this.dy;
        if (--this.life <= 0) { this.dead = true; return null; }

        // Saiu da área jogável (bate na parede) -> somem.
        const m = 8;
        if (this.x < bounds.minX - m || this.x > bounds.maxX + m ||
            this.y < bounds.minY - m || this.y > bounds.maxY + m) {
            this.dead = true;
            return null;
        }

        for (const p of players) {
            if (Math.hypot(p.x - this.x, p.y - this.y) < this.hitRadius + p.hitRadius) {
                this.dead = true;
                if (p.takeDamage(this.x, this.y)) return p;
                return null;
            }
        }
        return null;
    }

    draw(ctx) {
        const cfg = HAZARDS.arrow;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        // Haste
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = cfg.width;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-cfg.length / 2, 0);
        ctx.lineTo(cfg.length / 2, 0);
        ctx.stroke();
        // Ponta
        ctx.fillStyle = cfg.headColor;
        ctx.beginPath();
        ctx.moveTo(cfg.length / 2 + 6, 0);
        ctx.lineTo(cfg.length / 2 - 3, -5);
        ctx.lineTo(cfg.length / 2 - 3, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}

/**
 * ArrowTrap — atirador de flechas montado numa parede, com indicador visível.
 *
 * A cada `intervalFrames` ele telegrafa (indicador pulsa/muda de cor por
 * `warnFrames`) e então dispara uma flecha atravessando o corredor na direção
 * `dir`. O indicador e a flecha são formas geométricas (sprites virão depois).
 *
 * O trap NÃO guarda as flechas: ao disparar, chama `onFire(arrow)` para que o
 * dono (Room/Game) as gerencie num pool compartilhado.
 */
export class ArrowTrap {
    /**
     * @param {number} x posição do emissor (na parede)
     * @param {number} y
     * @param {{x:number,y:number}} dir direção de disparo (será normalizada)
     * @param {object} opts { phaseOffset:0..1 }
     */
    constructor(x, y, dir, opts = {}) {
        this.x = x;
        this.y = y;
        this.hitRadius = 0;
        const len = Math.hypot(dir.x, dir.y) || 1;
        this.dirX = dir.x / len;
        this.dirY = dir.y / len;

        this.cfg = HAZARDS.arrowTrap;
        this.t = Math.floor((opts.phaseOffset || 0) * this.cfg.intervalFrames) % this.cfg.intervalFrames;
        this.pulse = 0;
        this._fired = false;
    }

    get isWarning() {
        return this.t >= this.cfg.intervalFrames - this.cfg.warnFrames;
    }

    update(onFire) {
        this.t = (this.t + 1) % this.cfg.intervalFrames;
        this.pulse += 0.2;
        if (this.isWarning) {
            if (!this._fired && this.t === this.cfg.intervalFrames - 1) {
                // último frame do warn: dispara
                this._fired = true;
                // nasce um pouco à frente da boca do atirador
                const sx = this.x + this.dirX * 14;
                const sy = this.y + this.dirY * 14;
                onFire(new Arrow(sx, sy, this.dirX, this.dirY));
            }
        } else {
            this._fired = false;
        }
    }

    draw(ctx) {
        const cfg = this.cfg;
        const warn = this.isWarning;
        const s = cfg.indicatorSize;
        // Pulso mais rápido/forte durante o warn.
        const pulse = warn ? (0.6 + 0.4 * Math.abs(Math.sin(this.pulse * 1.6))) : 0.75;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(Math.atan2(this.dirY, this.dirX));

        // Base montada na parede (losango).
        ctx.fillStyle = "#2a2330";
        ctx.strokeStyle = "#4a4055";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-s * 0.5, 0);
        ctx.lineTo(0, -s * 0.5);
        ctx.lineTo(s * 0.5, 0);
        ctx.lineTo(0, s * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Olho/boca apontando na direção de disparo (triângulo).
        ctx.globalAlpha = pulse;
        ctx.fillStyle = warn ? cfg.indicatorWarnColor : cfg.indicatorColor;
        ctx.beginPath();
        ctx.moveTo(s * 0.1, -s * 0.28);
        ctx.lineTo(s * 0.55, 0);
        ctx.lineTo(s * 0.1, s * 0.28);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}
