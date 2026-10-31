import { PLAYER_DASH } from '../../config/GameConfig.js';

/**
 * PlayerModel - Engine-agnostic player domain simulation.
 * Extracted from Player.js.
 * Zero browser or Canvas dependencies. Directly portable to C# class PlayerModel.
 */
export class PlayerModel {
    constructor(playerIndex = 0, x = 0, y = 0) {
        this.playerIndex = playerIndex;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.hitRadius = 16;
        this.speed = 4.2;
        this.speedScale = 1;

        this.lives = 3;
        this.maxLives = 3;
        this.infiniteLives = false;
        this.damageTaken = 0;

        this.invulnerableTimer = 0;
        this.hurtTimer = 0;
        this.hurtDuration = 30;
        this.scaredTimer = 0;
        this.scaredDuration = 120;

        this.facingLeft = playerIndex === 1;
        this.animTimer = 0;
        this.walkFrame = 0;
        this.bobPhase = 0;
        this.tilt = 0;

        this.slideTimer = 0;
        this.slideDuration = 10;
        this.stepDist = 0;
        this.stepSide = 1;
        this.justStepped = false;
        this.stepX = 0;
        this.stepY = 0;
        this.stepAngle = 0;
        this.bloodStepsLeft = 0;

        this.falling = false;
        this.fallComplete = false;
        this.fallTimer = 0;
        this.fallDuration = 34;
        this.fallX = 0;
        this.fallY = 0;

        this.lastMoveX = playerIndex === 0 ? 1 : -1;
        this.lastMoveY = 0;
        this.moveX = 0;
        this.moveY = 0;

        this.dashEnabled = false;
        this.dashing = false;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.dashDirX = 1;
        this.dashDirY = 0;
        this.justDashed = false;
        this.justEndedDash = false;
        this._dashHeld = false;
        this._dashFlashT = 0;
        this._landT = 0;
    }

    get speedMag() {
        return Math.hypot(this.vx, this.vy);
    }

    get dashScale() {
        if (this.dashing) return 1 + (PLAYER_DASH?.stretch ?? 0.35);
        if (this._landT <= 0) return 1;
        const landSteps = PLAYER_DASH?.landSteps ?? 8;
        const k = 1 - this._landT / landSteps;
        const c1 = 1.70158, c3 = c1 + 1, m = k - 1;
        const easeOutBack = 1 + c3 * m * m * m + c1 * m * m;
        const from = 1 - (PLAYER_DASH?.landSquash ?? 0.22);
        return from + (1 - from) * easeOutBack;
    }

    get dashCharge() {
        if (this.dashing) return 0;
        const cdSteps = PLAYER_DASH?.cooldownSteps ?? 42;
        return 1 - this.dashCooldown / cdSteps;
    }

    cancelDash() {
        this._dashFlashT = 0;
        this._landT = 0;
        if (!this.dashing) return;
        this.dashing = false;
        this.dashTimer = 0;
        this.dashCooldown = PLAYER_DASH?.cooldownSteps ?? 42;
    }

    _resetDash() {
        this.dashing = false;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.justDashed = false;
        this.justEndedDash = false;
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
        this.dashTimer = PLAYER_DASH?.durationSteps ?? 9;
        this.justDashed = true;
        this.slideTimer = 0;
        this._dashFlashT = PLAYER_DASH?.flashSteps ?? 6;
        this._landT = 0;
        const dSpeed = PLAYER_DASH?.speed ?? 11.5;
        this.vx = this.dashDirX * dSpeed;
        this.vy = this.dashDirY * dSpeed;
    }

    _updateDash() {
        this.dashTimer--;
        const dSpeed = PLAYER_DASH?.speed ?? 11.5;
        const exitSpeed = PLAYER_DASH?.exitSpeed ?? 3.8;
        if (this.dashTimer <= 0) {
            this.dashing = false;
            this.justEndedDash = true;
            this.dashCooldown = PLAYER_DASH?.cooldownSteps ?? 42;
            this._landT = PLAYER_DASH?.landSteps ?? 8;
            this.vx = this.dashDirX * exitSpeed;
            this.vy = this.dashDirY * exitSpeed;
            return;
        }
        this.vx = this.dashDirX * dSpeed;
        this.vy = this.dashDirY * dSpeed;
    }

    startFalling(tileCenterX, tileCenterY, events = null) {
        if (this.falling) return;
        this.falling = true;
        this.fallComplete = false;
        this.fallTimer = this.fallDuration;
        this.fallX = tileCenterX;
        this.fallY = tileCenterY;
        this.vx = 0;
        this.vy = 0;
        this._landT = 0;
        events?.emitPlayerFell(this.playerIndex, this.x, this.y);
    }

    respawnAt(x, y, invulnFrames = 0) {
        this.falling = false;
        this.fallComplete = false;
        this.fallTimer = 0;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.invulnerableTimer = Math.max(this.invulnerableTimer, invulnFrames);
        this._resetDash();
    }

