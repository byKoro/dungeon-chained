import { MeleeEnemy } from './MeleeEnemy.js';
import { Physics } from '../core/Physics.js';
import { FLAME_GOLEM } from '../config/FlameGolemConfig.js';
import { SIM_HZ } from '../config/GameConfig.js';
import { ARAUTO_FX } from '../config/ArautoEffectsConfig.js';

export class FlameGolemEnemy extends MeleeEnemy {
    constructor(x, y, sheet, sprite, floor = 1) {
        super(x, y, sheet, sprite, floor);
        this.abilities = FLAME_GOLEM.attacks;
        this.effectMaterial = sprite.combat?.effectMaterial;
        this._baseRows = sprite.rows;
        this.sprite = { ...sprite, rows: { ...sprite.rows } };
        this.phase = 1;
        this.phaseConfig = FLAME_GOLEM.phases[0];
        this._applyPhaseStats();
        this.hitRadius = FLAME_GOLEM.hitRadius;
        this.outline = FLAME_GOLEM.outline;
        this._emberAcc = 0;
        this._lightT = 0;
        this._slamGlow = 0;
        this.players = [];
        this.marks = [];
        this.chargeIndex = 0;
        this._dashTargetIndex = 0;
        this.chargeDirection = { x: 1, y: 0 };
        this.attackHits = new Set();
        this.slamMode = false;
        this.slam = null;
        this.airborne = false;
        this.charging = false;
        this.jumpHeight = 0;
        this.justSlammed = false;
        this.justGroundHit = false;
        this.phaseTransitionControlled = false;
        this.lavaReveal = 0;
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

    get ignoresEntityCollisions() {
        return this.airborne;
    }

    get immovable() {
        return FLAME_GOLEM.immovable;
    }

    get collisionBodies() {
        const cfg = FLAME_GOLEM.bodyCollision;
        const anim = this._currentAnim();
        const frame = this._currentFrameIndex(anim);
        const attacking = this.state === 'windup' || this.state === 'attack';
        const lift = attacking ? Math.min(1, frame / Math.max(1, this._tellFrame())) : 0;
        const armY = cfg.armY - lift * cfg.armLift;
        const armX = cfg.armX + lift * cfg.armSpread;
        return [
            { x: 0, y: cfg.torsoY, radiusX: cfg.torsoX, radiusY: cfg.torsoRadiusY },
            ...[-1, 1].map(side => ({ x: side * armX, y: armY, radiusX: cfg.armRadius, radiusY: cfg.armRadius }))
        ];
    }

    update(players, onPlayerHit) {
        this.justSlammed = false;
        this.justGroundHit = false;
        this.charging = false;
        if (!this.phaseTransitionControlled && !this.frozen && this.hitFreezeTimer <= 0) this._updatePhase();
        this.players = players.filter(p => p.lives > 0 && !p.falling);
        const next = this.abilities[this.attackKeys[this.attackIndex % this.attackKeys.length]];
        this.attackRange = this.players.length ? next.triggerRange : -1;
        const targets = this.players.length ? [this.players[0], this.players[1] || this.players[0]]
            : [{ x: this.x, y: this.y }, { x: this.x, y: this.y }];
        const fromX = this.x, fromY = this.y;
        super.update(targets, onPlayerHit);
        this._keepFeetOnFloor(fromX, fromY);
        if (this.state !== 'windup' && this.state !== 'attack') {
            this.marks = [];
            this._endSlam();
        }
        this._lightT++;
        this._slamGlow = this.justSlammed ? 1 : this._slamGlow * 0.92;
    }

    // ---- aviso do ataque: a própria animação, parada na pose de espera ----

    // Quadro logo antes do impacto (ou do lançamento da investida): a pose que "mostra o que vai fazer".
    _tellFrame(key = this.currentAttack) {
        const cfg = this.abilities[key];
        if (!cfg) return 0;
        if (key === 'attack2') return cfg.raisedFrame;
        return Math.max(0, (key === 'attack3' ? cfg.launchFrame : cfg.hitFrame) - 1);
    }

    _currentAnim() {
        if (this.state === 'windup' && this.sprite.rows[this.currentAttack]) return this.sprite.rows[this.currentAttack];
        return super._currentAnim();
    }

    // No windup a animação do ataque avança até a pose de espera e fica parada nela até o golpe.
    _currentFrameIndex(anim) {
        // O epsilon evita que fps fracionários (fase 2) derrubem a pose de espera para o quadro anterior.
        if (this.state === 'attack') return Math.min(Math.floor(this.animTime / anim.fps + 1e-6), anim.frames - 1);
        if (this.state !== 'windup') return super._currentFrameIndex(anim);
        const tell = this._tellFrame();
        if (this.currentAttack === 'attack2') return Math.min(tell, Math.floor(this.animTime / anim.fps));
        const ramp = Math.max(1, this.windupFrames * FLAME_GOLEM.telegraph.rampRatio);
        return Math.min(tell, Math.floor(this.animTime / (ramp / (tell + 1))));
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
        if (this.currentAttack === 'attack2') {
            this.stateTimer += this._tellFrame() * this.sprite.rows.attack2.fps;
        }
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
            this.animTime = this._tellFrame() * this.sprite.rows.attack2.fps;
            this.dealtHit = false;
            // A sequência de saltos encerra sozinha (stateTimer = 0); sem alvo válido encerra já.
            this.stateTimer = this.slam?.mark ? Number.MAX_SAFE_INTEGER : 0;
            if (this.slam?.mark) this._launchSlam();
            return;
        }
        const anim = this.sprite.rows[this.currentAttack];
        const cfg = this.abilities[this.currentAttack];
        // A animação continua da pose de espera (sem voltar ao quadro 0); o tempo restante desconta o que já passou.
        const tellTicks = this._tellFrame() * anim.fps;
        this.state = 'attack';
        this.justAttacked = true;
        this.animTime = tellTicks;
        this.dealtHit = false;
        this.stateTimer = (this.currentAttack === 'attack3'
            ? Math.max(anim.frames * anim.fps, cfg.launchFrame * anim.fps + this._chargeDuration())
            : anim.frames * anim.fps) - tellTicks;
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
        this.justGroundHit = true;
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
            const fps = this.sprite.rows.attack2.fps;
            const impactTicks = this.abilities.attack2.hitFrame * fps;
            const tellTicks = this._tellFrame('attack2') * fps;
            const p = Math.min(1, s.t / (cfg.airTicks / speed));
            const eased = p * p * (3 - 2 * p);
            this.x = s.from.x + (s.mark.x - s.from.x) * eased;
            this.y = s.from.y + (s.mark.y - s.from.y) * eased;
            this.jumpHeight = Math.sin(Math.PI * p) * cfg.jumpHeight;
            this.animTime = tellTicks + p * Math.max(0, impactTicks - 1 - tellTicks);
            if (p >= 1) this._landSlam(onPlayerHit, impactTicks);
        } else if (s.phase === 'recover') {
            if (s.t < cfg.betweenTicks / speed) return;
            if (s.index + 1 >= cfg.count) { this._endSlam(); this.stateTimer = 0; return; }
            s.index++;
            s.t = 0;
            s.phase = 'prep';
            this.animTime = 0;
            s.mark = this._pickSlamMark(s.index);
            if (!s.mark) { this._endSlam(); this.stateTimer = 0; }
        } else if (s.phase === 'prep') {
            const raiseTicks = this._tellFrame('attack2') * this.sprite.rows.attack2.fps;
            this.animTime = Math.min(s.t, raiseTicks);
            this.facingLeft = s.mark.x < this.x;
            if (s.t >= raiseTicks + cfg.prepTicks / speed) this._launchSlam();
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

    // Sem knockback: nem o golpe da serra nem os impulsos da física (Physics._addImpulse) deslocam o chefe.
    _applyPush() {
        this.pushVx = this.pushVy = 0;
    }

    // O centro fica ~70 px acima dos pés: testar só o centro deixava o corpo pendurado sobre buraco ao sul ou fora da sala.
    _standsOnFloor(x, y) {
        const r = this.hitRadius, foot = this.footY - this.y;
        return this._isWalkable(x, y) && [-r, 0, r].every(dx => this._isWalkable(x + dx, y + foot));
    }

    // Andar/empurrão que levaria os pés para fora do piso é cortado por eixo (desliza pela borda).
    _keepFeetOnFloor(fromX, fromY) {
        if (this.airborne || !this.navigationFloor || (this.x === fromX && this.y === fromY)) return;
        if (this._standsOnFloor(this.x, this.y)) return;
        const toX = this.x, toY = this.y;
        if (this._standsOnFloor(toX, fromY)) { this.y = fromY; this.vy = 0; this.pushVy = 0; return; }
        if (this._standsOnFloor(fromX, toY)) { this.x = fromX; this.vx = 0; this.pushVx = 0; return; }
        this.x = fromX; this.y = fromY;
        this.vx = this.vy = this.pushVx = this.pushVy = 0;
    }

    // Piso mais próximo onde o corpo cabe (busca em anéis), para nunca ficar preso fora do mapa.
    _nearestStandingSpot() {
        const step = 16, max = 12 * step;
        for (let radius = step; radius <= max; radius += step) {
            let best = null, bestDistance = Infinity;
            for (let i = 0; i < 16; i++) {
                const angle = i * Math.PI / 8;
                const x = this.x + Math.cos(angle) * radius, y = this.y + Math.sin(angle) * radius;
                if (!this._insideArena(x, y) || !this._standsOnFloor(x, y)) continue;
                const distance = Math.hypot(x - this.x, y - this.y);
                if (distance < bestDistance) { best = { x, y }; bestDistance = distance; }
            }
            if (best) return best;
        }
        return null;
    }

    ensureOnWalkableTile() {
        if (this.airborne) return;
        if (!this.navigationFloor || this._standsOnFloor(this.x, this.y)) { super.ensureOnWalkableTile(); return; }
        const spot = this._standsOnFloor(this.lastSafePosition.x, this.lastSafePosition.y)
            ? this.lastSafePosition : this._nearestStandingSpot();
        if (!spot) return;
        this.x = spot.x;
        this.y = spot.y;
        this.lastSafePosition = { x: spot.x, y: spot.y };
        this.vx = this.vy = this.pushVx = this.pushVy = 0;
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
        this.charging = true;
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
            .every(([dx, dy]) => this._isWalkable(x + dx, y + dy)) && this._standsOnFloor(x, y);
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

    // Sombra oval nos pés, proporcional ao corpo. Fica no chão durante o salto, menor e mais fraca.
    drawShadow(ctx) {
        if (this.isHidden) return;
        const cfg = FLAME_GOLEM.shadow, s = this.sprite;
        const bodyW = s.body.w * (s.drawHeight / s.cropH);
        const lift = this.jumpHeight > 0 ? Math.min(1, this.jumpHeight / FLAME_GOLEM.slam.jumpHeight) : 0;
        const rx = bodyW * cfg.widthRatio * (1 - cfg.jumpShrink * lift);
        const ry = rx * cfg.heightRatio;
        const alpha = cfg.alpha * (1 - 0.5 * lift);
        ctx.save();
        ctx.translate(this.x, this.footY + cfg.yOffset);
        ctx.scale(1, ry / rx);
        const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
        grad.addColorStop(0, `rgba(0, 0, 0, ${alpha})`);
        grad.addColorStop(0.6, `rgba(0, 0, 0, ${alpha * 0.55})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Luz quente de brasa: mais forte no aviso do ataque e no impacto do slam; desbota na morte e sobra um brilho fraco nos escombros.
    lightInfo() {
        if (this.isHidden) return null;
        const cfg = FLAME_GOLEM.light;
        let strength = 0.8 + Math.sin(this._lightT * 0.05) * cfg.pulse;
        strength += ARAUTO_FX.phaseLightBoost * (this.phase === 2 ? 1 : this.lavaReveal);
        if (this.state === 'windup') strength += cfg.windupBoost;
        strength += cfg.slamBoost * this._slamGlow;
        if (this.state === 'dead') strength = cfg.corpseStrength;
        else if (this.isDying) {
            const k = this.dyingDuration > 0 ? Math.max(0, this.dyingTimer / this.dyingDuration) : 0;
            strength = cfg.corpseStrength + (strength - cfg.corpseStrength) * k;
        }
        return { x: this.x, y: this.y - this.jumpHeight, radius: cfg.radius, strength };
    }

    // Brasas subindo dos ombros e da cabeça; mais densas no aviso do ataque. Só roda com o jogo em andamento.
    emitEmbers(particleSystem) {
        if (this.isHidden || this.frozen || this.isDying || this.state === 'dead') return;
        const cfg = FLAME_GOLEM.embers;
        const rate = cfg.perSecond * (this.state === 'windup' ? cfg.windupMultiplier : 1);
        this._emberAcc += rate / SIM_HZ;
        while (this._emberAcc >= 1) {
            this._emberAcc -= 1;
            const x = this.x + (Math.random() - 0.5) * this.drawHeight * 0.9;
            const y = this.y - this.drawHeight * 0.35 - this.jumpHeight;
            particleSystem?.triggerFlameBurst?.(x, y, cfg.color, { amount: cfg.amount, rise: cfg.rise, width: cfg.width });
        }
    }

    drawAttackEffect(ctx) {
        if (this.isHidden || !['windup', 'attack'].includes(this.state)) return;
        if (!FLAME_GOLEM.telegraph.showMarks) return;
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
