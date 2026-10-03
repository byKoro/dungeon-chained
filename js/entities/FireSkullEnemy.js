
import { Entity } from './Entity.js';

/** Crânio flutuante que atira bolas de fogo retas no jogador mais próximo. */
export class FireSkullEnemy extends Entity {
    constructor(x, y, sheet) {
        super(x, y, 13);
        this.sheet = sheet;
        this.state = 'alive';
        this.dyingTimer = 0;
        this.fireballs = [];
        this.animTime = Math.random() * 30;
        this.shotCooldown = 55;
        this.shotInterval = 105;
        this.hoverTime = Math.random() * Math.PI * 2;
        this.hoverOffset = 0;
    }

    get isDead() { return this.state === 'dead'; }
    get isDying() { return this.state === 'dying'; }
    get readyToGib() { return this.state === 'dying' && this.dyingTimer <= 0; }

    update(players, onPlayerHit = () => {}) {
        this.animTime++;
        this.hoverTime += 0.055;
        this.hoverOffset = Math.sin(this.hoverTime) * 4;

        if (this.state === 'dying') {
            if (this.dyingTimer > 0) this.dyingTimer--;
            return;
        }
        if (this.state === 'dead') return;

        const targets = players.filter(p => p && p.lives > 0);
        if (targets.length) {
            let target = targets[0];
            for (const player of targets) {
                if (Math.hypot(player.x - this.x, player.y - this.y) < Math.hypot(target.x - this.x, target.y - this.y)) target = player;
            }
            this.facingLeft = target.x < this.x;
            if (this.shotCooldown-- <= 0) {
                const angle = Math.atan2(target.y - this.y, target.x - this.x);
                this.fireballs.push({ x: this.x, y: this.y + this.hoverOffset, vx: Math.cos(angle) * 3.2, vy: Math.sin(angle) * 3.2, age: 0 });
                this.shotCooldown = this.shotInterval;
            }
        }

        for (let i = this.fireballs.length - 1; i >= 0; i--) {
            const ball = this.fireballs[i];
            ball.x += ball.vx;
            ball.y += ball.vy;
            ball.age++;
            let hit = false;
            for (const player of targets) {
                if (Math.hypot(player.x - ball.x, player.y - ball.y) < player.hitRadius + 5) {
                    if (player.takeDamage(ball.x, ball.y)) onPlayerHit(player);
                    hit = true;
                    break;
                }
            }
            if (hit || ball.age > 180) this.fireballs.splice(i, 1);
        }
    }

    startDying() {
        if (this.state !== 'alive') return;
        this.state = 'dying';
        this.dyingTimer = 9;
        this.fireballs.length = 0;
    }

    explodeIntoGibs() { return []; }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y + this.hoverOffset);
        if (this.facingLeft) ctx.scale(-1, 1);
        const whiteFlash = this.state === 'dying' && Math.floor(this.dyingTimer / 2) % 2 === 0;
        ctx.filter = whiteFlash ? 'brightness(0) invert(1)' : 'none';

        if (this.sheet && this.sheet.complete && this.sheet.naturalWidth) {
            const frame = Math.floor(this.animTime / 9) % 6;
            ctx.drawImage(this.sheet, frame * 16, 0, 16, 20, -18, -19, 36, 40);
        } else {
            ctx.fillStyle = '#ff8b2b';
            ctx.beginPath();
            ctx.arc(0, 0, 13, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
        for (const ball of this.fireballs) {
            ctx.save();
            ctx.translate(ball.x, ball.y);
            ctx.rotate(Math.atan2(ball.vy, ball.vx));
            if (this.sheet && this.sheet.complete && this.sheet.naturalWidth) {
                const frame = Math.floor(ball.age / 5) % 6;
                ctx.drawImage(this.sheet, frame * 16, 20, 16, 20, -10, -10, 20, 20);
            } else {
                ctx.fillStyle = '#ff542f';
                ctx.beginPath();
                ctx.arc(0, 0, 6, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }
}
