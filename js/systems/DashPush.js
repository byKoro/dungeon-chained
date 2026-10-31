import { PLAYER_UPGRADES } from '../config/ForgeConfig.js';

// Melhoria "Impacto" (bigorna da sala "botas"): enquanto um jogador está em dash, arremessa os inimigos que
// encosta (amortecimento `launchDamp` enquanto voam; juice no DashPushFeedback) — sem dano. Cada inimigo é empurrado uma vez por dash. Usa o `pushVx/pushVy` do inimigo
// (que já respeita buracos, bordas e paredes), então nenhum inimigo é jogado para dentro de um buraco.
export class DashPush {
    constructor({ getPlayers, getRoom, cfg = PLAYER_UPGRADES.dashPush, particleSystem = null, feedback = null }) {
        Object.assign(this, { getPlayers, getRoom, cfg, particleSystem, feedback });
        this._pushed = new WeakMap(); // player -> Set de inimigos já empurrados neste dash
    }

    reset() {
        this._pushed = new WeakMap();
        this.feedback?.reset();
    }

    update() {
        this.justPushed = false;
        const room = this.getRoom?.();
        const enemies = room?.enemies;
        if (!enemies?.length) return;
        for (const p of this.getPlayers() || []) {
            if (!p) continue;
            // Novo dash: zera a lista de quem já foi empurrado.
            if (p.justDashed) this._pushed.set(p, new Set());
            if (!p.dashing || !(p.dashPushImpulse > 0)) continue;
            let seen = this._pushed.get(p);
            if (!seen) { seen = new Set(); this._pushed.set(p, seen); }
            const reach = (p.hitRadius ?? 16) + (this.cfg.radiusPad ?? 10);
            for (const e of enemies) {
                if (seen.has(e) || !this._pushable(e)) continue;
                const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy);
                if (d > reach + (e.hitRadius ?? 16)) continue;
                // Arremessa na direção do dash, puxada um pouco para o lado do contato. Só o radial falha quando o
                // dash rápido já passou do centro do inimigo (jogaria o inimigo para trás).
                const rx = d > 1e-4 ? dx / d : 0, ry = d > 1e-4 ? dy / d : 0;
                let nx = (p.dashDirX ?? 1) + rx * this.cfg.contactBias, ny = (p.dashDirY ?? 0) + ry * this.cfg.contactBias;
                const n = Math.hypot(nx, ny) || 1;
                nx /= n; ny /= n;
                e.pushVx = nx * p.dashPushImpulse;
                e.pushVy = ny * p.dashPushImpulse;
                e.pushDamp = this.cfg.launchDamp;
                e.launchStagger?.(this.cfg.launchStaggerSteps);
                seen.add(e);
                this.justPushed = true;
                if (this.feedback) this.feedback.launch(e, p, nx, ny);
                else this.particleSystem?.triggerDust?.(e.x, e.y, nx, ny * 0.5, 2);
            }
        }
    }

    _pushable(e) {
        return !!e && e.state !== 'dying' && e.state !== 'dead' && !e.frozen && !e.airborne
            // Corpos imóveis (ex.: Arauto) não são empurrados.
            && !e.immovable;
    }
}
