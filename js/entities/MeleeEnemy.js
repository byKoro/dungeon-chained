import { TILE } from '../config/GameConfig.js';
import { Entity } from './Entity.js';
import { GibPiece } from '../particles/GibPiece.js';
import { BloodStains } from '../particles/BloodStains.js';

export class MeleeEnemy extends Entity {
    constructor(x, y, sheet, spriteConfig, floor = 1) {
        super(x, y, 18);
        this.sheet = sheet;
        this.sprite = spriteConfig;
        this.isSkeleton = false;

        this.hp = spriteConfig.combat?.hp ?? 1;
        this.hitTimer = 0;
        this.speed = spriteConfig.combat?.speed ?? 1.7;

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
        this.dyingDuration = spriteConfig.combat?.playDeathAnimation
            ? spriteConfig.rows.death.frames * spriteConfig.rows.death.fps
            : 9;

        this.attackKeys = ["attack", "attack2", "attack3"].filter(k => this.sprite.rows[k]);
        this.currentAttack = this.attackKeys[0] || "attack";
        this.attackIndex = 0;

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

    takeHit(damage = 1) {
        if (this.hitTimer > 0 || this.frozen || this.state === 'dying') return false;
        this.hp -= damage;
        this.hitTimer = 24;
        if (this.hp <= 0) this.startDying();
        return true;
    }

    startDying() {
        if (this.state === "dying" || this.state === "dead") return;

        const anim = this._currentAnim();
        this._frozen = { anim, frame: this._currentFrameIndex(anim) };
        this.state = "dying";
        this.dyingTimer = this.dyingDuration;
        this.animTime = 0;
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
                        this.sprite.combat?.cycleAttacks
                            ? this.attackIndex++ % this.attackKeys.length
                            : Math.floor(Math.random() * this.attackKeys.length)
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

    _applyPush() {
        this.x += this.pushVx;
        this.y += this.pushVy;
        this.pushVx *= 0.85;
        this.pushVy *= 0.85;
        if (Math.abs(this.pushVx) < 0.01) this.pushVx = 0;
        if (Math.abs(this.pushVy) < 0.01) this.pushVy = 0;
    }

    _currentAnim() {
        const r = this.sprite.rows;
        switch (this.state) {
            case "dying":  return this.sprite.combat?.playDeathAnimation
                ? r.death : (this._frozen && this._frozen.anim) || r.walk;
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

            if (this.sprite.combat?.playDeathAnimation) {
                return Math.min(Math.floor(this.animTime / anim.fps), anim.frames - 1);
            }
            return this._frozen ? this._frozen.frame : 0;
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

        if (this.state === "dying" && s.deathFlash && !s.combat?.playDeathAnimation) {
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

        ctx.save();
        ctx.translate(this.x, this.y);
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
            this.sheet,
            srcX, srcY, cw, ch,
            -drawW / 2, -drawH / 2, drawW, drawH
        );

        ctx.restore();
    }
}
