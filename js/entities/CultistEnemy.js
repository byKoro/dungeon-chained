import { MeleeEnemy } from './MeleeEnemy.js';
import { CULTIST } from '../config/CultistConfig.js';

export class CultistEnemy extends MeleeEnemy {
    constructor(x, y, sheet, sprite, floor = 1) {
        super(x, y, sheet, sprite, floor);
        this.preferredDistance = CULTIST.preferredDistance;
        this.attackRange = CULTIST.castRange;
        this.hitRange = -1;
        this.markedPosition = null;
        this.pillarHits = new Set();
        this.players = [];
    }

    _chaseWaypoint(target) {
        const distance = Math.hypot(target.x - this.x, target.y - this.y);
        if (distance > this.preferredDistance + CULTIST.distanceTolerance) return super._chaseWaypoint(target);
        if (distance >= this.preferredDistance - CULTIST.distanceTolerance) return null;

        let best = null;
        let clearance = Math.min(...this.players.map(p => Math.hypot(p.x - this.x, p.y - this.y)));
        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;
            const next = { x: this.x + Math.cos(angle) * this.speed * CULTIST.retreatProbeSteps, y: this.y + Math.sin(angle) * this.speed * CULTIST.retreatProbeSteps };
            if (!this._isWalkable(next.x, next.y) || !this._hasClearWalkablePath(next)) continue;
            const score = Math.min(...this.players.map(p => Math.hypot(p.x - next.x, p.y - next.y)));
            if (score > clearance) { best = next; clearance = score; }
        }
        return best;
    }

    update(players, onPlayerHit) {
        this.players = players.filter(p => p.lives > 0 && !p.falling);
        const targets = this.players.length ? [this.players[0], this.players[1] || this.players[0]]
            : [{ x: this.x, y: this.y, lives: 0 }, { x: this.x, y: this.y, lives: 0 }];
        const distance = Math.min(...this.players.map(p => Math.hypot(p.x - this.x, p.y - this.y)));
        this.attackRange = this.players.length && distance >= this.preferredDistance - CULTIST.distanceTolerance
            ? Math.min(CULTIST.castRange, this.preferredDistance + CULTIST.distanceTolerance) : -1;
        const previousState = this.state;
        const paused = this.frozen || this.hitFreezeTimer > 0;
        super.update(targets, onPlayerHit);
        if (paused) return;

        if (previousState === 'chase' && this.state === 'windup') {
            this.markedPosition = { x: this.target.x, y: this.target.y };
            this.pillarHits.clear();
        }
        if (this.state !== 'windup' && this.state !== 'attack') this.markedPosition = null;
        if (this.state !== 'attack' || !this.markedPosition) return;
        const frame = this._currentFrameIndex(this.sprite.rows.attack);
        const cfg = CULTIST.pillar;
        if (frame < cfg.damageFirstFrame || frame > cfg.damageLastFrame) return;
        for (const player of this.players) {
            if (this.pillarHits.has(player)) continue;
            if (Math.hypot(player.x - this.markedPosition.x, player.y - this.markedPosition.y) > cfg.radius + player.hitRadius) continue;
            if (player.takeDamage(this.markedPosition.x, this.markedPosition.y)) {
                this.pillarHits.add(player);
                onPlayerHit(player);
            }
        }
    }

    startDying() {
        this.markedPosition = null;
        super.startDying();
    }

    explodeIntoGibs() { return []; }

    draw(ctx) {
        const original = this.sprite;
        if (this.state === 'attack' && this._currentFrameIndex(original.rows.attack) >= CULTIST.pillar.firstFrame) {
            this.sprite = { ...original, cropW: CULTIST.pillar.casterCropW };
        }
        try { super.draw(ctx); }
        finally { this.sprite = original; }
    }

    drawAttackEffect(ctx) {
        if (this.isHidden || !this.markedPosition || !['windup', 'attack'].includes(this.state)) return;
        const p = this.markedPosition, cfg = CULTIST.pillar;
        const frame = this.state === 'attack' ? this._currentFrameIndex(this.sprite.rows.attack) : -1;
        ctx.save();
        if (frame >= cfg.firstFrame && this.sheet?.complete && this.sheet.naturalWidth) {
            ctx.drawImage(this.sheet, frame * this.sprite.cellSize + cfg.cropX,
                this.sprite.rows.attack.row * this.sprite.cellSize + cfg.cropY, cfg.cropW, cfg.cropH,
                p.x - (cfg.anchorX - cfg.cropX) * cfg.scale, p.y - (cfg.anchorY - cfg.cropY) * cfg.scale,
                cfg.cropW * cfg.scale, cfg.cropH * cfg.scale);
        }
        ctx.restore();
    }
}
