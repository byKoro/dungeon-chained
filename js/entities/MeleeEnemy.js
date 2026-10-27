import { TILE } from '../config/GameConfig.js';
import { ENEMY_HIT } from '../config/CombatFeelConfig.js';
import { Entity } from './Entity.js';
import { GibPiece } from '../particles/GibPiece.js';
import { BloodStains } from '../particles/BloodStains.js';

let tintBuf = null;

// Recorte do sprite pintado com `color` só nos pixels opacos (flash de acerto).
function tintedCrop(sheet, sx, sy, w, h, color, alpha) {
    if (!tintBuf) tintBuf = document.createElement('canvas');
    if (tintBuf.width !== w || tintBuf.height !== h) { tintBuf.width = w; tintBuf.height = h; }
    const b = tintBuf.getContext('2d');
    b.globalCompositeOperation = 'source-over';
    b.globalAlpha = 1;
    b.clearRect(0, 0, w, h);
    b.drawImage(sheet, sx, sy, w, h, 0, 0, w, h);
    b.globalCompositeOperation = 'source-atop';
    b.globalAlpha = alpha;
    b.fillStyle = color;
    b.fillRect(0, 0, w, h);
    return tintBuf;
}

export class MeleeEnemy extends Entity {
    constructor(x, y, sheet, spriteConfig, floor = 1) {
        super(x, y, 18);
        this.sheet = sheet;
        this.sprite = spriteConfig;
        this.isSkeleton = false;

        this.hp = spriteConfig.combat?.hp ?? 1;
        this.hitTimer = 0;
        this.speed = spriteConfig.combat?.speed ?? 1.7;

        this.poiseMax = spriteConfig.combat?.poise ?? 0;
        this.poise = this.poiseMax;
        this.poiseRegenTimer = 0;
        this.flashTimer = 0;
        this.flashTotal = 0;
        this.vulnerableTimer = 0;
        this._hurtPose = null;

        this.attackRange = 44;
        this.hitRange = 58;

        this.baseWindup = 55;
        this.windupFrames = Math.max(16, this.baseWindup - (floor - 1) * 6);
        this.windupFrames = spriteConfig.combat?.windupFrames ?? this.windupFrames;
        this.recoverFrames = spriteConfig.combat?.recoverFrames ?? 28;

        this.state = "chase";
        this.stateTimer = 0;
        this.dealtHit = false;

        this.dyingTimer = 0;
        this.dyingDuration = 9;

        this.attackKeys = ["attack", "attack2", "attack3"].filter(k => this.sprite.rows[k]);
        this.currentAttack = this.attackKeys[0] || "attack";

        this.bloodPalette = null;
        this.gibStainConfig = null;

        this.pushVx = 0;
        this.pushVy = 0;

        this.animTime = 0;
        this.deathDone = false;
        this.corpseTimer = 0;

        this.target = null;
        this.stepDistance = 0;
        this.justStepped = false;
        this.justAttacked = false;

        this.navigationFloor = null;
        this.navigationBounds = null;
        this.navigationWalls = new Set();
        this.lastSafePosition = { x, y };

        this.frozen = false;

        this.spawnFxDuration = 40;
        this.spawnFx = 0;

        this.spawnDelay = 0;
        this.justAppeared = false;
    }

    beginFrozenSpawn(delay = 0) {
        this.frozen = true;
        this.spawnDelay = Math.max(0, delay | 0);

        this.spawnFx = this.spawnDelay > 0 ? 0 : this.spawnFxDuration;
        this.justAppeared = this.spawnDelay === 0;
        this.vx = this.vy = this.pushVx = this.pushVy = 0;
    }

    get isHidden() {
        return this.spawnDelay > 0;
    }

    get drawHeight() {
        const s = this.sprite;
        if (s?.body) return s.body.h * (s.drawHeight / s.cropH);
        return s?.drawHeight ?? 44;
    }

    _anchorY() {
        const s = this.sprite;
        return s.body ? s.body.y + s.body.h / 2 : s.cropY + s.cropH / 2;
    }

