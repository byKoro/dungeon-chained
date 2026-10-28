import { MeleeEnemy } from './MeleeEnemy.js';
import { GHOSTFIRE } from '../config/GhostfireConfig.js';
import { TILE } from '../config/GameConfig.js';
import { Physics } from '../core/Physics.js';
import { GhostfireRenderer } from '../systems/GhostfireRenderer.js';

export class GhostfireBoss extends MeleeEnemy {
    constructor(x, y, sheet, spriteConfig, floor = 1) {
        super(x, y, sheet, spriteConfig, floor);
        this.sprite = { ...spriteConfig, drawHeight: spriteConfig.cropH * GHOSTFIRE.sprite.scale };
        this.isBoss = true;
        this.health = GHOSTFIRE.health;
        this.hitRadius = GHOSTFIRE.hitRadius;
        this.hitCooldown = 0;
        this.side = "right";
        this.beam = null;
        this.hoverTime = 0;
        this.hoverOffset = 0;
        this.summonWave = 0;
        this.justSummoned = false;
        this.justTeleported = false;
        this.justCharging = false;
        this.justRoared = false;
        this.justArrived = false;
        this.bossRenderer = new GhostfireRenderer();
        this._enter("appear", GHOSTFIRE.appearFrames);
    }

    get drawHeight() { return this.sprite.body.h * GHOSTFIRE.sprite.scale; }

    _enter(state, frames) {
        this.state = state;
        this.stateTimer = frames;
        this.animTime = 0;
    }

    setNavigationFloor(floor, bounds, walls = []) {
        super.setNavigationFloor(floor, bounds, walls);
        this.navigationWalls = new Set(walls.map(w => `${w.col},${w.row}`));
        this._placeOnSide();
    }

    _placeOnSide() {
        const b = this.navigationBounds;
        if (!b) return;
        const inset = Math.min(GHOSTFIRE.sideInset, (b.maxX - b.minX) / 4);
        const targetX = this.side === "left" ? b.minX + inset : b.maxX - inset;
        const targetY = (b.minY + b.maxY) / 2;
        let best = null;
        for (let row = 1; row < this.navigationFloor.length - 1; row++) {
            for (let col = 1; col < this.navigationFloor[row].length - 1; col++) {
                const x = b.minX + (col - 0.5) * TILE;
                const y = b.minY + (row - 0.5) * TILE;
                if (this.navigationFloor[row][col] < 0 || this.navigationWalls.has(`${col},${row}`)) continue;
                const distance = Math.hypot(x - targetX, y - targetY);
                if (!best || distance < best.distance) best = { x, y, distance };
            }
        }
        if (best) {
            this.x = best.x;
            this.y = best.y;
            this.lastSafePosition = { x: this.x, y: this.y };
            this._sidePosition = { x: this.x, y: this.y };
        }
        this.facingLeft = this.side === "right";
    }

    ensureOnWalkableTile() {
        if (!this._sidePosition) return super.ensureOnWalkableTile();
        this.x = this._sidePosition.x;
        this.y = this._sidePosition.y;
        this.vx = this.vy = this.pushVx = this.pushVy = 0;
    }

    receiveWeaponHit() {
        if (this.frozen || this.state === "dying" || this.state === "teleport" || this.state === "appear" || this.hitCooldown > 0) return false;
        this.health--;
        this.hitCooldown = GHOSTFIRE.hitCooldown;
        if (this.health <= 0) this.startDying();
        return true;
    }

    startDying() {
        if (this.state === "dying") return;
        this.beam = null;
        this.justSummoned = false;
        super.startDying();
        this.dyingDuration = this.dyingTimer = GHOSTFIRE.deathFrames;
        this.animTime = 0;
    }

    _trackPlayers(players) {
        if (!this.navigationBounds || !this._sidePosition) return;
        const targets = players.filter(p => p.lives > 0 && !p.falling);
        if (!targets.length) return;
        const y = targets.reduce((sum, p) => sum + p.y, 0) / targets.length;
        const b = this.navigationBounds;
        const margin = Math.min(this.hitRadius, (b.maxY - b.minY) / 2);
        const targetY = Math.max(b.minY + margin, Math.min(b.maxY - margin, y));
        const nextY = this.y + (targetY - this.y) * GHOSTFIRE.chargeTracking;
        if (this._isWalkable(this.x, nextY)) {
            this.y = nextY;
            this._sidePosition.y = nextY;
        }
    }

