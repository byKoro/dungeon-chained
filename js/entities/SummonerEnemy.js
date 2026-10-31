import { MeleeEnemy } from './MeleeEnemy.js';
import { SUMMONER } from '../config/SummonerConfig.js';

// Conjurador baseado na sprite do Cultista. Mantém distância dos jogadores e, a cada
// intervalo, toca a animação de invocação (linha 5) UMA vez; no frame de liberação
// levanta `justSummoned` para o SummonerSystem materializar os minions (ADR 0002/0003).
export class SummonerEnemy extends MeleeEnemy {
    constructor(x, y, sheet, sprite, floor = 1) {
        super(x, y, sheet, sprite, floor);
        this.fleeDistance = SUMMONER.fleeDistance;
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
        // Estado do ataque da linha 4 (estoura num ponto aleatório entre os jogadores).
        this.casting = false;
        this.castTimer = SUMMONER.castInterval;
        this.castAnimTime = 0;
        this._castDealt = false;
        this.markedPosition = null;
        this.castHits = new Set();
    }

    startDying() {
        this.summoning = false;
        this.casting = false;
        this.markedPosition = null;
        super.startDying();
    }

    get _summonDuration() {
        const a = this.sprite.rows.summon;
        return a.frames * a.fps;
    }

    get _castDuration() {
        const a = this.sprite.rows.cast;
        return a.frames * a.fps;
    }

    // Ponto aleatório entre os dois jogadores (ou perto do único vivo).
    _midAttackPoint() {
        const live = this.players;
        if (!live.length) return null;
        const a = live[0], b = live[1] || live[0];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const s = SUMMONER.castSpread;
        const point = { x: mx + (Math.random() - 0.5) * 2 * s, y: my + (Math.random() - 0.5) * 2 * s };
        if (this._isWalkable(point.x, point.y)) return point;
        return { x: mx, y: my };
    }

    // Não persegue. Fica parado conjurando e só recua quando um jogador chega muito perto.
    _chaseWaypoint() {
        if (!this.players.length) return null;
        const nearest = Math.min(...this.players.map(p => Math.hypot(p.x - this.x, p.y - this.y)));
        if (nearest >= this.fleeDistance) return null;

        let best = null;
        let clearance = nearest;
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
            this.casting = false;
            this.markedPosition = null;
            super.update(players, onPlayerHit);
            return;
        }

        // Tomar dano cancela a invocação/ataque em andamento.
        if ((this.summoning || this.casting) && (this.state === 'hurt' || this.state === 'stunned')) {
            this.summoning = false;
            this.casting = false;
            this.markedPosition = null;
        }

        if (this.summoning) {
            // Fica parado tocando a animação da linha 5 uma única vez (sem o ciclo do melee).
            this.hitTimer = Math.max(0, this.hitTimer - 1);
            this.vx = this.vy = 0;
            if (this.players.length) this.facingLeft = this.players[0].x < this.x;
            this._applyPush();
            this._advanceSummon();
            return;
        }

        if (this.casting) {
            // Toca a animação da linha 4 e estoura o dano no ponto marcado.
            this.hitTimer = Math.max(0, this.hitTimer - 1);
            this.vx = this.vy = 0;
            if (this.markedPosition) this.facingLeft = this.markedPosition.x < this.x;
            this._applyPush();
            this._advanceCast(onPlayerHit);
            return;
        }

        // Invocador não dá dano por corpo a corpo: cancela windup/attack do melee.
        this.attackRange = -1;
        if (this.state === 'windup' || this.state === 'attack' || this.state === 'recover') {
            this.state = 'chase';
            this.animTime = 0;
        }

        super.update(players, onPlayerHit);

        // Só conta os tempos (e dispara) quando está perseguindo e há alvo.
        if (this.state !== 'chase' || !this.players.length) {
            if (!this.players.length) {
                this.summonTimer = SUMMONER.summonInterval;
                this.castTimer = SUMMONER.castInterval;
            }
            return;
        }

