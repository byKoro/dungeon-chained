import { Entity } from './Entity.js';
import { FIRE_SKULL } from '../config/DemoCombatConfig.js';
import { TILE } from '../config/GameConfig.js';
import { Physics } from '../core/Physics.js';

export class FireSkullEnemy extends Entity {
    constructor(x, y, sheet, boss = false) {
        const cfg = boss ? { ...FIRE_SKULL, ...FIRE_SKULL.boss } : FIRE_SKULL;
        super(x, y, cfg.radius);
        this.cfg = cfg;
        this.sheet = sheet;
        this.isBoss = boss;
        this.hp = this.maxHp = cfg.hp;
        this.state = 'idle';
        this.stateTimer = 0;
        this.hitTimer = 0;
        this.dyingTimer = 0;
        this.projectiles = [];
        this.clock = 0;
        this.shotTimer = cfg.shotInterval;
        this.laserTimer = cfg.laserInterval;
        this.teleportTimer = cfg.teleportInterval;
        this.summonTimer = cfg.summonInterval;
        this.spawnFx = 0;
        this.spawnDelay = 0;
        this.frozen = false;
        this.justAppeared = false;
        this.summonRequested = 0;
        this.lastSafePosition = { x, y };
    }

    get drawHeight() { return this.cfg.drawSize; }
    get isHidden() { return this.spawnDelay > 0; }
    get readyToGib() { return this.state === 'dying' && this.dyingTimer <= 0; }
    get isDying() { return this.state === 'dying'; }
    beginFrozenSpawn(delay = 0) { this.frozen = true; this.spawnDelay = delay; this.spawnFx = 30; this.justAppeared = !delay; }
    unfreeze() { this.frozen = false; }
    setNavigationFloor(floor, bounds, walls = []) { this.floor = floor; this.bounds = bounds; this.walls = walls; }
    ensureOnWalkableTile() {}
    explodeIntoGibs() { return []; }

    takeHit(damage = 1) {
        if (this.hitTimer || this.frozen || this.state === 'dying') return false;
        this.hp -= damage;
        this.hitTimer = this.cfg.hitCooldown;
        if (this.hp <= 0) this.startDying();
        return true;
    }

    startDying() { this.hp = 0; this.state = 'dying'; this.dyingTimer = this.cfg.deathFrames; this.projectiles = []; }

    _blocked(x, y) {
        const b = this.bounds;
        if (!b || x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) return true;
        const col = Math.floor((x - b.minX) / TILE) + 1, row = Math.floor((y - b.minY) / TILE) + 1;
        return this.walls.some(w => w.col === col && w.row === row);
    }

