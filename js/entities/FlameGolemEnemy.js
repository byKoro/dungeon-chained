import { MeleeEnemy } from './MeleeEnemy.js';
import { Physics } from '../core/Physics.js';
import { FLAME_GOLEM } from '../config/FlameGolemConfig.js';
import { SIM_HZ, TILE } from '../config/GameConfig.js';
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
        // Decisão em curso: { key, target, dash?, mark? }. Escolhida em `chase` por `_decide()`.
        this.plan = null;
        this._forcedAttack = null;
        this.pressureTicks = 0;
        this.pressureReady = false;
        this._dashPlan = null;
        this._dashTraveled = 0;
        this._chaseTarget = null;
        this._chaseStep = null;
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
        // Só desenho: `{ row, frame, glow }` fixa linha/quadro do sprite durante a apresentação.
        this.introPose = null;
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
        if (!this.frozen && this.hitFreezeTimer <= 0 && !this.isDying && this.state !== 'dead') {
            this._updatePressure();
            if (this.state === 'chase') this._planChase();
            else if (this.state === 'windup') this._trackAim();
        }
        const targets = this.players.length ? [this.players[0], this.players[1] || this.players[0]]
            : [{ x: this.x, y: this.y }, { x: this.x, y: this.y }];
        const fromX = this.x, fromY = this.y;
        super.update(targets, onPlayerHit);
        // A investida já foi validada inteira (pode cruzar buraco), então os pés não cortam o movimento.
        if (!this.charging) this._keepFeetOnFloor(fromX, fromY);
        if (this.state !== 'windup' && this.state !== 'attack') {
            this.marks = [];
            this._dashPlan = null;
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
        if (this.introPose) return this.sprite.rows[this.introPose.row];
        if (this.state === 'windup' && this.sprite.rows[this.currentAttack]) return this.sprite.rows[this.currentAttack];
        return super._currentAnim();
    }

    // No windup a animação do ataque avança até a pose de espera e fica parada nela até o golpe.
    _currentFrameIndex(anim) {
        if (this.introPose) return this.introPose.frame;
        // O epsilon evita que fps fracionários (fase 2) derrubem a pose de espera para o quadro anterior.
        if (this.state === 'attack') return Math.min(Math.floor(this.animTime / anim.fps + 1e-6), anim.frames - 1);
        if (this.state !== 'windup') return super._currentFrameIndex(anim);
        const tell = this._tellFrame();
        if (this.currentAttack === 'attack2') return Math.min(tell, Math.floor(this.animTime / anim.fps));
        const ramp = Math.max(1, this.windupFrames * FLAME_GOLEM.telegraph.rampRatio);
        return Math.min(tell, Math.floor(this.animTime / (ramp / (tell + 1))));
    }

    _beginWindup() {
        const plan = this.plan ?? { key: 'attack', target: this.target };
        this.plan = plan;
        this.currentAttack = plan.key;
        const mult = this.phaseConfig.animationSpeedMultiplier;
        this.windupFrames = this.abilities[plan.key].windupTicks / mult;
        this.recoverFrames = this.abilities[plan.key].recoverTicks / mult;
        this.attackHits.clear();
        this.chargeIndex = 0;
        this._endSlam();
        this.marks = [];
        this._dashPlan = null;
        this.slamMode = this.phase === 2 && plan.key === 'attack2';
        if (this.slamMode) {
            this.recoverFrames = FLAME_GOLEM.slam.finalRecoverTicks / mult;
            const mark = plan.mark ?? this._safeLanding(plan.target.x, plan.target.y);
            this.slam = { index: 0, phase: 'windup', t: 0, mark, from: null };
        }
        if (plan.key === 'attack3') this._setDashPlan(plan.target, plan.dash ?? this._planDash(plan.target));
        super._beginWindup();
        if (plan.key === 'attack2') {
            this.stateTimer += this._tellFrame() * this.sprite.rows.attack2.fps;
        }
        this.vx = this.vy = 0;
    }

    // ---- decisão pela situação (sem ciclo fixo) ----

    // Só para testes/depuração: a próxima decisão usa este ataque contra o jogador mais próximo.
    forceAttack(key) {
        this._forcedAttack = key;
    }

    _readyToAttack() {
        if (!this.players.length) return false;
        this.plan = this._decide();
        return !!this.plan;
    }

    _decide() {
        const forced = this._forcedAttack;
        this._forcedAttack = null;
        if (forced) return this._forcedPlan(forced);
        const near = this._nearPlayers()[0];
        if (near) return { key: this.phase === 1 && this.pressureReady ? 'attack2' : 'attack', target: near };
        const dash = this._pickDashTarget();
        if (dash) return { key: 'attack3', target: dash.target, dash: dash.plan };
        if (this.phase === 2) {
            const jump = this._pickJumpTarget();
            if (jump) return { key: 'attack2', target: jump.target, mark: jump.mark };
        }
        return null;
    }

    _forcedPlan(key) {
        const target = this._byDistance()[0];
        if (key === 'attack3') {
            const dash = this._planDash(target);
            return dash ? { key, target, dash } : null;
        }
        if (key === 'attack2' && this.phase === 2) {
            const mark = this._safeLanding(target.x, target.y);
            return mark ? { key, target, mark } : null;
        }
        return { key, target };
    }

    _distanceTo(p) {
        return Math.hypot(p.x - this.x, p.y - this.y);
    }

    _byDistance() {
        return [...this.players].sort((a, b) => this._distanceTo(a) - this._distanceTo(b));
    }

    // "Perto" = no alcance do melee e sem parede entre o centro do golem e o jogador.
    _nearPlayers() {
        const range = this.abilities.attack.triggerRange;
        return this._byDistance().filter(p => this._distanceTo(p) <= range && !this._wallBetween(this, p));
    }

    _pickDashTarget() {
        const range = this.abilities.attack3.triggerRange;
        for (const target of this._byDistance()) {
            if (this._distanceTo(target) > range) break;
            const plan = this._planDash(target);
            if (plan) return { target, plan };
        }
        return null;
    }

    _pickJumpTarget() {
        const range = FLAME_GOLEM.slam.triggerRange;
        for (const target of this._byDistance()) {
            if (this._distanceTo(target) > range) break;
            const mark = this._safeLanding(target.x, target.y);
            if (mark) return { target, mark };
        }
        return null;
    }

    _dashCount() {
        return FLAME_GOLEM.ai.chainMode === 'sequence' ? this.phaseConfig.dashCount : 1;
    }

    _jumpCount() {
        return FLAME_GOLEM.ai.chainMode === 'sequence' ? FLAME_GOLEM.slam.count : 1;
    }

    // Fase 1: tempo contínuo com alguém perto. Conta em qualquer estado; zera quando os dois saem
    // (cancelando uma pancada ainda não começada), no impacto da pancada e na fase 2.
    _updatePressure() {
        if (this.phase !== 1) { this.pressureTicks = 0; this.pressureReady = false; return; }
        if (!this._nearPlayers().length) { this.pressureTicks = 0; this.pressureReady = false; return; }
        this.pressureTicks++;
        if (this.pressureTicks >= FLAME_GOLEM.ai.pressureSeconds * SIM_HZ) this.pressureReady = true;
    }

    _resetPressure() {
        this.pressureTicks = 0;
        this.pressureReady = false;
    }

    _focusTarget(nearest) {
        if (this.state === 'chase') return this.players.includes(this._chaseTarget) ? this._chaseTarget : nearest;
        const target = this.plan?.target;
        return target && this.players.includes(target) ? target : nearest;
    }

    // Aviso: a investida acompanha a direção do alvo e o salto acompanha o destino. Um plano novo só
    // substitui o anterior se for válido, então a execução sempre usa um trajeto/aterrissagem seguros.
    _trackAim() {
        const target = this.plan?.target;
        if (!target || !this.players.includes(target)) return;
        if (this.currentAttack === 'attack3') {
            const plan = this._planDash(target);
            if (plan) this._setDashPlan(target, plan);
        } else if (this.slamMode && this.slam?.phase === 'windup') {
            const mark = this._safeLanding(target.x, target.y);
            if (mark) this.slam.mark = mark;
        }
    }

    _setDashPlan(target, plan) {
        if (!plan) return;
        this._dashPlan = plan;
        this.chargeDirection = { x: plan.dir.x, y: plan.dir.y };
        this.facingLeft = plan.dir.x < 0;
        this.marks = [{ player: target, x: target.x, y: target.y }];
    }

    // ---- consultas de terreno: paredes protegem; buraco só importa para onde o corpo para ----

    _isWallAt(x, y) {
        if (!this.navigationFloor || !this.navigationBounds) return false;
        const { col, row } = this._tileAt(x, y);
        const floor = this.navigationFloor;
        if (row <= 0 || row >= floor.length - 1 || col <= 0 || col >= (floor[row] || []).length - 1) return true;
        return this.navigationWalls.has(`${col},${row}`);
    }

    _wallBetween(a, b) {
        if (!this.navigationFloor || !this.navigationBounds) return false;
        const dx = b.x - a.x, dy = b.y - a.y;
        const steps = Math.ceil(Math.hypot(dx, dy) / (TILE / 4));
        for (let i = 1; i < steps; i++) {
            if (this._isWallAt(a.x + dx * i / steps, a.y + dy * i / steps)) return true;
        }
        return false;
    }

    // Corpo e pés longe de paredes e dentro da sala; buracos não contam (a investida passa por cima).
    _bodyClearOfWalls(x, y) {
        if (!this._insideArena(x, y)) return false;
        const r = this.hitRadius, foot = this.footY - this.y;
        return [[0, 0], [-r, 0], [r, 0], [0, -r], [0, r], [-r, foot], [0, foot], [r, foot]]
            .every(([dx, dy]) => !this._isWallAt(x + dx, y + dy));
    }

    _dashLength() {
        return this.abilities.attack3.speed * this.phaseConfig.dashSpeedMultiplier * this._chargeDuration();
    }

    // Investida em linha reta para o alvo. Válida se nenhuma parede corta o caminho antes de chegar
    // ao alvo e se existe parada segura (piso para o corpo) a partir daí; para no ponto seguro mais distante.
    _planDash(target) {
        if (!target) return null;
        const cfg = this.abilities.attack3;
        const dx = target.x - this.x, dy = target.y - this.y;
        const dist = Math.hypot(dx, dy);
        const dir = dist > 0 ? { x: dx / dist, y: dy / dist } : { x: this.facingLeft ? -1 : 1, y: 0 };
        const full = this._dashLength();
        if (full <= 0) return null;
        const probe = Math.max(1, cfg.collisionProbePx);
        const at = s => ({ x: this.x + dir.x * s, y: this.y + dir.y * s });
        let reach = 0;
        for (let s = Math.min(probe, full); ; s = Math.min(full, s + probe)) {
            const p = at(s);
            if (!this._bodyClearOfWalls(p.x, p.y)) break;
            reach = s;
            if (s >= full) break;
        }
        const need = Math.min(full, Math.max(0, dist - cfg.hitRadius));
        if (reach < need) return null;
        const safe = s => { const p = at(s); return this._insideArena(p.x, p.y) && this._chargeFits(p.x, p.y); };
        for (let s = reach; s > need; s -= probe) if (safe(s)) return { dir, length: s };
        return need > 0 && safe(need) ? { dir, length: need } : null;
    }

    // ---- perseguição considerando o corpo e os pés ----

    // Escolhe o jogador com o menor caminho para o corpo; sem caminho, o mais próximo pela rota antiga.
    _planChase() {
        this._chaseTarget = null;
        this._chaseStep = null;
        if (!this.players.length) return;
        let best = null;
        for (const target of this._byDistance()) {
            const route = this._bodyRoute(target);
            if (route && (!best || route.length < best.length)) best = { target, step: route.step, length: route.length };
        }
        if (best) {
            this._chaseTarget = best.target;
            this._chaseStep = best.step;
            return;
        }
        const nearest = this._byDistance()[0];
        this._chaseTarget = nearest;
        this._chaseStep = super._chaseWaypoint(nearest) ?? nearest;
    }

    _chaseWaypoint(target) {
        if (target === this._chaseTarget && this._chaseStep) return this._chaseStep;
        return this._bodyRoute(target)?.step ?? super._chaseWaypoint(target) ?? target;
    }

    // BFS em células cujo centro aceita o corpo inteiro. Termina numa célula a até `chaseReachPx`
    // do alvo e sem parede no meio (de onde o melee alcança). Devolve o próximo ponto e o comprimento.
    _bodyRoute(target) {
        const reach = FLAME_GOLEM.ai.chaseReachPx;
        const isGoal = p => Math.hypot(target.x - p.x, target.y - p.y) <= reach && !this._wallBetween(p, target);
        if (!this.navigationFloor || !this.navigationBounds || isGoal(this)) {
            return { step: target, length: Math.hypot(target.x - this.x, target.y - this.y) / TILE };
        }
        const b = this.navigationBounds;
        const center = (col, row) => ({ x: b.minX + (col - 0.5) * TILE, y: b.minY + (row - 0.5) * TILE });
        const start = { ...this._tileAt(this.x, this.y), depth: 0, parent: null };
        const seen = new Set([`${start.col},${start.row}`]);
        const queue = [start];
        for (let q = 0; q < queue.length; q++) {
            const cell = queue[q];
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const col = cell.col + dc, row = cell.row + dr, key = `${col},${row}`;
                if (seen.has(key)) continue;
                seen.add(key);
                const c = center(col, row);
                if (!this._insideArena(c.x, c.y) || !this._chargeFits(c.x, c.y)) continue;
                const node = { col, row, depth: cell.depth + 1, parent: cell };
                if (isGoal(c)) {
                    let first = node;
                    while (first.parent && first.parent !== start) first = first.parent;
                    return { step: center(first.col, first.row), length: node.depth };
                }
                queue.push(node);
            }
        }
        return null;
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
        this._dashTraveled = 0;
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
            if (this._wallBetween(this, player)) continue;
            this._hitPlayer(player, this.x, this.y, cfg.knockback, onPlayerHit);
        }
        if (this.currentAttack === 'attack2') this._resetPressure();
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
            const next = s.index + 1 < this._jumpCount() ? this._pickJumpTarget() : null;
            if (!next) { this._endSlam(); this.stateTimer = 0; return; }
            this.plan = { ...this.plan, target: next.target };
            s.index++;
            s.t = 0;
            s.phase = 'prep';
            this.animTime = 0;
            s.mark = next.mark;
        } else if (s.phase === 'prep') {
            const raiseTicks = this._tellFrame('attack2') * this.sprite.rows.attack2.fps;
            const target = this.plan?.target;
            if (target && this.players.includes(target)) s.mark = this._safeLanding(target.x, target.y) ?? s.mark;
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
        if (this.airborne || this.charging) return;
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
        const plan = this._dashPlan;
        if (!plan) return;
        // Direção e comprimento fixados no lançamento: o trajeto já foi validado e o alvo pode desviar.
        const step = Math.min(cfg.speed * this.phaseConfig.dashSpeedMultiplier, plan.length - this._dashTraveled);
        if (step <= 0) return;
        const dir = plan.dir;
        this.facingLeft = dir.x < 0;
        this.charging = true;
        const dx = dir.x * step, dy = dir.y * step;
        for (const player of this.players) {
            const point = Physics.closestPointOnSegment(player.x, player.y, this.x, this.y, this.x + dx, this.y + dy);
            if (Math.hypot(player.x - point.x, player.y - point.y) > cfg.hitRadius + player.hitRadius) continue;
            if (this._wallBetween(this, player)) continue;
            this._hitPlayer(player, player.x - dir.x, player.y - dir.y, cfg.knockback, onPlayerHit);
        }
        this._dashTraveled += step;
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
        // Modo 'sequence': a próxima investida escolhe de novo o mais próximo com trajeto válido.
        const next = this.currentAttack === 'attack3' && ++this.chargeIndex < this._dashCount()
            ? this._pickDashTarget() : null;
        if (next) {
            this.plan = { ...this.plan, target: next.target, dash: next.plan };
            this._setDashPlan(next.target, next.plan);
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
        if (this.introPose) strength *= this.introPose.glow ?? 1;
        return { x: this.x, y: this.y - this.jumpHeight, radius: cfg.radius, strength };
    }

    // Brasas subindo dos ombros e da cabeça; mais densas no aviso do ataque. Só roda com o jogo em andamento.
    emitEmbers(particleSystem) {
        if (this.isHidden || this.frozen || this.isDying || this.state === 'dead') return;
        if (this.introPose && (this.introPose.glow ?? 1) < 1) return;
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
            const mark = this.marks[0];
            if (mark) {
                ctx.beginPath();
                ctx.arc(mark.x, mark.y, cfg.markerRadius, 0, Math.PI * 2);
                ctx.moveTo(mark.x - cfg.crossSize, mark.y);
                ctx.lineTo(mark.x + cfg.crossSize, mark.y);
                ctx.moveTo(mark.x, mark.y - cfg.crossSize);
                ctx.lineTo(mark.x, mark.y + cfg.crossSize);
                ctx.stroke();
            }
            // Trajeto planejado: do golem até onde a investida vai parar.
            const plan = this._dashPlan;
            if (plan && this.state === 'windup') {
                ctx.strokeStyle = cfg.secondaryColor;
                ctx.setLineDash(cfg.dashLine);
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + plan.dir.x * plan.length, this.y + plan.dir.y * plan.length);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}
