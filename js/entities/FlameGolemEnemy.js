import { MeleeEnemy } from './MeleeEnemy.js';
import { Physics } from '../core/Physics.js';
import { FLAME_GOLEM } from '../config/FlameGolemConfig.js';

export class FlameGolemEnemy extends MeleeEnemy {
    constructor(x, y, sheet, sprite, floor = 1) {
        super(x, y, sheet, sprite, floor);
        this.abilities = FLAME_GOLEM.attacks;
        this._baseRows = sprite.rows;
        this.sprite = { ...sprite, rows: { ...sprite.rows } };
        this.phase = 1;
        this.phaseConfig = FLAME_GOLEM.phases[0];
        this._applyPhaseStats();
        this.hitRadius = FLAME_GOLEM.hitRadius;
        this.shadowRadius = FLAME_GOLEM.shadowRadius;
        this.players = [];
        this.marks = [];
        this.chargeIndex = 0;
        this._dashTargetIndex = 0;
        this.chargeDirection = { x: 1, y: 0 };
        this.attackHits = new Set();
        this.slamMode = false;
        this.slam = null;
        this.airborne = false;
        this.jumpHeight = 0;
        this.justSlammed = false;
        this._slamCursor = 0;
        this.bossName = sprite.combat?.bossBar?.name ?? FLAME_GOLEM.name;
        this.hasBossBar = !!sprite.combat?.bossBar;
    }

    get bossBarState() {
        return {
            name: this.bossName, hp: Math.max(0, this.hp), max: this.maxHp, phase: this.phase, dying: this.isDying,
            phaseAt: FLAME_GOLEM.secondPhaseHp / this.maxHp
        };
    }

    update(players, onPlayerHit) {
        this.justSlammed = false;
        if (!this.frozen && this.hitFreezeTimer <= 0) this._updatePhase();
        this.players = players.filter(p => p.lives > 0 && !p.falling);
        const next = this.abilities[this.attackKeys[this.attackIndex % this.attackKeys.length]];
        this.attackRange = this.players.length ? next.triggerRange : -1;
        const targets = this.players.length ? [this.players[0], this.players[1] || this.players[0]]
            : [{ x: this.x, y: this.y }, { x: this.x, y: this.y }];
        super.update(targets, onPlayerHit);
        if (this.state !== 'windup' && this.state !== 'attack') {
            this.marks = [];
            this._endSlam();
        }
    }

    _beginWindup() {
        this.currentAttack = this.attackKeys[this.attackIndex++ % this.attackKeys.length];
        this.windupFrames = this.abilities[this.currentAttack].windupTicks / this.phaseConfig.animationSpeedMultiplier;
        this.recoverFrames = this.abilities[this.currentAttack].recoverTicks / this.phaseConfig.animationSpeedMultiplier;
        this.attackHits.clear();
        this.chargeIndex = 0;
        this._endSlam();
        this.slamMode = this.phase === 2 && this.currentAttack === 'attack2';
        if (this.slamMode) {
            this.recoverFrames = FLAME_GOLEM.slam.finalRecoverTicks / this.phaseConfig.animationSpeedMultiplier;
            this._slamCursor = this._dashTargetIndex++;
            this.slam = { index: 0, phase: 'windup', t: 0, mark: this._pickSlamMark(0), from: null };
        }
        if (this.currentAttack === 'attack3') {
            const first = this._dashTargetIndex++ % this.players.length;
            this.marks = [0, 1].map(offset => {
                const player = this.players[(first + offset) % this.players.length];
                return { player, x: player.x, y: player.y };
            });
            this._aimCharge();
        }
        super._beginWindup();
        this.vx = this.vy = 0;
    }

    _aimCharge() {
        const mark = this.marks[this.chargeIndex];
        if (!mark) return;
        const dx = mark.x - this.x, dy = mark.y - this.y;
        const length = Math.hypot(dx, dy);
        this.chargeDirection = length > 0 ? { x: dx / length, y: dy / length } : { x: 1, y: 0 };
        this.facingLeft = this.chargeDirection.x < 0;
    }