    update(players, onPlayerHit) {
        this.justAttacked = false; this.justAppeared = false; this.summonRequested = 0;
        if (this.frozen) {
            if (this.spawnDelay > 0 && --this.spawnDelay === 0) this.justAppeared = true;
            this.spawnFx = Math.max(0, this.spawnFx - 1); return;
        }
        if (this.state === 'dying') { this.dyingTimer--; return; }
        this.clock++; this.hitTimer = Math.max(0, this.hitTimer - 1);
        const targets = players.filter(p => p.lives > 0 && !p.falling);
        if (!targets.length) return;
        const target = targets.reduce((a, p) => Math.hypot(p.x - this.x, p.y - this.y) < Math.hypot(a.x - this.x, a.y - this.y) ? p : a);
        this.facingLeft = target.x < this.x;
        for (const p of targets) if (Math.hypot(p.x - this.x, p.y - this.y) < this.hitRadius + p.hitRadius && p.takeDamage(this.x, this.y)) onPlayerHit(p);

        if (this.isBoss && this.state === 'idle') {
            if (--this.teleportTimer <= 0) {
                const b = this.bounds;
                const x = this.x < (b.minX + b.maxX) / 2 ? b.maxX - TILE * 2 : b.minX + TILE * 2;
                if (!this._blocked(x, this.y)) this.x = x;
                this.teleportTimer = this.cfg.teleportInterval;
            }
            if (--this.summonTimer <= 0) { this.summonRequested = this.cfg.summonCount; this.summonTimer = this.cfg.summonInterval; }
            if (--this.laserTimer <= 0) {
                this.state = 'laserWarning'; this.stateTimer = this.cfg.laserWindup;
                this.laserTarget = { x: target.x, y: target.y };
                this.laserTimer = this.cfg.laserInterval;
            }
        }
        if (this.state === 'laserWarning' && --this.stateTimer <= 0) { this.state = 'laser'; this.stateTimer = this.cfg.laserFrames; this.justAttacked = true; }
        else if (this.state === 'laser') {
            const end = this._laserEnd();
            for (const p of targets) if (Physics.distToSegment(p.x, p.y, this.x, this.y, end.x, end.y) < this.cfg.laserWidth / 2 + p.hitRadius && p.takeDamage(this.x, this.y)) onPlayerHit(p);
            if (--this.stateTimer <= 0) this.state = 'idle';
        } else if (this.state === 'idle' && --this.shotTimer <= 0) { this.state = 'shotWarning'; this.stateTimer = this.cfg.shotWindup; }
        else if (this.state === 'shotWarning' && --this.stateTimer <= 0) {
            const a = Math.atan2(target.y - this.y, target.x - this.x);
            this.projectiles.push({ x: this.x, y: this.y, vx: Math.cos(a) * this.cfg.projectileSpeed, vy: Math.sin(a) * this.cfg.projectileSpeed, age: 0 });
            this.justAttacked = true; this.state = 'idle'; this.shotTimer = this.cfg.shotInterval;
        }
        this.projectiles = this.projectiles.filter(ball => {
            ball.x += ball.vx; ball.y += ball.vy; ball.age++;
            if (ball.age > this.cfg.projectileLife || this._blocked(ball.x, ball.y)) return false;
            for (const p of targets) if (Math.hypot(p.x - ball.x, p.y - ball.y) < p.hitRadius + this.cfg.projectileRadius) {
                if (p.takeDamage(ball.x, ball.y)) onPlayerHit(p);
                return false;
            }
            return true;
        });
    }

    _laserEnd() {
        const angle = Math.atan2(this.laserTarget.y - this.y, this.laserTarget.x - this.x);
        let end = { x: this.x, y: this.y };
        for (let d = 8; d < TILE * 50; d += 8) {
            const p = { x: this.x + Math.cos(angle) * d, y: this.y + Math.sin(angle) * d };
            if (this._blocked(p.x, p.y)) break;
            end = p;
        }
        return end;
    }

    draw(ctx) {
        if (this.isHidden) return;
        ctx.save();
        if (this.state === 'laserWarning' || this.state === 'laser') {
            const end = this._laserEnd(); ctx.strokeStyle = this.state === 'laser' ? '#fff3ba' : '#ff5946';
            ctx.lineWidth = this.state === 'laser' ? this.cfg.laserWidth : 4;
            if (this.state === 'laserWarning') ctx.setLineDash([12, 8]);
            ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(end.x, end.y); ctx.stroke(); ctx.setLineDash([]);
        }
        if (this.hitTimer % 6 > 2) ctx.globalAlpha = 0.4;
        const size = this.cfg.drawSize, img = this.sheet, frame = Math.floor(this.clock / this.cfg.frameTicks) % 6;
        if (img?.complete && img.naturalWidth) ctx.drawImage(img, frame * 16, 0, 16, 20, this.x - size / 2, this.y - size / 2, size, size);
        else { ctx.fillStyle = '#ff9944'; ctx.fillRect(this.x - size / 2, this.y - size / 2, size, size); }
        ctx.globalAlpha = 1;
        if (this.state === 'shotWarning') { ctx.strokeStyle = '#ffefb2'; ctx.lineWidth = 3; ctx.strokeRect(this.x - size / 2, this.y - size / 2, size, size); }
        if (this.isBoss) {
            ctx.fillStyle = '#341b2b'; ctx.fillRect(this.x - 70, this.y - size / 2 - 16, 140, 8);
            ctx.fillStyle = '#ff6b4a'; ctx.fillRect(this.x - 70, this.y - size / 2 - 16, 140 * Math.max(0, this.hp) / this.maxHp, 8);
        }
        for (const ball of this.projectiles) {
            if (img?.complete && img.naturalWidth) ctx.drawImage(img, frame * 16, 20, 16, 20, ball.x - 12, ball.y - 12, 24, 24);
        }
        ctx.restore();
    }
}
