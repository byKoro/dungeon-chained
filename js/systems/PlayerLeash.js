import { PLAYER_LEASH } from '../config/DemoConfig.js';
import { HOLE_FALL } from '../config/GameConfig.js';

// Limita a distância entre os jogadores ao enquadramento da câmera, eixo por eixo. Na faixa elástica só a velocidade
// de quem se afasta é freada; no limite duro quem se afastou neste step volta, e ninguém é puxado pelo outro.
export class PlayerLeash {
    constructor({ getPlayers, getView, isActive = () => true, particleSystem = null, cfg = PLAYER_LEASH }) {
        Object.assign(this, { getPlayers, getView, isActive, particleSystem, cfg });
        this.reset();
    }

    reset() {
        this._prev = null;
        this._dustCd = [0, 0];
    }

    // Limites { soft: {x, y}, hard: {x, y} } da distância em cada eixo, a partir da área visível em px de mundo.
    limits() {
        const { w, h } = this.getView();
        const { softMargin, hardMargin } = this.cfg;
        const hard = { x: Math.max(0, w - hardMargin * 2), y: Math.max(0, h - hardMargin * 2) };
        return { soft: { x: Math.min(hard.x, Math.max(0, w - softMargin * 2)), y: Math.min(hard.y, Math.max(0, h - softMargin * 2)) }, hard };
    }

    update() {
        const players = this.getPlayers();
        const [p1, p2] = players;
        this._dustCd = this._dustCd.map(c => Math.max(0, c - 1));
        const prev = this._prev;
        this._prev = players.map(p => ({ x: p.x, y: p.y }));
        if (!this.cfg.enabled || !this.isActive() || !prev || players.some(p => p.falling || p.lives <= 0)) return;
        if (players.some((p, i) => Math.hypot(p.x - prev[i].x, p.y - prev[i].y) > this.cfg.teleportStep)) return;

        const { soft, hard } = this.limits();
        for (const [a, va] of [["x", "vx"], ["y", "vy"]]) {
            const d = p2[a] - p1[a];
            const dist = Math.abs(d);
            if (dist <= soft[a]) continue;
            const s = Math.sign(d);
            // Sentido de afastar: p1 para -s, p2 para +s.
            const away = [-s, s];
            const span = hard[a] - soft[a];
            const t = span > 0 ? Math.min(1, (dist - soft[a]) / span) : 1;
            players.forEach((p, i) => {
                const out = p[va] * away[i];
                if (out > 0) p[va] -= away[i] * out * this.cfg.resistance * t;
            });

            const excess = dist - hard[a];
            if (excess <= 0) continue;
            const moved = players.map((p, i) => Math.max(0, (p[a] - prev[i][a]) * away[i]));
            const total = moved[0] + moved[1];
            // Quem se afastou neste step volta; se ninguém andou (empurrado por algo), divide ao meio.
            const share = total > 0 ? moved.map(m => m / total) : [0.5, 0.5];
            players.forEach((p, i) => {
                const back = Math.min(excess * share[i], total > 0 ? moved[i] : excess);
                if (back <= 0) return;
                p[a] -= away[i] * back;
                const out = p[va] * away[i];
                if (out > 0) {
                    if (out >= this.cfg.dust.minSpeed) this._dust(p, i, away[i], a);
                    p[va] -= away[i] * out;
                }
                this._prev[i][a] = p[a];
            });
        }
    }

    _dust(p, i, dir, axis) {
        if (this._dustCd[i] > 0) return;
        const d = this.cfg.dust;
        this._dustCd[i] = d.cooldownSteps;
        const dx = axis === "x" ? -dir : 0, dy = axis === "y" ? -dir : 0;
        this.particleSystem?.triggerDust?.(p.x, p.y + HOLE_FALL.footOffset, dx, dy, d.count);
    }
}