    _aim() {
        const b = this.navigationBounds;
        if (!b) return;
        const direction = this.side === "left" ? 1 : -1;
        const x = this.x + direction * GHOSTFIRE.sprite.mouthOffset * GHOSTFIRE.sprite.scale;
        const beamCenter = (GHOSTFIRE.sprite.beamRow + GHOSTFIRE.sprite.beamHeight / 2 - GHOSTFIRE.sprite.anchorY) * GHOSTFIRE.sprite.scale;
        const y = this.y + this.hoverOffset + beamCenter;
        this.beam = { x, y, endX: this.side === "left" ? b.maxX : b.minX, endY: y };
    }

    update(players, onPlayerHit) {
        this.justSummoned = false;
        this.justTeleported = false;
        this.justAttacked = false;
        this.justStepped = false;
        this.justCharging = this.justRoared = this.justArrived = false;
        if (this.frozen || this.state === "dying") {
            super.update(players, onPlayerHit);
            return;
        }
        this.vx = this.vy = this.pushVx = this.pushVy = 0;
        this.animTime++;
        if (this.hitCooldown > 0) this.hitCooldown--;
        if (this.state !== "indicator" && this.state !== "beam" && this.state !== "fade") {
            this.hoverTime += GHOSTFIRE.sprite.hoverSpeed;
            this.hoverOffset = Math.sin(this.hoverTime) * GHOSTFIRE.sprite.hoverAmplitude;
        }
        if (this.state === "charge") this._trackPlayers(players);
        if (this.state === "summon") {
            const release = this.animTime - GHOSTFIRE.summonReleaseFrame;
            this.justSummoned = release >= 0 && release < GHOSTFIRE.summonIntervalFrames * GHOSTFIRE.summonCount &&
                release % GHOSTFIRE.summonIntervalFrames === 0;
        }
        if (this.state === "beam" && this.beam) {
            const b = this.beam;
            for (const player of players) {
                if (player.lives <= 0 || player.falling) continue;
                if (Physics.distToSegment(player.x, player.y, b.x, b.y, b.endX, b.endY) <= GHOSTFIRE.beamWidth / 2 + player.hitRadius &&
                    player.takeDamage(this.x, this.y)) onPlayerHit?.(player);
            }
        }
        if (--this.stateTimer > 0) return;
        switch (this.state) {
            case "appear":
                this.justArrived = this.justRoared = true;
                this._enter("roar", GHOSTFIRE.roarFrames);
                break;
            case "roar":
                this._enter("summon", GHOSTFIRE.summonFrames);
                break;
            case "summon":
                this._enter("wait", GHOSTFIRE.waitFrames);
                break;
            case "wait":
                this.justCharging = true;
                this._enter("charge", GHOSTFIRE.chargeFrames);
                break;
            case "charge":
                this._aim();
                this._enter("indicator", GHOSTFIRE.indicatorFrames);
                break;
            case "indicator":
                this.justAttacked = true;
                this._enter("beam", GHOSTFIRE.beamFrames);
                break;
            case "beam":
                this._enter("fade", GHOSTFIRE.fadeFrames);
                break;
            case "fade":
                this.beam = null;
                this._enter("recover", GHOSTFIRE.recoverFrames);
                break;
            case "recover":
                this._enter("teleport", GHOSTFIRE.teleportFrames);
                break;
            case "teleport":
                this.side = this.side === "left" ? "right" : "left";
                this.teleportFrom = { x: this.x, y: this.y };
                this._placeOnSide();
                this.justTeleported = true;
                this._enter("appear", GHOSTFIRE.appearFrames);
                break;
        }
    }

    get visualFrame() {
        switch (this.state) {
            case "roar": return { row: 3, frame: Math.min(2, Math.floor(this.animTime / GHOSTFIRE.sprite.summonTicks)) };
            case "summon": return { row: 2, frame: Math.min(5, Math.floor(this.animTime / GHOSTFIRE.sprite.summonTicks)) };
            case "charge": return { row: 3, frame: Math.min(2, Math.floor(this.animTime / GHOSTFIRE.chargeFrames * 3)) };
            case "indicator": return { row: 3, frame: 3 };
            case "beam": return { row: 3, frame: 4 };
            case "fade": return { row: 3, frame: 5 };
            case "recover": return { row: 3, frame: 6 };
            case "dying": return { row: 4, frame: Math.min(5, Math.floor(this.animTime / GHOSTFIRE.sprite.deathTicks)) };
            default: return { row: 1, frame: Math.floor(this.animTime / GHOSTFIRE.sprite.idleTicks) % 6 };
        }
    }

    draw(ctx) {
        this.bossRenderer.drawBody(ctx, this);
    }
}