    _updatePhase() {
        if (this.phase === 2 || this.hp > FLAME_GOLEM.secondPhaseHp || this.isDying) return;
        const ratio = this.phaseConfig.animationSpeedMultiplier / FLAME_GOLEM.phases[1].animationSpeedMultiplier;
        this.phase = 2;
        this.phaseConfig = FLAME_GOLEM.phases[1];
        if (['windup', 'attack', 'recover'].includes(this.state)) this.stateTimer *= ratio;
        this.animTime *= ratio;
        this.windupFrames *= ratio;
        this.recoverFrames *= ratio;
        this._applyPhaseStats();
    }

    _applyPhaseStats() {
        this.speed = FLAME_GOLEM.speed * this.phaseConfig.movementSpeedMultiplier;
        this.sprite.rows = Object.fromEntries(Object.entries(this._baseRows)
            .map(([key, anim]) => [key, key === 'death' ? { ...anim } : { ...anim, fps: anim.fps / this.phaseConfig.animationSpeedMultiplier }]));
        // A morte tem velocidade própria: a aceleração da fase 2 não a encurta.
        this.dyingDuration = this.sprite.rows.death.frames * this.sprite.rows.death.fps;
    }

    _beginAttack() {
        if (this.slamMode) {
            this.state = 'attack';
            this.justAttacked = true;
            this.animTime = 0;
            this.dealtHit = false;
            // A sequência de saltos encerra sozinha (stateTimer = 0); sem alvo válido encerra já.
            this.stateTimer = this.slam?.mark ? Number.MAX_SAFE_INTEGER : 0;
            if (this.slam?.mark) this._launchSlam();
            return;
        }
        const anim = this.sprite.rows[this.currentAttack];
        const cfg = this.abilities[this.currentAttack];
        this.state = 'attack';
        this.justAttacked = true;
        this.animTime = 0;
        this.dealtHit = false;
        this.stateTimer = this.currentAttack === 'attack3'
            ? Math.max(anim.frames * anim.fps, cfg.launchFrame * anim.fps + this._chargeDuration())
            : anim.frames * anim.fps;
    }

    _updateAttack(players, onPlayerHit) {
        this.vx = this.vy = 0;
        if (this.slamMode) {
            this._updateSlam(onPlayerHit);
            return;
        }
        const cfg = this.abilities[this.currentAttack];
        if (this.currentAttack === 'attack3') {
            this._updateCharge(onPlayerHit);
            return;
        }
        if (this.dealtHit || this.animTime < cfg.hitFrame * this.sprite.rows[this.currentAttack].fps) return;
        this.dealtHit = true;
        const targets = this.currentAttack === 'attack2' ? this.players : [this.target];
        const range = cfg.radius ?? cfg.range;
        for (const player of targets) {
            if (!this.players.includes(player)) continue;
            if (Math.hypot(player.x - this.x, player.y - this.y) > range + player.hitRadius) continue;
            if (!this._hasClearWalkablePath(player)) continue;
            this._hitPlayer(player, this.x, this.y, cfg.knockback, onPlayerHit);
        }
    }

    _hitPlayer(player, sourceX, sourceY, knockback, onPlayerHit) {
        if (this.attackHits.has(player)) return;
        if (player.takeDamage(sourceX, sourceY, { knockback })) {
            this.attackHits.add(player);
            onPlayerHit(player);
        }
    }

    // ---- fase 2: três saltos com slam ----

    _insideArena(x, y) {
        const b = this.navigationBounds;
        if (!b) return true;
        return x >= (b.minX ?? -Infinity) && x <= (b.maxX ?? Infinity) && y >= (b.minY ?? -Infinity) && y <= (b.maxY ?? Infinity);
    }

    // Ponto de aterrissagem: o desejado se for piso seguro, senão o mais próximo do golem dentro do alcance da busca.
    _safeLanding(x, y) {
        const fits = (px, py) => this._insideArena(px, py) && this._chargeFits(px, py);
        if (fits(x, y)) return { x, y };
        const step = this.hitRadius, max = FLAME_GOLEM.slam.landingSearchPx;
        for (let radius = step; radius <= max; radius += step) {
            let best = null, bestDistance = Infinity;
            for (let i = 0; i < 16; i++) {
                const angle = i * Math.PI / 8;
                const px = x + Math.cos(angle) * radius, py = y + Math.sin(angle) * radius;
                if (!fits(px, py)) continue;
                const distance = Math.hypot(px - this.x, py - this.y);
                if (distance < bestDistance) { best = { x: px, y: py }; bestDistance = distance; }
            }
            if (best) return best;
        }
        return null;
    }

