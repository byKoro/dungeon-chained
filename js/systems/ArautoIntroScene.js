import { ARAUTO_INTRO } from '../config/ArautoIntroConfig.js';
import { LETTERBOX } from '../config/LetterboxConfig.js';
import { SIM_HZ } from '../config/GameConfig.js';
import { letterboxAmount } from '../ui/Letterbox.js';

// Apresentação do Arauto: o golem se remonta (morte ao contrário), ergue os braços e bate no chão.
// O Game congela a simulação enquanto `active`; no fim o golem espera `attackDelaySteps` em recover.
export class ArautoIntroScene {
    constructor({ camera = null, hud = null, effects = null, arautoAudio = null, audio = null, particles = null,
        getPlayers = () => [], storage = null, forceFull = false, onFinish = null, cfg = ARAUTO_INTRO }) {
        Object.assign(this, { camera, hud, effects, arautoAudio, audio, particles, getPlayers, storage, forceFull, onFinish, cfg });
        this.enemy = null;
        this.reset();
    }

    get active() { return !!this.enemy; }

    get letterbox() {
        if (!this.active) return 0;
        return letterboxAmount(this.t, LETTERBOX.inSeconds, this.barsOutAt, this.end);
    }

    reset() {
        if (this.active) this._restore();
        this.enemy = null;
        this.t = 0;
    }

    _seen() {
        try { return this.storage?.getItem(this.cfg.sessionKey) === '1'; } catch { return false; }
    }

    _markSeen() {
        try { this.storage?.setItem(this.cfg.sessionKey, '1'); } catch { /* storage pode estar indisponível */ }
    }

    start(enemy) {
        if (this.active || !enemy) return false;
        const rows = enemy.sprite.rows, c = this.cfg;
        this.enemy = enemy;
        this.t = 0;
        this.short = this._seen() && !this.forceFull;
        const tick = 1 / SIM_HZ;
        this.deathFrame = rows.death.fps * tick;
        this.raiseFrame = rows.attack2.fps * tick;
        this.lastDeathFrame = rows.death.frames - 1;
        this.hitFrame = rows.attack2.hitFrame;
        const mode = this.short ? c.short : c.full;
        this.assembleAt = this.short ? null : mode.assembleAt;
        this.raiseAt = this.short ? mode.raiseAt : mode.assembleAt + rows.death.frames * this.deathFrame;
        this.impactAt = this.raiseAt + this.hitFrame * this.raiseFrame;
        this.barsOutAt = this.impactAt + mode.barsOutAfterImpact;
        this.end = this.impactAt + mode.endAfterImpact;
        this.readyAt = this.impactAt + c.readyAfterImpact;
        this.impacted = false;
        this.assembleShown = -1;
        this.expression = null;
        this._focused = false;
        this.players = this.getPlayers().map(p => ({ p, expression: p.expression }));
        for (const { p } of this.players) { p.cancelDash?.(); p.vx = p.vy = 0; p.facingLeft = enemy.x < p.x; }
        enemy.vx = enemy.vy = enemy.pushVx = enemy.pushVy = 0;
        this._pose();
        return true;
    }

    _setExpression(name) {
        if (this.expression === name) return;
        this.expression = name;
        this.hud?.onBossTransformation(name);
        for (const { p } of this.players) p.expression = name;
    }

    _pose() {
        const e = this.enemy, t = this.t;
        if (this.short) {
            e.introPose = { row: 'attack2', frame: this._raiseFrameAt(t), glow: 1 };
            return;
        }
        if (t < this.assembleAt) { e.introPose = { row: 'death', frame: this.lastDeathFrame, glow: 0 }; return; }
        if (t < this.raiseAt) {
            const step = Math.min(this.lastDeathFrame, Math.floor((t - this.assembleAt) / this.deathFrame));
            e.introPose = { row: 'death', frame: this.lastDeathFrame - step, glow: (step + 1) / (this.lastDeathFrame + 1) };
            return;
        }
        e.introPose = { row: 'attack2', frame: this._raiseFrameAt(t), glow: 1 };
    }

    _raiseFrameAt(t) {
        if (t < this.raiseAt) return 0;
        const last = this.enemy.sprite.rows.attack2.frames - 1;
        return Math.min(last, Math.floor((t - this.raiseAt) / this.raiseFrame + 1e-6));
    }

    update(dt) {
        if (!this.active) return;
        if (!this._focused) {
            this._focused = true;
            if (this.camera) this.camera.focus = { x: this.enemy.x, y: this.enemy.y, zoom: this.cfg.zoom };
        }
        this.t += dt;
        const t = this.t, ex = this.cfg.expressions;
        this._pose();
        const pose = this.enemy.introPose;
        if (!this.short && pose.row === 'death' && t >= this.assembleAt && pose.frame !== this.assembleShown) {
            this.assembleShown = pose.frame;
            this.audio?.play(this.cfg.assembleCue);
        }
        if (t >= this.readyAt) this._setExpression(ex.ready);
        else if (t >= this.raiseAt) this._setExpression(ex.raise);
        else if (!this.short && t >= this.assembleAt) this._setExpression(ex.assemble);
        else this._setExpression(ex.focus);
        if (!this.impacted && t >= this.impactAt) {
            this.impacted = true;
            this.effects?.groundHit(this.enemy, true);
            this.arautoAudio?.groundHit(true);
        }
        if (pose.glow >= 1) this.enemy.emitEmbers?.(this.particles);
        if (t >= this.end) this._finish();
    }

    // Pula direto para o fim: golem de pé, sem o impacto.
    skip() {
        if (!this.active) return false;
        this._finish();
        return true;
    }

    _restore() {
        const e = this.enemy;
        e.introPose = null;
        if (this.camera) this.camera.focus = null;
        for (const { p, expression } of this.players) { p.expression = expression; p.vx = p.vy = 0; }
        this.hud?.onBossTransformation(null);
    }

    _finish() {
        const e = this.enemy;
        this._restore();
        e.state = 'recover';
        e.stateTimer = this.cfg.attackDelaySteps;
        e.animTime = 0;
        e.vx = e.vy = e.pushVx = e.pushVy = 0;
        this._markSeen();
        this.enemy = null;
        this.onFinish?.(e);
    }
}
