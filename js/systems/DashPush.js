import { PLAYER_UPGRADES } from '../config/ForgeConfig.js';

// Melhoria "Impacto" (bigorna da sala "botas"): enquanto um jogador está em dash, empurra os inimigos que
// encosta para longe — sem dano. Cada inimigo é empurrado uma vez por dash. Usa o `pushVx/pushVy` do inimigo
// (que já respeita buracos, bordas e paredes), então nenhum inimigo é jogado para dentro de um buraco.
export class DashPush {
    constructor({ getPlayers, getRoom, cfg = PLAYER_UPGRADES.dashPush, particleSystem = null }) {
        Object.assign(this, { getPlayers, getRoom, cfg, particleSystem });
        this._pushed = new WeakMap(); // player -> Set de inimigos já empurrados neste dash
    }

    reset() {
        this._pushed = new WeakMap();
    }

    update() {
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
                const nx = d > 1e-4 ? dx / d : (p.dashDirX ?? 1);
                const ny = d > 1e-4 ? dy / d : (p.dashDirY ?? 0);
                e.pushVx = nx * p.dashPushImpulse;
                e.pushVy = ny * p.dashPushImpulse;
                seen.add(e);
                this.particleSystem?.triggerDust?.(e.x, e.y, nx, ny * 0.5, 2);
            }
        }
    }

    _pushable(e) {
        return !!e && e.state !== 'dying' && e.state !== 'dead' && !e.frozen && !e.airborne
            // Corpos imóveis (ex.: Arauto) não são empurrados.
            && !e.immovable;
    }
}