    // Escolhe o jogador do salto (alternando) e fixa a marca no chão; null se não houver alvo ou piso seguro.
    _pickSlamMark(index) {
        if (!this.players.length) return null;
        const player = this.players[(this._slamCursor + index) % this.players.length];
        return this._safeLanding(player.x, player.y);
    }

    _launchSlam() {
        const s = this.slam;
        s.phase = 'air';
        s.t = 0;
        s.from = { x: this.x, y: this.y };
        this.airborne = true;
        this.attackHits.clear();
        this.facingLeft = s.mark.x < this.x;
    }

    _updateSlam(onPlayerHit) {
        const s = this.slam;
        if (!s) { this.stateTimer = 0; return; }
        const cfg = FLAME_GOLEM.slam;
        const speed = this.phaseConfig.animationSpeedMultiplier;
        this.pushVx = this.pushVy = 0;
        s.t++;
        if (s.phase === 'air') {
            const impactTicks = this.abilities.attack2.hitFrame * this.sprite.rows.attack2.fps;
            const p = Math.min(1, s.t / (cfg.airTicks / speed));
            const eased = p * p * (3 - 2 * p);
            this.x = s.from.x + (s.mark.x - s.from.x) * eased;
            this.y = s.from.y + (s.mark.y - s.from.y) * eased;
            this.jumpHeight = Math.sin(Math.PI * p) * cfg.jumpHeight;
            this.animTime = p * Math.max(0, impactTicks - 1);
            if (p >= 1) this._landSlam(onPlayerHit, impactTicks);
        } else if (s.phase === 'recover') {
            if (s.t < cfg.betweenTicks / speed) return;
            if (s.index + 1 >= cfg.count) { this._endSlam(); this.stateTimer = 0; return; }
            s.index++;
            s.t = 0;
            s.phase = 'prep';
            s.mark = this._pickSlamMark(s.index);
            if (!s.mark) { this._endSlam(); this.stateTimer = 0; }
        } else if (s.phase === 'prep') {
            this.animTime = 0;
            this.facingLeft = s.mark.x < this.x;
            if (s.t >= cfg.prepTicks / speed) this._launchSlam();
        }
    }

    _landSlam(onPlayerHit, impactTicks) {
        const s = this.slam, cfg = FLAME_GOLEM.slam;
        this.x = s.mark.x;
        this.y = s.mark.y;
        this.airborne = false;
        this.jumpHeight = 0;
        this.animTime = impactTicks;
        this.justSlammed = true;
        this.attackHits.clear();
        s.phase = 'recover';
        s.t = 0;
        for (const player of this.players) {
            if (Math.hypot(player.x - s.mark.x, player.y - s.mark.y) > cfg.radius + player.hitRadius) continue;
            this._hitPlayer(player, s.mark.x, s.mark.y, cfg.knockback, onPlayerHit);
        }
    }

    _endSlam() {
        this.slam = null;
        this.airborne = false;
        this.jumpHeight = 0;
    }

    ensureOnWalkableTile() {
        if (this.airborne) return;
        super.ensureOnWalkableTile();
    }

    // ---- investida ----

