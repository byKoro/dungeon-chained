import { MeleeEnemy } from './MeleeEnemy.js';
import { SUMMONER } from '../config/SummonerConfig.js';

// Conjurador baseado na sprite do Cultista. Mantém distância dos jogadores e, a cada
// intervalo, toca a animação de invocação (linha 5) UMA vez; no frame de liberação
// levanta `justSummoned` para o SummonerSystem materializar os minions (ADR 0002/0003).
export class SummonerEnemy extends MeleeEnemy {
    constructor(x, y, sheet, sprite, floor = 1) {
        super(x, y, sheet, sprite, floor);
        this.preferredDistance = SUMMONER.preferredDistance;
        this.attackRange = -1;
        this.hitRange = -1;
        this.players = [];
        this.summonTimer = SUMMONER.summonInterval;
        this.justSummoned = false;
        this.isSummoner = true;
        // Estado de invocação próprio, independente do ciclo de ataque do melee.
        this.summoning = false;
        this.summonAnimTime = 0;
        this._released = false;
    }

    get _summonDuration() {
        const a = this.sprite.rows.summon;
        return a.frames * a.fps;
    }

    _chaseWaypoint(target) {
        const distance = Math.hypot(target.x - this.x, target.y - this.y);
        if (distance > this.preferredDistance + SUMMONER.distanceTolerance) return super._chaseWaypoint(target);
        if (distance >= this.preferredDistance - SUMMONER.distanceTolerance) return null;

        let best = null;
        let clearance = Math.min(...this.players.map(p => Math.hypot(p.x - this.x, p.y - this.y)));
        for (let i = 0; i < 8; i++) {
            const angle = i * Math.PI / 4;
            const next = { x: this.x + Math.cos(angle) * this.speed * SUMMONER.retreatProbeSteps, y: this.y + Math.sin(angle) * this.speed * SUMMONER.retreatProbeSteps };
            if (!this._isWalkable(next.x, next.y) || !this._hasClearWalkablePath(next)) continue;
            const score = Math.min(...this.players.map(p => Math.hypot(p.x - next.x, p.y - next.y)));
            if (score > clearance) { best = next; clearance = score; }
        }
        return best;
    }

    update(players, onPlayerHit) {
        this.justSummoned = false;
        this.players = players.filter(p => p.lives > 0 && !p.falling);

        const paused = this.frozen || this.hitFreezeTimer > 0;
        if (paused || this.state === 'dying' || this.state === 'dead') {
            this.summoning = false;
            super.update(players, onPlayerHit);
            return;
        }

        // Tomar dano cancela a invocação em andamento.
        if (this.summoning && (this.state === 'hurt' || this.state === 'stunned')) {
            this.summoning = false;
        }

        if (this.summoning) {
            // Fica parado tocando a animação da linha 5 uma única vez (sem o ciclo do melee).
            this.hitTimer = Math.max(0, this.hitTimer - 1);
            if (this.flashTimer > 0) this.flashTimer--;
            this.vx = this.vy = 0;
            if (this.players.length) this.facingLeft = this.players[0].x < this.x;
            this._applyPush();
            this._advanceSummon();
            return;
        }

        // Invocador não dá dano por corpo a corpo: cancela windup/attack do melee.
        this.attackRange = -1;
        if (this.state === 'windup' || this.state === 'attack' || this.state === 'recover') {
            this.state = 'chase';
            this.animTime = 0;
        }

        super.update(players, onPlayerHit);

        // Só conta o tempo (e dispara a invocação) quando está perseguindo e há alvo.
        if (this.state !== 'chase' || !this.players.length) {
            if (!this.players.length) this.summonTimer = SUMMONER.summonInterval;
            return;
        }

        if (--this.summonTimer <= 0) {
            this.summonTimer = SUMMONER.summonInterval;
            this._beginSummon();
        }
    }

    _beginSummon() {
        this.summoning = true;
        this.summonAnimTime = 0;
        this._released = false;
        this.vx = this.vy = 0;
        this.state = 'chase';
    }

    _advanceSummon() {
        this.summonAnimTime++;
        const a = this.sprite.rows.summon;
        const releaseAt = SUMMONER.summonReleaseFrame * a.fps;
        if (!this._released && this.summonAnimTime >= releaseAt) {
            this._released = true;
            this.justSummoned = true;
        }
        if (this.summonAnimTime >= this._summonDuration) {
            this.summoning = false;
            this.state = 'chase';
            this.animTime = 0;
        }
    }

    // Animação da linha 5 só durante a invocação; fora disso, o melee desenha normal.
    _currentAnim() {
        if (this.summoning) return this.sprite.rows.summon;
        return super._currentAnim();
    }

    _currentFrameIndex(anim) {
        if (this.summoning) {
            return Math.min(Math.floor(this.summonAnimTime / anim.fps), anim.frames - 1);
        }
        return super._currentFrameIndex(anim);
    }
}
