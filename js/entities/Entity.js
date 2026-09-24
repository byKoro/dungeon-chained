export class Entity {
    constructor(x, y, hitRadius = 16) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.hitRadius = hitRadius;
        this.markedForDeletion = false;
        this.facingLeft = false;
        this.animTimer = 0;
    }

    get speedMag() {
        return Math.hypot(this.vx, this.vy);
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // Atualização da animação proporcional à velocidade real de caminhada
        if (this.speedMag > 0.15) {
            this.animTimer += this.speedMag * 0.085;
        } else {
            this.animTimer *= 0.75;
        }

        if (this.vx < -0.1) this.facingLeft = true;
        if (this.vx > 0.1) this.facingLeft = false;
    }

    draw(ctx) {
        // Implementado pelas subclasses
    }
}