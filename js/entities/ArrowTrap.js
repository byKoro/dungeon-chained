import { HAZARDS, TILE } from '../config/GameConfig.js';

/**
 * Arrow — projétil de flecha. Viaja em linha reta na direção (dirX,dirY) até
 * sair dos bounds ou acertar um player. Forma geométrica por enquanto.
 */
export class Arrow {
    constructor(x, y, dirX, dirY, sprite = null) {
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
        this.sprite = sprite;
        this.lifeSeconds = cfg.maxLifeFrames / 60;
    }

    // Avança e checa colisão. Devolve o player atingido (ou null).
    update(players, bounds, deltaSeconds = 1 / 60) {
        const frameScale = Math.max(0, deltaSeconds) * 60;
        this.x += this.dx * frameScale;
        this.y += this.dy * frameScale;
        this.lifeSeconds -= Math.max(0, deltaSeconds);
        if (this.lifeSeconds <= 0) { this.dead = true; return null; }

        // A flecha nasce dentro do tile da parede. Mantém-se viva até cruzar
        // a parede oposta, em vez de morrer ao sair dos bounds de piso.
        const m = TILE;
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
        if (this.sprite && this.sprite.complete && this.sprite.naturalWidth > 0) {
            const length = cfg.length + 12;
            // Compensa o eixo do sprite para que a ponta siga a direção do voo.
            ctx.rotate(-Math.PI / 2);
            ctx.drawImage(this.sprite, -length / 2, -length / 2, length, length);
            ctx.restore();
            return;
        }
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
 * `dir`. Usa os sprites de assets/arrow, com fallback geométrico.
 *
 * O trap NÃO guarda as flechas: ao disparar, chama `onFire(arrow)` para que o
 * dono (Room/Game) as gerencie num pool compartilhado.
 */
export class ArrowTrap {
    /**
     * @param {number} x posição do emissor (na parede)
     * @param {number} y
     * @param {{x:number,y:number}} dir direção de disparo (será normalizada)
     * @param {object} opts { phaseOffset:0..1, sprites, arrowSprite }
     */
    constructor(x, y, dir, opts = {}) {
        this.x = x;
        this.y = y;
        this.hitRadius = 0;
        const len = Math.hypot(dir.x, dir.y) || 1;
        this.dirX = dir.x / len;
        this.dirY = dir.y / len;

        this.cfg = HAZARDS.arrowTrap;
        this.sprites = opts.sprites || null;
        this.arrowSprite = opts.arrowSprite || null;
        this.intervalSeconds = this.cfg.intervalFrames / 60;
        this.warnSeconds = this.cfg.warnFrames / 60;
        this.elapsed = ((opts.phaseOffset || 0) % 1) * this.intervalSeconds;
        this.hasFiredThisCycle = false;
        this.pulse = 0;
        // true SÓ no passo em que disparou (o Game toca o som do disparo).
        this.justFired = false;
    }

    get isWarning() {
        return (this.elapsed % this.intervalSeconds) >= this.intervalSeconds - this.warnSeconds;
    }

    update(onFire, deltaSeconds = 1 / 60) {
        const dt = Math.max(0, deltaSeconds);
        this.elapsed += dt;
        this.pulse += dt * 3;
        this.justFired = false;

        // Dispara no início do último quadro, quando o sprite mostra a flecha saindo.
        const launchAt = this.intervalSeconds - this.warnSeconds * 0.25;
        if (!this.hasFiredThisCycle && this.elapsed >= launchAt) {
            const sx = this.x + this.dirX * 14;
            const sy = this.y + this.dirY * 14;
            onFire(new Arrow(sx, sy, this.dirX, this.dirY, this.arrowSprite));
            this.hasFiredThisCycle = true;
            this.justFired = true;
        }

        if (this.elapsed >= this.intervalSeconds) {
            this.elapsed %= this.intervalSeconds;
            this.hasFiredThisCycle = false;
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
        // Alinha o eixo da sequência do sprite com a direção do disparo.
        ctx.rotate(Math.atan2(this.dirY, this.dirX) - Math.PI / 2);

        const warnProgress = this.warnSeconds > 0
            ? Math.max(0, Math.min(0.999, (this.elapsed - (this.intervalSeconds - this.warnSeconds)) / this.warnSeconds))
            : 0;
        // A animação sai do quadro vazio e avança até a flecha estendida durante o aviso.
        const firingFrames = [1, 2, 3, 0]; // quadro vazio, flecha saindo, totalmente estendida
        const spriteIndex = warn ? firingFrames[Math.floor(warnProgress * firingFrames.length)] : 1;
        const sprite = this.sprites && this.sprites[spriteIndex];
        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            const width = cfg.indicatorSize * 1.6;
            const height = width * (sprite.naturalHeight / sprite.naturalWidth);
            ctx.globalAlpha = pulse;
            ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
            ctx.restore();
            return;
        }

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