    handleInput(input) {
        let moveX = input.moveX ?? 0;
        let moveY = input.moveY ?? 0;

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
            const spd = this.speed * (this.speedScale ?? 1);
            this.vx = this.vx * 0.76 + moveX * spd * 0.24;
            this.vy = this.vy * 0.76 + moveY * spd * 0.24;
            this.slideTimer = 0;
        } else {
            const decel = this.slideTimer > 0 ? 0.90 : 0.76;
            this.vx *= decel;
            this.vy *= decel;
            if (this.slideTimer > 0) this.slideTimer--;
        }
    }

    loseLife(amount = 1) {
        if (this.infiniteLives) return false;
        this.lives = Math.max(0, this.lives - amount);
        return true;
    }

    takeDamage(sourceX, sourceY, { knockback = 16 } = {}, events = null) {
        if (this.falling || this.dashing || this.invulnerableTimer > 0) return false;

        this.loseLife(1);
        this.damageTaken++;
        this.invulnerableTimer = 65;
        this.hurtTimer = this.hurtDuration;
        this.scaredTimer = this.scaredDuration;

        const pushAngle = Math.atan2(this.y - sourceY, this.x - sourceX);
        this.vx += Math.cos(pushAngle) * knockback;
        this.vy += Math.sin(pushAngle) * knockback;

        events?.emitEntityDamaged(this.playerIndex, this.x, this.y, 1, true, this.lives);
        events?.emitCameraShake(14);
        return true;
    }

    update(input, { canDash = false, feetInHole = false, speedScale = 1 } = {}, events = null) {
        this.speedScale = speedScale;
        this.justDashed = false;
        this.justEndedDash = false;
        this.justStepped = false;
        this.dashEnabled = canDash;

        const dashDown = !!input?.dash;
        const dashPressed = dashDown && !this._dashHeld;
        this._dashHeld = dashDown;

        if (this.falling) {
            this.x = this.fallX;
            this.y = this.fallY;
            this.vx = 0;
            this.vy = 0;
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
            if (input) this.handleInput(input);
            const ready = canDash && !feetInHole && this.dashCooldown === 0 && this.hurtTimer === 0;
            if (dashPressed && ready) {
                this._startDash();
                events?.emitPlayerDashed(this.playerIndex, this.dashDirX, this.dashDirY);
            }
        }

        this.x += this.vx;
        this.y += this.vy;

        const sm = this.speedMag;
        if (sm > 0.15) {
            this.animTimer += sm * 0.085;
        } else {
            this.animTimer *= 0.75;
        }

        if (this.vx < -0.1) this.facingLeft = true;
        if (this.vx > 0.1) this.facingLeft = false;

        if (this._dashFlashT > 0) this._dashFlashT--;
        if (this._landT > 0 && !this.dashing) this._landT--;

        if (!this.dashing && sm > 0.4) {
            this.stepDist += sm;
            if (this.stepDist >= 26) {
                this.stepDist = 0;
                this.stepSide *= -1;
                const dirX = this.vx / sm;
                const dirY = this.vy / sm;
                const perpX = -dirY * this.stepSide;
                const perpY = dirX * this.stepSide;
                const sideOffset = 5.5;

                this.stepX = this.x + perpX * sideOffset;
                this.stepY = this.y + 15 + perpY * sideOffset;
                this.stepAngle = Math.atan2(dirY, dirX);
                this.justStepped = true;
                const inBlood = this.bloodStepsLeft > 0;
                if (inBlood) this.bloodStepsLeft--;
                events?.emitPlayerFootstep(this.playerIndex, this.stepX, this.stepY, inBlood);
            }
        } else {
            this.stepDist = 0;
        }

        if (sm > 0.2) {
            this.walkFrame += sm * 0.18;
        } else {
            this.walkFrame = 0;
        }

        this.bobPhase += 0.12 + sm * 0.06;
        const tiltTarget = Math.max(-1, Math.min(1, this.vx / this.speed)) * 0.16;
        this.tilt += (tiltTarget - this.tilt) * 0.15;
    }

    getRenderState() {
        let animState = 'idle';
        if (this.falling) animState = 'falling';
        else if (this.hurtTimer > 0) animState = 'hurt';
        else if (this.dashing) animState = 'dash';
        else if (this.speedMag > 0.2) animState = 'walk';

        return {
            playerIndex: this.playerIndex,
            x: this.x,
            y: this.y,
            rotation: this.tilt,
            facingLeft: this.facingLeft,
            animState,
            animFrame: Math.floor(this.walkFrame),
            invulnerable: this.invulnerableTimer > 0,
            isFalling: this.falling,
            fallProgress: this.falling ? (1 - this.fallTimer / this.fallDuration) : 0,
            lives: this.lives,
            maxLives: this.maxLives,
            feetSortY: this.y + 23
        };
    }
}
