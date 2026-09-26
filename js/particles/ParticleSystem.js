import { FloorDebris } from './FloorDebris.js';
import { DustPuff } from './DustPuff.js';

class AirParticle {
    constructor(x, y, color, isBlood = false, spread = 1) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.isBlood = isBlood;

        const pixelSizes = isBlood ? [3, 4, 5] : [3, 4, 6];
        this.size = pixelSizes[Math.floor(Math.random() * pixelSizes.length)];

        const angle = Math.random() * Math.PI * 2;
        const speed = ((isBlood ? 3 : 4) + Math.random() * (isBlood ? 8 : 11)) * spread;
        this.vx = Math.cos(angle) * speed + (Math.random() - 0.5) * 2;
        this.vy = Math.sin(angle) * speed - (1 + Math.random() * 3.5);

        this.gravity = 0.4;
        this.friction = 0.92;
        // Onde a gota vai assentar no chão. 'spread' amplia a dispersão para o
        // sangue cair espalhado e aleatório em volta do ponto de impacto.
        this.groundY = y + 12 + (Math.random() - 0.5) * 36 * spread;
        this.bounces = 0;
        this.maxBounces = 1 + Math.floor(Math.random() * 2);
        this.settled = false;
    }

    update(debrisList, bloodCanvas) {
        if (this.settled) return;

        this.vx *= this.friction;
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;

        if (this.y >= this.groundY) {
            this.y = this.groundY;
            this.bounces++;
            if (this.bounces < this.maxBounces && Math.abs(this.vy) > 1.4) {
                this.vy = -this.vy * 0.35;
                this.vx *= 0.6;
            } else {
                this.settled = true;
                if (this.isBlood && bloodCanvas) {
                    // Ao assentar, carimba um respingo pixelado no buffer de sangue.
                    bloodCanvas.stampSplat(this.x, this.y, 0.6 + Math.random() * 0.5);
                } else if (debrisList) {
                    // Fallback (detritos não-sangue): mancha simples no chão.
                    debrisList.push(new FloorDebris(this.x, this.y, this.size, this.size, this.color, false));
                }
            }
        }
    }

    draw(ctx) {
        if (this.settled) return;
        ctx.fillStyle = this.color;
        ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.size, this.size);
    }
}

export class ParticleSystem {
    constructor(bloodCanvas = null) {
        this.airParticles = [];
        this.floorDebris = [];
        this.smoke = [];                // baforadas de fumaça (poeira de corrida)
        this.bloodCanvas = bloodCanvas; // buffer offscreen do sangue de chão
    }

    clear() {
        this.airParticles = [];
        this.floorDebris = [];
        this.smoke = [];
        if (this.bloodCanvas) this.bloodCanvas.clear();
    }

    // Poeira de corrida PROCEDURAL: gera um conjunto de partículas de poeira
    // lançadas no sentido contrário à corrida. (dirX, dirY) = direção da corrida.
    triggerDust(x, y, dirX, dirY, amount = 10) {
        // pequeno jitter proporcional (não infla emissões pequenas de andar)
        const n = amount + ((Math.random() * Math.max(1, amount * 0.3)) | 0);
        for (let i = 0; i < n; i++) {
            // pequena dispersão na origem para não sair tudo do mesmo ponto
            const ox = (Math.random() - 0.5) * 8;
            const oy = (Math.random() - 0.5) * 6;
            this.smoke.push(new DustPuff(x + ox, y + oy, dirX, dirY));
        }
    }

    // Jato de sangue focado (sem pedaços/ossos). Usado ao matar inimigos e
    // ao player receber dano. 'amount' controla a intensidade; as gotas saltam
    // e assentam espalhadas e aleatórias pelo chão.
    triggerBlood(x, y, amount = 20, spread = 1) {
        const bloodColors = ["#4a0000", "#7a0404", "#a30808", "#c91818", "#d90429"];
        const count = amount + Math.floor(Math.random() * (amount * 0.5));
        for (let i = 0; i < count; i++) {
            const c = bloodColors[Math.floor(Math.random() * bloodColors.length)];
            this.airParticles.push(new AirParticle(x, y, c, true, spread));
        }
    }

    // Poça de sangue no local da morte: carimbada como geometria pixelada
    // complexa (elipses imperfeitas + quadriculados) no buffer de sangue.
    triggerBloodPool(x, y, scale = 1) {
        if (this.bloodCanvas) this.bloodCanvas.stampPool(x, y, scale);
    }

    triggerExplosion(x, y, isSkeleton) {
        const bloodColors = ["#4a0000", "#7a0404", "#a30808", "#c91818", "#d90429"];
        const boneColors = isSkeleton 
            ? ["#ffffff", "#e5e5e5", "#b8b8b8", "#595959"] 
            : ["#48cae4", "#0096c7", "#023e8a", "#e0fbfc"];

        const bloodCount = 22 + Math.floor(Math.random() * 10);
        for (let i = 0; i < bloodCount; i++) {
            const c = bloodColors[Math.floor(Math.random() * bloodColors.length)];
            this.airParticles.push(new AirParticle(x, y, c, true));
        }

        const pieceCount = 14 + Math.floor(Math.random() * 8);
        for (let i = 0; i < pieceCount; i++) {
            const c = boneColors[Math.floor(Math.random() * boneColors.length)];
            this.airParticles.push(new AirParticle(x, y, c, false));
        }
    }

    update(players, bounds) {
        // Atualiza detritos no chão (não-sangue; podem ser chutados)
        for (let i = 0; i < this.floorDebris.length; i++) {
            this.floorDebris[i].update(players, bounds);
        }

        // Atualiza partículas voando. Ao assentar, o sangue é carimbado no buffer.
        for (let i = this.airParticles.length - 1; i >= 0; i--) {
            this.airParticles[i].update(this.floorDebris, this.bloodCanvas);
            if (this.airParticles[i].settled) {
                this.airParticles.splice(i, 1);
            }
        }

        // Atualiza baforadas de fumaça e remove as que terminaram
        for (let i = this.smoke.length - 1; i >= 0; i--) {
            this.smoke[i].update();
            if (this.smoke[i].done) this.smoke.splice(i, 1);
        }
    }

    drawFloor(ctx) {
        // Sangue de chão (buffer offscreen) primeiro, depois detritos avulsos
        if (this.bloodCanvas) this.bloodCanvas.draw(ctx);
        for (let i = 0; i < this.floorDebris.length; i++) {
            this.floorDebris[i].draw(ctx);
        }
    }

    // Fumaça (poeira de corrida): desenhada na camada de chão, sob as entidades.
    drawSmoke(ctx) {
        for (let i = 0; i < this.smoke.length; i++) {
            this.smoke[i].draw(ctx);
        }
    }

    drawAir(ctx) {
        for (let i = 0; i < this.airParticles.length; i++) {
            this.airParticles[i].draw(ctx);
        }
    }
}