    get footY() {
        return this.y + this.drawHeight / 2;
    }

    unfreeze() {
        this.frozen = false;
    }

    setNavigationFloor(floor, bounds, walls = []) {
        this.navigationFloor = floor;
        this.navigationBounds = bounds;
        this.navigationWalls = new Set(walls.map(w => `${w.col},${w.row}`));
        this.lastSafePosition = { x: this.x, y: this.y };
    }

    _tileAt(x, y) {
        const col = Math.floor((x - this.navigationBounds.minX) / TILE) + 1;
        const row = Math.floor((y - this.navigationBounds.minY) / TILE) + 1;
        return { col, row };
    }

    _isWalkable(x, y) {
        if (!this.navigationFloor || !this.navigationBounds) return true;
        const { col, row } = this._tileAt(x, y);
        return row > 0 && row < this.navigationFloor.length - 1 &&
            col > 0 && col < (this.navigationFloor[row] || []).length - 1 &&
            this.navigationFloor[row][col] !== -1 &&
            !this.navigationWalls.has(String(col) + "," + String(row));
    }

    _hasClearWalkablePath(target) {
        if (!this.navigationFloor || !this.navigationBounds) return true;
        const dx = target.x - this.x, dy = target.y - this.y;
        const steps = Math.ceil(Math.hypot(dx, dy) / (TILE / 4));
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            if (!this._isWalkable(this.x + dx * t, this.y + dy * t)) return false;
        }
        return true;
    }
    _chaseWaypoint(target) {
        if (!this.navigationFloor || !this.navigationBounds) return target;
        const start = this._tileAt(this.x, this.y);
        const goal = this._tileAt(target.x, target.y);
        if (!this._isWalkable(this.x, this.y) || !this._isWalkable(target.x, target.y)) return null;
        const key = (col, row) => String(col) + "," + String(row);
        const startKey = key(start.col, start.row);
        const goalKey = key(goal.col, goal.row);
        const queue = [start];
        const previous = new Map([[startKey, null]]);
        const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let q = 0; q < queue.length && !previous.has(goalKey); q++) {
            const cell = queue[q];
            for (const [dc, dr] of directions) {
                const col = cell.col + dc, row = cell.row + dr;
                if (row <= 0 || row >= this.navigationFloor.length - 1 || col <= 0 || col >= this.navigationFloor[row].length - 1) continue;
                if (this.navigationFloor[row][col] === -1 || this.navigationWalls.has(String(col) + "," + String(row))) continue;
                const nextKey = key(col, row);
                if (previous.has(nextKey)) continue;
                previous.set(nextKey, key(cell.col, cell.row));
                queue.push({ col, row });
            }
        }
        if (!previous.has(goalKey)) return null;
        let stepKey = goalKey;
        let parentKey = previous.get(stepKey);
        while (parentKey && parentKey !== startKey) { stepKey = parentKey; parentKey = previous.get(stepKey); }
        if (stepKey === startKey) return target;
        const [col, row] = stepKey.split(",").map(Number);
        return { x: this.navigationBounds.minX + (col - 0.5) * TILE, y: this.navigationBounds.minY + (row - 0.5) * TILE };
    }

    ensureOnWalkableTile() {
        if (this._isWalkable(this.x, this.y)) {
            this.lastSafePosition = { x: this.x, y: this.y };
            return;
        }
        this.x = this.lastSafePosition.x;
        this.y = this.lastSafePosition.y;
        this.vx = this.vy = this.pushVx = this.pushVy = 0;
    }

    get isDead() {
        return this.state === "dead";
    }

    get isDying() {
        return this.state === "dying";
    }

    get readyToGib() {
        return this.state === "dying" && this.dyingTimer <= 0;
    }

    // `hit` = { dirX, dirY } (da fonte do golpe para o inimigo). Sem `hit` só desconta vida (chamadas legadas).
    // Retorna false se o golpe foi recusado (cooldown, spawn congelado, morrendo); senão o resultado do golpe.
    takeHit(damage = 1, hit = null) {
        if (this.hitTimer > 0 || this.frozen || this.state === 'dying' || this.state === 'dead') return false;

        const vulnerable = this.vulnerableTimer > 0;
        const dealt = Math.max(1, Math.round(damage * (vulnerable ? ENEMY_HIT.poise.vulnerableDamageMult : 1)));
        const result = { damage: dealt, killed: false, staggered: false, poiseBroken: false, vulnerable };

        this.hp -= dealt;
        this.hitTimer = ENEMY_HIT.cooldownSteps;

        if (this.hp <= 0) {
            this.startDying();
            result.killed = true;
            if (hit) this._startFlash(ENEMY_HIT.flash.steps);
            return result;
        }
        if (!hit) return result;

        let broken = false;
        if (this.state !== 'stunned' && this.poiseMax > 0) {
            this.poise -= ENEMY_HIT.poise.perHit;
            this.poiseRegenTimer = ENEMY_HIT.poise.regenDelaySteps;
            broken = this.poise <= 0;
        }
        this._enterStagger(hit, broken);
        result.staggered = true;
        result.poiseBroken = broken;
        return result;
    }

    _startFlash(steps) {
        this.flashTimer = steps;
        this.flashTotal = steps;
    }

    // Interrompe windup/attack/recover, congela a pose atual e empurra para longe da fonte do golpe.
    _enterStagger(hit, broken) {
        const wasStunned = this.state === 'stunned';
        if (this.state !== 'hurt' && this.state !== 'stunned') {
            const anim = this._currentAnim();
            this._hurtPose = { anim, frame: this._currentFrameIndex(anim) };
        }
        this.dealtHit = false;
        this.justAttacked = false;
        this.stepDistance = 0;

        if (broken) {
            this.poise = this.poiseMax;
            this.state = 'stunned';
            this.stateTimer = ENEMY_HIT.poise.breakSteps;
            this.vulnerableTimer = ENEMY_HIT.poise.vulnerableSteps;
            this._startFlash(ENEMY_HIT.flash.breakSteps);
        } else if (wasStunned) {
            this.stateTimer = Math.max(this.stateTimer, ENEMY_HIT.stagger.steps);
            this._startFlash(ENEMY_HIT.flash.steps);
        } else {
            this.state = 'hurt';
            this.stateTimer = ENEMY_HIT.stagger.steps;
            this._startFlash(ENEMY_HIT.flash.steps);
        }
        this.animTime = 0;
        this.vx = 0;
        this.vy = 0;

        const kb = broken ? ENEMY_HIT.poise.breakKnockback : ENEMY_HIT.stagger.knockback;
        const len = Math.hypot(hit.dirX ?? 0, hit.dirY ?? 0);
        if (len > 0.0001) {
            this.pushVx = (hit.dirX / len) * kb;
            this.pushVy = (hit.dirY / len) * kb;
        }
    }

    startDying() {
        if (this.state === "dying" || this.state === "dead") return;

        const anim = this._currentAnim();
        this._frozen = { anim, frame: this._currentFrameIndex(anim) };
        this.state = "dying";
        this.dyingTimer = this.dyingDuration;
        this.vx = 0;
        this.vy = 0;
        this.pushVx = 0;
        this.pushVy = 0;
    }

    explodeIntoGibs() {
        const s = this.sprite;
        const cell = s.cellSize;
        const scale = s.drawHeight / s.cropH;

        const gib = s.gib || {};
        const box = gib.box || { x: s.cropX, y: s.cropY, w: s.cropW, h: s.cropH };
        const death = s.rows.death;
        const deathFrame = death.frames - 1;
        const baseSrcX = deathFrame * cell + box.x;
        const baseSrcY = death.row * cell + box.y;
        const cw = box.w, ch = box.h;

        const anchorX = s.body ? cell / 2 : s.cropX + s.cropW / 2;
        const anchorY = this._anchorY();

        const pieces = [];

        const cols = gib.gridCols ?? 5;
        const rows = gib.gridRows ?? 4;
        const pieceW = cw / cols;
        const pieceH = ch / rows;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {

                const jx = (Math.random() - 0.5) * pieceW * 0.25;
                const jy = (Math.random() - 0.5) * pieceH * 0.25;
                const sx = baseSrcX + c * pieceW + Math.max(0, jx);
                const sy = baseSrcY + r * pieceH + Math.max(0, jy);
                const sw = Math.min(pieceW, cw - (c * pieceW));
                const sh = Math.min(pieceH, ch - (r * pieceH));

                const offX = (box.x + (c + 0.5) * pieceW - anchorX) * scale;
                const offY = (box.y + (r + 0.5) * pieceH - anchorY) * scale;

                const gibPiece = new GibPiece(
                    this.x + offX, this.y + offY,
                    this.sheet,
                    sx, sy, sw, sh,
                    sw * scale, sh * scale
                );

                const gcfg = this.gibStainConfig || {};
                const st = new BloodStains();
                st.splatter({
                    count: gcfg.count ?? 2,
                    spread: Math.min(sw, sh) * scale * 0.45,
                    life: gcfg.life ?? Infinity,
                    palette: this.bloodPalette,
                    sizeMin: gcfg.sizeMin ?? 1,
                    sizeMax: gcfg.sizeMax ?? 3,
                    alpha: gcfg.alpha ?? 0.9
                });
                gibPiece.setStains(st);

                pieces.push(gibPiece);
            }
        }

        return pieces;
    }

    update(players, onPlayerHit) {
        this.hitTimer = Math.max(0, this.hitTimer - 1);
        if (this.flashTimer > 0) this.flashTimer--;
        if (this.vulnerableTimer > 0) this.vulnerableTimer--;
        if (this.poiseMax > 0 && this.poise < this.poiseMax && this.state !== 'stunned' && --this.poiseRegenTimer <= 0) {
            this.poise = this.poiseMax;
        }
        this.justStepped = false;
        this.justAttacked = false;

        if (this.frozen) {
            this.vx = this.vy = this.pushVx = this.pushVy = 0;
            this.justAppeared = false;
            if (this.spawnDelay > 0) {

                this.spawnDelay--;
                if (this.spawnDelay === 0) {

                    this.spawnFx = this.spawnFxDuration;
                    this.justAppeared = true;
                }
                return;
            }
            if (this.spawnFx > 0) this.spawnFx--;
            return;
        }

        this.animTime++;

        if (this.state === "dying") {

            this.vx = 0; this.vy = 0;
            this.pushVx = 0; this.pushVy = 0;
            if (this.dyingTimer > 0) this.dyingTimer--;
            return;
        }

        if (this.state === "dead") {

            this.vx *= 0.8;
            this.vy *= 0.8;
            this.corpseTimer++;
            const d = this.sprite.rows.death;
            const dur = d.frames * d.fps;
            if (this.animTime >= dur) this.deathDone = true;
            this._applyPush();
            super.update();
            return;
        }

        const d1 = Math.hypot(players[0].x - this.x, players[0].y - this.y);
        const d2 = Math.hypot(players[1].x - this.x, players[1].y - this.y);
        this.target = d1 < d2 ? players[0] : players[1];
        const distToTarget = Math.min(d1, d2);

        if (this.state === "windup" || this.state === "attack" || this.state === "recover") {
            this.facingLeft = (this.target.x < this.x);
        }

        switch (this.state) {
            case "chase": {

                const waypoint = this._chaseWaypoint(this.target);
                if (waypoint) {
                    const angle = Math.atan2(waypoint.y - this.y, waypoint.x - this.x);
                    this.vx = this.vx * 0.85 + Math.cos(angle) * this.speed * 0.15;
                    this.vy = this.vy * 0.85 + Math.sin(angle) * this.speed * 0.15;
                } else {
                    this.vx *= 0.5;
                    this.vy *= 0.5;
                }

                if (distToTarget <= this.attackRange && this._hasClearWalkablePath(this.target)) {

                    this.state = "windup";
                    this.stateTimer = this.windupFrames;
                    this.animTime = 0;
                    this.dealtHit = false;
                }
                break;
            }

            case "windup": {

                this.vx *= 0.6;
                this.vy *= 0.6;
                this.stateTimer--;
                if (this.stateTimer <= 0) {

                    this.currentAttack = this.attackKeys[
                        Math.floor(Math.random() * this.attackKeys.length)
                    ];
                    const atk = this.sprite.rows[this.currentAttack];
                    this.state = "attack";
                    this.justAttacked = true;
                    this.stateTimer = atk.frames * atk.fps;
                    this.animTime = 0;
                    this.dealtHit = false;
                }
                break;
            }

            case "attack": {

                this.vx *= 0.5;
                this.vy *= 0.5;

                const atk = this.sprite.rows[this.currentAttack];
                const hitAt = (atk.hitFrame ?? Math.floor(atk.frames / 2)) * atk.fps;
                if (!this.dealtHit && this.animTime >= hitAt) {
                    this.dealtHit = true;
                    if (distToTarget <= this.hitRange && this._hasClearWalkablePath(this.target)) {
                        if (this.target.takeDamage(this.x, this.y)) {
                            onPlayerHit(this.target);
                        }
                    }
                }

                this.stateTimer--;
                if (this.stateTimer <= 0) {
                    this.state = "recover";
                    this.stateTimer = this.recoverFrames;
                    this.animTime = 0;
                }
                break;
            }

            case "recover": {

                this.vx *= 0.7;
                this.vy *= 0.7;
                this.stateTimer--;
                if (this.stateTimer <= 0) {
                    this.state = "chase";
                    this.animTime = 0;
                }
                break;
            }

            case "hurt":
            case "stunned": {
                this.vx *= 0.6;
                this.vy *= 0.6;
                if (--this.stateTimer <= 0) {
                    this.state = "chase";
                    this.animTime = 0;
                }
                break;
            }
        }

        this._applyPush();
        super.update();

        if (this.state === "chase" && this.speedMag > 0.35) {
            this.stepDistance += this.speedMag;
            if (this.stepDistance >= 48) {
                this.stepDistance %= 48;
                this.justStepped = true;
            }
        } else if (this.state !== "chase") {
            this.stepDistance = 0;
        }
    }

    // Empurrão nunca leva o inimigo para buraco/borda; o Game ainda resolve paredes e limites da sala.
    _applyPush() {
        if (this.pushVx !== 0 || this.pushVy !== 0) {
            const nx = this.x + this.pushVx;
            const ny = this.y + this.pushVy;
            const stuck = !this._isWalkable(this.x, this.y);
            if (stuck || this._isWalkable(nx, this.y)) this.x = nx; else this.pushVx = 0;
            if (stuck || this._isWalkable(this.x, ny)) this.y = ny; else this.pushVy = 0;
        }
        this.pushVx *= 0.85;
        this.pushVy *= 0.85;
        if (Math.abs(this.pushVx) < 0.01) this.pushVx = 0;
        if (Math.abs(this.pushVy) < 0.01) this.pushVy = 0;
    }

    _currentAnim() {
        const r = this.sprite.rows;
        switch (this.state) {
            case "dying":  return (this._frozen && this._frozen.anim) || r.walk;
            case "hurt":
            case "stunned": return (this._hurtPose && this._hurtPose.anim) || r.walk;
            case "dead":   return r.death;
            case "attack": return r[this.currentAttack] || r.attack;
            case "windup":
            case "recover":
            case "chase":
            default:       return r.walk;
        }
    }

    _currentFrameIndex(anim) {
        if (this.state === "dying") {

            return this._frozen ? this._frozen.frame : 0;
        }
        if (this.state === "hurt" || this.state === "stunned") {
            return this._hurtPose ? this._hurtPose.frame : 0;
        }
        if (this.state === "dead") {

            const idx = Math.floor(this.animTime / anim.fps);
            return Math.min(idx, anim.frames - 1);
        }
        if (this.state === "windup") {

            return 0;
        }
        if (this.state === "attack") {
            const idx = Math.floor(this.animTime / anim.fps);
            return Math.min(idx, anim.frames - 1);
        }

        return Math.floor(this.animTime / anim.fps) % anim.frames;
    }

    draw(ctx) {
        if (!this.sheet || !this.sheet.complete || this.sheet.naturalWidth === 0) return;

        if (this.isHidden) return;

        const s = this.sprite;
        const anim = this._currentAnim();
        const frame = this._currentFrameIndex(anim);
        const cell = s.cellSize;
        const cw = s.cropW, ch = s.cropH;

        let srcRow = anim.row;
        let srcCol = frame;

        if (this.state === "dying" && s.deathFlash) {
            const blink = Math.floor(this.dyingTimer / 2) % 2 === 0;
            if (blink) {
                srcRow = s.deathFlash.row;
                srcCol = s.deathFlash.frame;
            }
        }

        const srcX = srcCol * cell + s.cropX;
        const srcY = srcRow * cell + s.cropY;

        const scale = s.drawHeight / ch;
        const drawW = cw * scale;
        const drawH = ch * scale;

        const cropCenterOffset = ((s.cropX + cw / 2) - cell / 2) * scale;

        const cropCenterOffsetY = ((s.cropY + ch / 2) - this._anchorY()) * scale;

        let revealT = 1;
        if (this.spawnFx > 0 && this.spawnFxDuration > 0) {
            revealT = 1 - this.spawnFx / this.spawnFxDuration;
        }

        let img = this.sheet, imgX = srcX, imgY = srcY;
        const tint = this._tintSpec();
        if (tint) {
            img = tintedCrop(this.sheet, srcX, srcY, cw, ch, tint.color, tint.alpha);
            imgX = 0;
            imgY = 0;
        }

        ctx.save();
        ctx.translate(this.x + this._jitterX(), this.y);
        if (this.facingLeft) ctx.scale(-1, 1);

        ctx.translate(cropCenterOffset, cropCenterOffsetY);

        if (revealT < 1) {
            const top = s.body ? (s.body.y - s.cropY) * scale - drawH / 2 : -drawH / 2;
            const bottom = s.body ? (s.body.y + s.body.h - s.cropY) * scale - drawH / 2 : drawH / 2;

            const revealLineY = bottom - (bottom - top) * revealT;
            ctx.beginPath();

            ctx.rect(-drawW, revealLineY, drawW * 2, drawH / 2 - revealLineY + 2);
            ctx.clip();
        }

        ctx.drawImage(
            img,
            imgX, imgY, cw, ch,
            -drawW / 2, -drawH / 2, drawW, drawH
        );

        ctx.restore();
    }

    _tintSpec() {
        if (this.flashTimer > 0) {
            const f = ENEMY_HIT.flash;
            const firstHalf = this.flashTimer > this.flashTotal * 0.5;
            return { color: firstHalf ? f.first : f.second, alpha: f.alpha };
        }
        if (this.vulnerableTimer > 0 && !this.isDying) {
            const p = ENEMY_HIT.vulnerablePulse;
            if (Math.floor(this.vulnerableTimer / (p.periodSteps / 2)) % 2 === 0) return { color: p.color, alpha: p.alpha };
        }
        return null;
    }

    _jitterX() {
        if (this.state === "hurt") {
            const amp = ENEMY_HIT.jitter.hurt * (this.stateTimer / ENEMY_HIT.stagger.steps);
            return (this.stateTimer % 2 ? 1 : -1) * amp;
        }
        if (this.state === "stunned") return Math.sin(this.animTime * 0.6) * ENEMY_HIT.jitter.stunned;
        return 0;
    }
}
