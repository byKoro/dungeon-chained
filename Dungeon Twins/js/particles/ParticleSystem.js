import { FloorDebris } from './FloorDebris.js';

class AirParticle {
    constructor(x, y, color, isBlood = false) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.isBlood = isBlood;

        const pixelSizes = isBlood ? [3, 4, 5] : [3, 4, 6];
        this.size = pixelSizes[Math.floor(Math.random() * pixelSizes.length)];

        const angle = Math.random() * Math.PI * 2;
        const speed = (isBlood ? 3 : 4) + Math.random() * (isBlood ? 8 : 11);
        this.vx = Math.cos(angle) * speed + (Math.random() - 0.5) * 2;
        this.vy = Math.sin(angle) * speed - (1 + Math.random() * 3.5);

        this.gravity = 0.4;
        this.friction = 0.92;
        this.groundY = y + 12 + (Math.random() - 0.5) * 36;
        this.bounces = 0;
        this.maxBounces = 1 + Math.floor(Math.random() * 2);
        this.settled = false;
    }

    update(debrisList) {
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
                const isSplash = this.isBlood && Math.random() > 0.4;
                const w = isSplash ? this.size + 2 : this.size;
                const h = isSplash ? Math.max(2, this.size - 1) : this.size;
                debrisList.push(new FloorDebris(this.x, this.y, w, h, this.color, this.isBlood));
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
    constructor() {
        this.airParticles = [];
        this.floorDebris = [];
    }

    clear() {
        this.airParticles = [];
        this.floorDebris = [];
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
        // Atualiza detritos no chão (que podem ser chutados)
        for (let i = 0; i < this.floorDebris.length; i++) {
            this.floorDebris[i].update(players, bounds);
        }

        // Atualiza partículas voando
        for (let i = this.airParticles.length - 1; i >= 0; i--) {
            this.airParticles[i].update(this.floorDebris);
            if (this.airParticles[i].settled) {
                this.airParticles.splice(i, 1);
            }
        }
    }

    drawFloor(ctx) {
        for (let i = 0; i < this.floorDebris.length; i++) {
            this.floorDebris[i].draw(ctx);
        }
    }

    drawAir(ctx) {
        for (let i = 0; i < this.airParticles.length; i++) {
            this.airParticles[i].draw(ctx);
        }
    }
}