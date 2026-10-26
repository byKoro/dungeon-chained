import { Entity } from './Entity.js';
import { PLAYER_DASH } from '../config/GameConfig.js';

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

        this.lastMoveX = 1; this.lastMoveY = 0;
        this.dashEnabled = false;
        this.dashing = false;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.dashDirX = 1; this.dashDirY = 0;
        this.justDashed = false;
        this.justEndedDash = false;
        this._dashHeld = false;
        this.afterimages = [];
        this._tintBuf = null;
        this._dashFlashT = 0;
        this._landT = 0;
    }

    get dashScale() {
        if (this.dashing) return 1 + PLAYER_DASH.stretch;
        if (this._landT <= 0) return 1;
        const k = 1 - this._landT / PLAYER_DASH.landSteps;
        const c1 = 1.70158, c3 = c1 + 1, m = k - 1;
        const easeOutBack = 1 + c3 * m * m * m + c1 * m * m;
        const from = 1 - PLAYER_DASH.landSquash;
        return from + (1 - from) * easeOutBack;
    }

    latchDashKey() {
        this._dashHeld = true;
    }

    get dashCharge() {
        if (this.dashing) return 0;
        return 1 - this.dashCooldown / PLAYER_DASH.cooldownSteps;
    }

    cancelDash() {
        this.afterimages.length = 0;
        this._dashFlashT = 0;
        this._landT = 0;
        if (!this.dashing) return;
        this.dashing = false;
        this.dashTimer = 0;
        this.dashCooldown = PLAYER_DASH.cooldownSteps;
    }

    _resetDash() {
        this.dashing = false;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.justDashed = false;
        this.justEndedDash = false;
        this.afterimages.length = 0;
        this._dashFlashT = 0;
        this._landT = 0;
    }

    _startDash() {
        const hasInput = this.moveX !== 0 || this.moveY !== 0;
        const dx = hasInput ? this.moveX : this.lastMoveX;
        const dy = hasInput ? this.moveY : this.lastMoveY;
        const mag = Math.hypot(dx, dy) || 1;
        this.dashDirX = dx / mag;
        this.dashDirY = dy / mag;
        this.dashing = true;
        this.dashTimer = PLAYER_DASH.durationSteps;
        this.justDashed = true;
        this.slideTimer = 0;
        this._dashFlashT = PLAYER_DASH.flashSteps;
        this._landT = 0;
        this.vx = this.dashDirX * PLAYER_DASH.speed;
        this.vy = this.dashDirY * PLAYER_DASH.speed;
    }

    _updateDash() {
        this.dashTimer--;
        if (this.dashTimer <= 0) {
            this.dashing = false;
            this.justEndedDash = true;
            this.dashCooldown = PLAYER_DASH.cooldownSteps;
            this._landT = PLAYER_DASH.landSteps;
            this.vx = this.dashDirX * PLAYER_DASH.exitSpeed;
            this.vy = this.dashDirY * PLAYER_DASH.exitSpeed;
            return;
        }
        this.vx = this.dashDirX * PLAYER_DASH.speed;
        this.vy = this.dashDirY * PLAYER_DASH.speed;
    }

    _updateAfterimages() {
        if (this._dashFlashT > 0) this._dashFlashT--;
        if (this._landT > 0 && !this.dashing) this._landT--;
        for (let i = this.afterimages.length - 1; i >= 0; i--) {
            if (--this.afterimages[i].life <= 0) this.afterimages.splice(i, 1);
        }
        if (!this.dashing || !this.sprite.animated) return;
        if ((PLAYER_DASH.durationSteps - this.dashTimer) % PLAYER_DASH.afterimageEvery !== 0) return;
        this.afterimages.push({
            x: this.x, y: this.y, tilt: this.tilt, facingLeft: this.facingLeft,
            scale: this.dashScale, sp: this.resolveSprite(), life: PLAYER_DASH.afterimageLife
        });
        if (this.afterimages.length > PLAYER_DASH.afterimages) this.afterimages.shift();
    }

    startFalling(tileCenterX, tileCenterY) {
        if (this.falling) return;
        this.falling = true;
        this.fallComplete = false;
        this.fallTimer = this.fallDuration;
        this.fallX = tileCenterX;
        this.fallY = tileCenterY;
        this.vx = 0; this.vy = 0;
        this.afterimages.length = 0;
        this._landT = 0;
    }

    respawnAt(x, y, invulnFrames = 0) {
        this.falling = false;
        this.fallComplete = false;
        this.fallTimer = 0;
        this.holeGrace = 0;
        this.x = x; this.y = y;
        this.vx = 0; this.vy = 0;
        this.invulnerableTimer = Math.max(this.invulnerableTimer, invulnFrames);
        this._resetDash();
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
            this.lastMoveX = moveX;
            this.lastMoveY = moveY;
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

        if (this.falling || this.dashing || this.invulnerableTimer > 0) return false;

        this.lives--;
        this.invulnerableTimer = 65;
        this.hurtTimer = this.hurtDuration;
        this.scaredTimer = this.scaredDuration;

        const pushAngle = Math.atan2(this.y - sourceY, this.x - sourceX);
        this.vx += Math.cos(pushAngle) * 16;
        this.vy += Math.sin(pushAngle) * 16;
        return true;
    }

    update(input, bounds, { canDash = false, feetInHole = false } = {}) {
        this.justDashed = false;
        this.justEndedDash = false;
        this.dashEnabled = canDash;

        const dashKey = this.controls[4];
        const dashDown = !!dashKey && input.isDown(dashKey);
        const dashPressed = dashDown && !this._dashHeld;
        this._dashHeld = dashDown;

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

        if (this.dashing) {
            this._updateDash();
        } else {
            if (this.dashCooldown > 0) this.dashCooldown--;
            this.handleInput(input);
            // Sair de dentro da beirada somaria até edgeMargin ao alcance e cruzaria vão de 2 tiles.
            const ready = canDash && !feetInHole && this.dashCooldown === 0 && this.hurtTimer === 0;
            if (dashPressed && ready) this._startDash();
        }
        super.update();
        this._updateAfterimages();

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
        if (this.speedMag > 0.25 && !this.dashing) {
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

    _tintedFrame(sp, color, amount) {
        const cw = sp.cropW, ch = sp.cropH;
        if (!this._tintBuf) this._tintBuf = document.createElement('canvas');
        const buf = this._tintBuf;
        if (buf.width !== cw || buf.height !== ch) { buf.width = cw; buf.height = ch; }
        const b = buf.getContext('2d');
        b.globalCompositeOperation = 'source-over';
        b.globalAlpha = 1;
        b.clearRect(0, 0, cw, ch);
        b.drawImage(sp.sheet, sp.frame * sp.cell + sp.cropX, sp.cropY, cw, ch, 0, 0, cw, ch);
        b.globalCompositeOperation = 'source-atop';
        b.globalAlpha = amount;
        b.fillStyle = color;
        b.fillRect(0, 0, cw, ch);
        return buf;
    }

    // Estica ao longo do dash (rotate → scale → unrotate), independente do flip do sprite.
    _applyDashScale(ctx, scale) {
        if (scale === 1) return;
        const a = Math.atan2(this.dashDirY, this.dashDirX);
        ctx.rotate(a);
        ctx.scale(scale, 1 / scale);
        ctx.rotate(-a);
    }

    _drawAfterimages(ctx) {
        const s = this.sprite;
        for (const g of this.afterimages) {
            const sp = g.sp;
            if (!sp.sheet || !sp.sheet.complete || !sp.sheet.naturalWidth) continue;
            const buf = this._tintedFrame(sp, this.color, PLAYER_DASH.afterimageTint);
            const scale = s.drawHeight / sp.cropH;
            const drawW = sp.cropW * scale, drawH = sp.cropH * scale;
            ctx.save();
            ctx.globalAlpha = PLAYER_DASH.afterimageAlpha * (g.life / PLAYER_DASH.afterimageLife);
            ctx.translate(g.x, g.y);
            this._applyDashScale(ctx, g.scale);
            ctx.rotate(g.tilt);
            if (g.facingLeft) ctx.scale(-1, 1);
            ctx.drawImage(buf, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
        }
    }

    draw(ctx) {
        if (this.afterimages.length) this._drawAfterimages(ctx);
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

        this._applyDashScale(ctx, this.dashScale);
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
                if (this._dashFlashT > 0) {
                    ctx.globalAlpha *= this._dashFlashT / PLAYER_DASH.flashSteps;
                    ctx.drawImage(this._tintedFrame(sp, '#ffffff', 1), -drawW / 2, -drawH / 2, drawW, drawH);
                }
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