    _updateCharge(onPlayerHit) {
        const cfg = this.abilities.attack3;
        const elapsed = this.animTime - cfg.launchFrame * this.sprite.rows.attack3.fps;
        if (elapsed < 0 || elapsed >= this._chargeDuration()) return;
        const mark = this.marks[this.chargeIndex];
        if (!mark) return;
        if (this.players.includes(mark.player)) {
            const desired = Math.atan2(mark.player.y - this.y, mark.player.x - this.x);
            const angle = Math.atan2(this.chargeDirection.y, this.chargeDirection.x);
            const delta = Math.atan2(Math.sin(desired - angle), Math.cos(desired - angle));
            const tracked = angle + delta * Math.max(0, Math.min(1, cfg.trackingStrength));
            this.chargeDirection = { x: Math.cos(tracked), y: Math.sin(tracked) };
        }
        const dir = this.chargeDirection;
        this.facingLeft = dir.x < 0;
        const speed = cfg.speed * this.phaseConfig.dashSpeedMultiplier;
        const steps = Math.max(1, Math.ceil(speed / Math.max(1, cfg.collisionProbePx)));
        let dx = 0, dy = 0;
        for (let i = 1; i <= steps; i++) {
            const x = this.x + dir.x * speed * i / steps;
            const y = this.y + dir.y * speed * i / steps;
            if (!this._chargeFits(x, y)) break;
            dx = x - this.x;
            dy = y - this.y;
        }
        for (const player of this.players) {
            const point = Physics.closestPointOnSegment(player.x, player.y, this.x, this.y, this.x + dx, this.y + dy);
            if (Math.hypot(player.x - point.x, player.y - point.y) > cfg.hitRadius + player.hitRadius) continue;
            if (!this._hasClearWalkablePath(player)) continue;
            this._hitPlayer(player, player.x - dir.x, player.y - dir.y, cfg.knockback, onPlayerHit);
        }
        this.vx = dx;
        this.vy = dy;
    }

    _chargeFits(x, y) {
        const r = this.hitRadius;
        return [[0, 0], [-r, 0], [r, 0], [0, -r], [0, r]]
            .every(([dx, dy]) => this._isWalkable(x + dx, y + dy));
    }

    _chargeDuration() {
        return this.abilities.attack3.durationTicks / this.phaseConfig.animationSpeedMultiplier;
    }

    _finishAttack() {
        this.vx = this.vy = 0;
        if (this.currentAttack === 'attack3' && ++this.chargeIndex < Math.min(this.marks.length, this.phaseConfig.dashCount)) {
            this._aimCharge();
            this.attackHits.clear();
            super._beginWindup();
            return;
        }
        super._finishAttack();
    }

    startDying() {
        this.marks = [];
        this._endSlam();
        super.startDying();
    }

    draw(ctx) {
        if (this.jumpHeight <= 0) { super.draw(ctx); return; }
        ctx.save();
        ctx.translate(0, -this.jumpHeight);
        super.draw(ctx);
        ctx.restore();
    }

    drawAttackEffect(ctx) {
        if (this.isHidden || !['windup', 'attack'].includes(this.state)) return;
        const cfg = FLAME_GOLEM.telegraph;
        ctx.save();
        ctx.strokeStyle = cfg.color;
        ctx.lineWidth = cfg.lineWidth;
        if (this.slamMode && this.slam?.mark && this.slam.phase !== 'recover') {
            const { mark } = this.slam;
            ctx.beginPath();
            ctx.arc(mark.x, mark.y, FLAME_GOLEM.slam.radius, 0, Math.PI * 2);
            ctx.moveTo(mark.x - cfg.crossSize, mark.y);
            ctx.lineTo(mark.x + cfg.crossSize, mark.y);
            ctx.moveTo(mark.x, mark.y - cfg.crossSize);
            ctx.lineTo(mark.x, mark.y + cfg.crossSize);
            ctx.stroke();
        }
        if (this.currentAttack === 'attack2' && !this.slamMode && (this.state === 'windup' || !this.dealtHit)) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.abilities.attack2.radius, 0, Math.PI * 2);
            ctx.stroke();
        }
        if (this.currentAttack === 'attack3') {
            this.marks.forEach((mark, index) => {
                if (index < this.chargeIndex) return;
                ctx.strokeStyle = index === this.chargeIndex ? cfg.color : cfg.secondaryColor;
                ctx.beginPath();
                ctx.arc(mark.x, mark.y, cfg.markerRadius, 0, Math.PI * 2);
                ctx.moveTo(mark.x - cfg.crossSize, mark.y);
                ctx.lineTo(mark.x + cfg.crossSize, mark.y);
                ctx.moveTo(mark.x, mark.y - cfg.crossSize);
                ctx.lineTo(mark.x, mark.y + cfg.crossSize);
                ctx.stroke();
            });
            const mark = this.marks[this.chargeIndex];
            if (mark && this.state === 'windup') {
                ctx.strokeStyle = cfg.color;
                ctx.setLineDash(cfg.dashLine);
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(mark.x, mark.y);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}
