/**
 * EnemyModel - Engine-agnostic enemy AI state machine & physics simulation.
 * Extracted from MeleeEnemy.js, FlameGolemEnemy.js, GhostfireBoss.js, CultistEnemy.js.
 * Zero browser or Canvas dependencies. Directly portable to C# class EnemyModel.
 */
let enemyIdCounter = 1;

export class EnemyModel {
    constructor(type = 'melee', x = 0, y = 0, opts = {}) {
        this.id = opts.id ?? enemyIdCounter++;
        this.type = type;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.pushVx = 0;
        this.pushVy = 0;
        this.hitRadius = opts.hitRadius ?? 18;

        this.hp = opts.hp ?? (type === 'flame_golem' ? 12 : type === 'ghostfire' ? 24 : type === 'cultist' ? 3 : 2);
        this.maxHp = this.hp;
        this.speed = opts.speed ?? (type === 'cultist' ? 1.4 : type === 'flame_golem' ? 1.2 : 1.7);
        this.superArmor = !!opts.superArmor || type === 'flame_golem' || type === 'ghostfire';
        this.immovable = !!opts.immovable || type === 'flame_golem';
        this.collisionBodies = opts.collisionBodies ?? (this.immovable ? [{ x: 0, y: 0, radiusX: this.hitRadius, radiusY: this.hitRadius }] : []);

        this.poiseMax = opts.poise ?? (this.superArmor ? 0 : 3);
        this.poise = this.poiseMax;
        this.poiseRegenTimer = 0;
        this.hitTimer = 0;
        this.flashTimer = 0;
        this.vulnerableTimer = 0;

        this.attackRange = opts.attackRange ?? (type === 'flame_golem' ? 65 : 44);
        this.hitRange = opts.hitRange ?? (type === 'flame_golem' ? 80 : 58);
        this.windupFrames = opts.windupFrames ?? (type === 'flame_golem' ? 45 : 55);
        this.recoverFrames = opts.recoverFrames ?? (type === 'flame_golem' ? 36 : 28);

        this.state = 'chase';
        this.stateTimer = 0;
        this.dealtHit = false;

        this.dyingTimer = 0;
        this.dyingDuration = opts.dyingDuration ?? 16;
        this.facingLeft = false;
        this.animTime = 0;
        this.target = null;

        this.justStepped = false;
        this.justAttacked = false;
        this.justDied = false;
    }

    get isDying() {
        return this.state === 'dying';
    }

    get isDead() {
        return this.state === 'dead';
    }

    startDying(events = null) {
        if (this.state === 'dying' || this.state === 'dead') return;
        this.state = 'dying';
        this.dyingTimer = this.dyingDuration;
        this.vx = 0;
        this.vy = 0;
        this.pushVx = 0;
        this.pushVy = 0;
        this.animTime = 0;
        events?.emitEntityDied(this.id, this.x, this.y, this.type);
    }

    takeHit(damage = 1, hit = null, events = null) {
        if (this.hitTimer > 0 || this.state === 'dying' || this.state === 'dead') return false;

        const vulnerable = this.vulnerableTimer > 0;
        const dealt = Math.max(1, Math.round(damage * (vulnerable ? 1.5 : 1)));
        this.hp -= dealt;
        this.hitTimer = 18;
        this.flashTimer = 8;

        events?.emitEntityDamaged(this.id, this.x, this.y, dealt, false, this.hp);

        if (this.hp <= 0) {
            this.hp = 0;
            this.startDying(events);
            return { damage: dealt, killed: true, staggered: false, poiseBroken: false, vulnerable };
        }

        if (this.superArmor) {
            return { damage: dealt, killed: false, staggered: false, poiseBroken: false, vulnerable };
        }

        let broken = false;
        if (this.state !== 'stunned' && this.poiseMax > 0) {
            this.poise -= 1;
            this.poiseRegenTimer = 90;
            broken = this.poise <= 0;
        }

        this._enterStagger(hit, broken);
        return { damage: dealt, killed: false, staggered: true, poiseBroken: broken, vulnerable };
    }

    _enterStagger(hit, broken) {
        this.dealtHit = false;
        this.justAttacked = false;

        if (broken) {
            this.poise = this.poiseMax;
            this.state = 'stunned';
            this.stateTimer = 45;
            this.vulnerableTimer = 60;
        } else {
            this.state = 'hurt';
            this.stateTimer = 14;
        }

        this.vx = 0;
        this.vy = 0;
        if (hit) {
            const kb = broken ? 12 : 7;
            const len = Math.hypot(hit.dirX ?? 0, hit.dirY ?? 0) || 1;
            this.pushVx = ((hit.dirX ?? 0) / len) * kb;
            this.pushVy = ((hit.dirY ?? 0) / len) * kb;
        }
    }

