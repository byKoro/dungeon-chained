import { Entity } from './Entity.js';

export class Player extends Entity {
    constructor(x, y, color, controls, spriteImg, name, spriteConfig = null) {
        super(x, y, 16);
        this.color = color;
        this.controls = controls;
        this.img = spriteImg;
        this.name = name;
        this.speed = 4.2;
        this.lives = 3;
        this.invulnerableTimer = 0;
        this.hurtTimer = 0;
        this.hurtDuration = 30;
        this.scaredTimer = 0;
        this.scaredDuration = 120;

        this.expression = null;

        this.sprite = spriteConfig || { animated: false, drawSize: 46 };
        this.walkFrame = 0;

        this.bobPhase = 0;
        this.tilt = 0;

        this.wasRunning = false;
        this.justStartedRunning = false;

        this.slideTimer = 0;
        this.slideDuration = 10;
        this.justStopped = false;
        this.stopDirX = 0; this.stopDirY = 0;
        this.stopSpeed = 0;

        this.stepDist = 0;
        this.stepSide = 1;
        this.justStepped = false;
        this.stepX = 0; this.stepY = 0; this.stepAngle = 0;
        this.bloodStepsLeft = 0;

        this.falling = false;
        this.fallComplete = false;
        this.fallTimer = 0;
        this.fallDuration = 34;
        this.fallX = 0;
        this.fallY = 0;
    }

    startFalling(tileCenterX, tileCenterY) {
        if (this.falling) return;
        this.falling = true;
        this.fallComplete = false;
        this.fallTimer = this.fallDuration;
        this.fallX = tileCenterX;
        this.fallY = tileCenterY;
        this.vx = 0; this.vy = 0;
    }

    respawnAt(x, y, invulnFrames = 0) {
        this.falling = false;
        this.fallComplete = false;
        this.fallTimer = 0;
        this.holeGrace = 0;
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.invulnerableTimer = Math.max(this.invulnerableTimer, invulnFrames);
    }

    resolveSprite() {
        const s = this.sprite;

        const hasSheet = (cfg) => cfg && cfg.img && cfg.img.complete && cfg.img.naturalWidth > 0;

        const walkFrameIndex = () => {
            if (this.speedMag <= 0.2) return 0;
            return 1 + (Math.floor(this.walkFrame) % (s.frameCount - 1));
        };

        const build = (img, cfg, frame) => ({
            sheet: img,
            cell: cfg.cellSize,
            cropX: cfg.cropX, cropY: cfg.cropY, cropW: cfg.cropW, cropH: cfg.cropH,
            frame
        });

        if (this.hurtTimer > 0 && hasSheet(s.hurt)) {
            const frame = Math.min(s.hurt.hurtFrame, s.hurt.frameCount - 1);
            return build(s.hurt.img, s.hurt, frame);
        }

        if (this.expression && s.expressions) {
            const e = s.expressions[this.expression];
            if (hasSheet(e)) return build(e.img, e, walkFrameIndex());
        }

        if (this.scaredTimer > 0 && hasSheet(s.scared)) {
            return build(s.scared.img, s.scared, walkFrameIndex());
        }

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

        const hasInput = moveX !== 0 || moveY !== 0;

        this.moveX = moveX;
        this.moveY = moveY;

        if (hasInput) {

            this.vx = this.vx * 0.76 + moveX * this.speed * 0.24;
            this.vy = this.vy * 0.76 + moveY * this.speed * 0.24;
            this.slideTimer = 0;
        } else {

            const decel = this.slideTimer > 0 ? 0.90 : 0.76;
            this.vx *= decel;
            this.vy *= decel;
            if (this.slideTimer > 0) this.slideTimer--;
        }
    }