        // Invocação tem prioridade; o ataque da linha 4 dispara nos outros ciclos.
        if (--this.summonTimer <= 0) {
            this.summonTimer = SUMMONER.summonInterval;
            this._beginSummon();
            return;
        }
        if (--this.castTimer <= 0) {
            this.castTimer = SUMMONER.castInterval;
            this._beginCast();
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

    _beginCast() {
        const point = this._midAttackPoint();
        if (!point) { this.castTimer = SUMMONER.castInterval; return; }
        this.casting = true;
        this.castAnimTime = 0;
        this._castDealt = false;
        this.markedPosition = point;
        this.castHits.clear();
        this.vx = this.vy = 0;
        this.state = 'chase';
    }

    _advanceCast(onPlayerHit) {
        this.castAnimTime++;
        const a = this.sprite.rows.cast;
        const frame = Math.min(Math.floor(this.castAnimTime / a.fps), a.frames - 1);
        const cfg = SUMMONER.cast;

        // Janela de dano: atinge quem está no raio em torno do ponto marcado.
        if (this.markedPosition && frame >= cfg.damageFirstFrame && frame <= cfg.damageLastFrame) {
            for (const player of this.players) {
                if (this.castHits.has(player)) continue;
                const d = Math.hypot(player.x - this.markedPosition.x, player.y - this.markedPosition.y);
                if (d > cfg.radius + (player.hitRadius ?? 16)) continue;
                if (player.takeDamage(this.markedPosition.x, this.markedPosition.y)) {
                    this.castHits.add(player);
                    onPlayerHit?.(player);
                }
            }
        }

        if (this.castAnimTime >= this._castDuration) {
            this.casting = false;
            this.markedPosition = null;
            this.state = 'chase';
            this.animTime = 0;
        }
    }

    // Linha 5 durante a invocação, linha 4 durante o ataque; fora disso, o melee desenha normal.
    _currentAnim() {
        if (this.summoning) return this.sprite.rows.summon;
        if (this.casting) return this.sprite.rows.cast;
        return super._currentAnim();
    }

    _currentFrameIndex(anim) {
        if (this.summoning) {
            return Math.min(Math.floor(this.summonAnimTime / anim.fps), anim.frames - 1);
        }
        if (this.casting) {
            return Math.min(Math.floor(this.castAnimTime / anim.fps), anim.frames - 1);
        }
        return super._currentFrameIndex(anim);
    }

    // Fica vermelho enquanto invoca ou lança o ataque; nos demais momentos, o tint normal.
    _tintSpec() {
        if (this.summoning || this.casting) return { color: SUMMONER.summonTint.color, alpha: SUMMONER.summonTint.alpha };
        return super._tintSpec();
    }

    // Durante o pilar, estreita o recorte do corpo (como o cultista) para não puxar a
    // arte do pilar embutida na folha.
    draw(ctx) {
        const original = this.sprite;
        const cfg = SUMMONER.cast;
        if (this.casting) {
            const frame = Math.min(Math.floor(this.castAnimTime / this.sprite.rows.cast.fps), this.sprite.rows.cast.frames - 1);
            if (frame >= cfg.firstFrame) this.sprite = { ...original, cropW: cfg.casterCropW };
        }
        try { super.draw(ctx); }
        finally { this.sprite = original; }
    }

    // Desenha o pilar de fogo subindo do chão no ponto marcado (padrão do cultista).
    drawAttackEffect(ctx) {
        if (this.isHidden || !this.casting || !this.markedPosition) return;
        if (!this.sheet?.complete || !this.sheet.naturalWidth) return;
        const cfg = SUMMONER.cast;
        const a = this.sprite.rows.cast;
        const frame = Math.min(Math.floor(this.castAnimTime / a.fps), a.frames - 1);
        if (frame < cfg.firstFrame) return;
        const p = this.markedPosition;
        ctx.save();
        ctx.drawImage(this.sheet,
            frame * this.sprite.cellSize + cfg.cropX, a.row * this.sprite.cellSize + cfg.cropY, cfg.cropW, cfg.cropH,
            p.x - (cfg.anchorX - cfg.cropX) * cfg.scale, p.y - (cfg.anchorY - cfg.cropY) * cfg.scale,
            cfg.cropW * cfg.scale, cfg.cropH * cfg.scale);
        ctx.restore();
    }
}