    update(players, dungeonSim = null, events = null) {
        this.justStepped = false;
        this.justAttacked = false;
        this.justDied = false;

        if (this.hitTimer > 0) this.hitTimer--;
        if (this.flashTimer > 0) this.flashTimer--;
        if (this.vulnerableTimer > 0) this.vulnerableTimer--;
        if (this.poiseMax > 0 && this.poise < this.poiseMax && this.state !== 'stunned' && --this.poiseRegenTimer <= 0) {
            this.poise = this.poiseMax;
        }

        this.animTime++;

        if (this.state === 'dying') {
            this.vx = 0;
            this.vy = 0;
            this.pushVx = 0;
            this.pushVy = 0;
            if (this.dyingTimer > 0) {
                this.dyingTimer--;
                if (this.dyingTimer <= 0) {
                    this.state = 'dead';
                    this.justDied = true;
                }
            }
            return;
        }

        if (this.state === 'dead') {
            this.vx = 0;
            this.vy = 0;
            return;
        }

        if (!players || players.length === 0) return;

        const d1 = Math.hypot(players[0].x - this.x, players[0].y - this.y);
        const d2 = players[1] ? Math.hypot(players[1].x - this.x, players[1].y - this.y) : Infinity;
        this.target = d1 < d2 ? players[0] : players[1];
        const distToTarget = Math.min(d1, d2);

        if (this.state === 'windup' || this.state === 'attack' || this.state === 'recover') {
            this.facingLeft = this.target.x < this.x;
        } else if (this.vx < -0.1) {
            this.facingLeft = true;
        } else if (this.vx > 0.1) {
            this.facingLeft = false;
        }

        switch (this.state) {
            case 'chase': {
                const angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                this.vx = this.vx * 0.85 + Math.cos(angle) * this.speed * 0.15;
                this.vy = this.vy * 0.85 + Math.sin(angle) * this.speed * 0.15;

                if (distToTarget <= this.attackRange) {
                    this.state = 'windup';
                    this.stateTimer = this.windupFrames;
                    this.animTime = 0;
                }
                break;
            }

            case 'windup': {
                this.vx *= 0.6;
                this.vy *= 0.6;
                this.stateTimer--;
                if (this.stateTimer <= 0) {
                    this.state = 'attack';
                    this.stateTimer = 18;
                    this.justAttacked = true;
                    this.animTime = 0;
                }
                break;
            }

            case 'attack': {
                if (!this.dealtHit && distToTarget <= this.hitRange && this.target) {
                    this.target.takeDamage(this.x, this.y, { knockback: 16 }, events);
                    this.dealtHit = true;
                }
                this.stateTimer--;
                if (this.stateTimer <= 0) {
                    this.state = 'recover';
                    this.stateTimer = this.recoverFrames;
                    this.dealtHit = false;
                    this.animTime = 0;
                }
                break;
            }

            case 'recover': {
                this.vx *= 0.7;
                this.vy *= 0.7;
                this.stateTimer--;
                if (this.stateTimer <= 0) {
                    this.state = 'chase';
                    this.animTime = 0;
                }
                break;
            }

            case 'hurt':
            case 'stunned': {
                this.vx *= 0.6;
                this.vy *= 0.6;
                if (--this.stateTimer <= 0) {
                    this.state = 'chase';
                    this.animTime = 0;
                }
                break;
            }
        }

        this.x += this.vx + this.pushVx;
        this.y += this.vy + this.pushVy;

        this.pushVx *= 0.82;
        this.pushVy *= 0.82;
        if (Math.abs(this.pushVx) < 0.05) this.pushVx = 0;
        if (Math.abs(this.pushVy) < 0.05) this.pushVy = 0;
    }

    getRenderState() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            facingLeft: this.facingLeft,
            state: this.state,
            animState: this.state,
            animFrame: Math.floor(this.animTime / 6),
            hp: this.hp,
            maxHp: this.maxHp,
            poise: this.poise,
            poiseMax: this.poiseMax,
            feetSortY: this.y + this.hitRadius
        };
    }

    static create(type, x, y, opts = {}) {
        return new EnemyModel(type, x, y, opts);
    }
}