    takeDamage(sourceX, sourceY) {

        if (this.falling || this.invulnerableTimer > 0) return false;

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

        if (this.falling) {
            this.x = this.fallX;
            this.y = this.fallY;
            this.vx = 0; this.vy = 0;
            if (this.fallTimer > 0) {
                this.fallTimer--;
                if (this.fallTimer === 0) this.fallComplete = true;
            }
            return;
        }

        if (this.invulnerableTimer > 0) this.invulnerableTimer--;
        if (this.hurtTimer > 0) this.hurtTimer--;
        if (this.scaredTimer > 0) this.scaredTimer--;

        this.handleInput(input);
        super.update();

        if (this.speedMag > 0.2) {
            this.walkFrame += this.speedMag * 0.18;
        } else {

            this.walkFrame = 0;
        }

        this.bobPhase += 0.12 + this.speedMag * 0.06;

        const tiltTarget = Math.max(-1, Math.min(1, this.vx / this.speed)) * 0.16;
        this.tilt += (tiltTarget - this.tilt) * 0.15;

        if (this.vx < -0.15) this.facingLeft = true;
        else if (this.vx > 0.15) this.facingLeft = false;

        const running = this.speedMag > this.speed * 0.55;
        this.justStartedRunning = running && !this.wasRunning;

        this.justStopped = false;
        if (this.wasRunning && !running && this.speedMag > this.speed * 0.2) {
            this.justStopped = true;
            this.slideTimer = this.slideDuration;
            const mag = this.speedMag || 1;
            this.stopDirX = this.vx / mag;
            this.stopDirY = this.vy / mag;
            this.stopSpeed = this.speedMag;
        }

        if (running) this.wasRunning = true;
        else if (this.speedMag < this.speed * 0.35) this.wasRunning = false;

        this.justStepped = false;
        const STEP_LENGTH = 20;
        if (this.speedMag > 0.25) {
            this.stepDist += this.speedMag;
            if (this.stepDist >= STEP_LENGTH) {
                this.stepDist = 0;
                this.stepSide *= -1;

                const mag = this.speedMag || 1;
                const dirX = this.vx / mag;
                const dirY = this.vy / mag;

                const perpX = -dirY, perpY = dirX;
                const sideOffset = 5 * this.stepSide;

                this.stepX = this.x + perpX * sideOffset;
                this.stepY = this.y + 15 + perpY * sideOffset;
                this.stepAngle = Math.atan2(dirY, dirX);
                this.justStepped = true;
            }
        } else {
            this.stepDist = 0;
        }

    }

    draw(ctx) {
        ctx.save();
        if (this.invulnerableTimer % 6 >= 3 && this.hurtTimer === 0) {
            ctx.globalAlpha = 0.4;
        }

        ctx.translate(this.x, this.y);

        if (this.falling) {
            const t = 1 - (this.fallTimer / this.fallDuration);
            const shrink = Math.max(0, 1 - t);
            ctx.translate(0, t * 10);
            ctx.rotate(t * 1.6);
            ctx.scale(shrink, shrink);
            ctx.globalAlpha = Math.max(0, 1 - t * 0.8);
        }

        if (this.hurtTimer > 0 && !this.falling) {
            const intensity = this.hurtTimer / this.hurtDuration;
            const shake = 16 * intensity;
            ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake * 0.5);
            ctx.rotate((Math.random() - 0.5) * 0.55 * intensity);
        }

        const moveAmount = Math.min(1, this.speedMag / this.speed);
        const bobAngle = Math.sin(this.bobPhase) * 0.03 * moveAmount;
        const bobY = Math.abs(Math.sin(this.bobPhase)) * 2.2 * moveAmount;
        ctx.translate(0, -bobY);

        ctx.rotate(this.tilt + bobAngle);

        if (this.facingLeft) ctx.scale(-1, 1);

        if (this.img && this.img.complete && this.img.naturalWidth > 0) {
            const s = this.sprite;

            if (s.animated) {

                const sp = this.resolveSprite();
                const cw = sp.cropW, ch = sp.cropH;
                const srcX = sp.frame * sp.cell + sp.cropX;
                const srcY = sp.cropY;

                const scale = s.drawHeight / ch;
                const drawW = cw * scale;
                const drawH = ch * scale;

                ctx.drawImage(
                    sp.sheet,
                    srcX, srcY, cw, ch,
                    -drawW / 2, -drawH / 2, drawW, drawH
                );
            } else {

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
