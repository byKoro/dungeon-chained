import { ARAUTO_AUDIO } from '../config/ArautoAudioConfig.js';

export function stoneGrindTargets(spin, { contact = false, active = true, connected = true, timeScale = 1 } = {}) {
    const cfg = ARAUTO_AUDIO.grind;
    const s = Math.max(0, Math.min(1, spin || 0));
    const slowmo = 1 - ARAUTO_AUDIO.slowmoDepth * (1 - Math.max(0, Math.min(1, timeScale)));
    return {
        level: active && connected && contact && s >= cfg.minimumSpin ? Math.pow(s, cfg.power) : 0,
        rate: (cfg.rateMin + (cfg.rateMax - cfg.rateMin) * s) * slowmo,
        cutoff: cfg.cutoffMin + (cfg.cutoffMax - cfg.cutoffMin) * s
    };
}

export class ArautoAudio {
    constructor({ audio }) {
        this.audio = audio;
        this.charging = new Set();
        this.grindVoice = null;
        this.dashVoice = null;
    }

    reset() {
        this.grindVoice?.stop(0);
        this.dashVoice?.stop(0);
        this.grindVoice = this.dashVoice = null;
        this.charging.clear();
    }

    groundHit(slam = false) {
        this.audio?.play(slam ? 'arautoSlam' : 'arautoGround');
        const { db, ...envelope } = slam ? ARAUTO_AUDIO.slamDuck : ARAUTO_AUDIO.groundDuck;
        this.audio?.duck(db, envelope);
    }

    _solid(enemy) {
        return enemy.effectMaterial === 'lavaStone' && !enemy.isHidden && !enemy.frozen
            && !enemy.airborne && enemy.state !== 'dying' && enemy.state !== 'dead';
    }

    _discContact(weapon, players, enemies) {
        if (weapon.dropped || !players?.[0] || !players[1]) return false;
        const discs = weapon.getSawPositions?.(players[0], players[1]) ?? [];
        const radius = weapon.discRadius;
        if (!discs.length || !(radius > 0)) return false;
        const tolerance = ARAUTO_AUDIO.contactTolerance;
        return discs.some(disc => enemies.some(enemy => this._solid(enemy) && enemy.collisionBodies?.some(body => Math.hypot(
            (disc.x - enemy.x - body.x) / (body.radiusX + radius + tolerance),
            (disc.y - enemy.y - body.y) / (body.radiusY + radius + tolerance)) <= 1)));
    }

    update(weapon, enemies, { active = true, connected = true, players = [], timeScale = 1 } = {}) {
        if (!weapon) return;
        const cfg = ARAUTO_AUDIO;
        const contact = active && connected && this._discContact(weapon, players, enemies);
        const grind = stoneGrindTargets(weapon.spinSpeed, { contact, active, connected, timeScale });
        if (grind.level > 0 && !this.grindVoice) this.grindVoice = this.audio?.createLoopVoice('arautoSawStone');
        this.grindVoice?.set(grind, !active ? cfg.inactiveTau : grind.level > 0 ? cfg.attackTau : cfg.releaseTau);

        const charging = enemies.filter(enemy => this._solid(enemy) && enemy.charging
            && Math.hypot(enemy.vx ?? 0, enemy.vy ?? 0) > cfg.dash.minimumSpeed);
        if (active) for (const enemy of charging) {
            if (!this.charging.has(enemy)) this.audio?.play('arautoDashStart');
        }
        this.charging = new Set(charging);
        const speed = Math.max(1, ...charging.map(enemy => enemy.phaseConfig?.dashSpeedMultiplier ?? 1));
        const level = active && charging.length ? cfg.dash.level : 0;
        if (level > 0 && !this.dashVoice) this.dashVoice = this.audio?.createLoopVoice('arautoDashLoop');
        this.dashVoice?.set({ level, rate: cfg.dash.rate + (speed - 1) * cfg.dash.phaseRate,
            cutoff: cfg.dash.cutoff }, !active ? cfg.inactiveTau : level > 0 ? cfg.attackTau : cfg.releaseTau);
    }
}
