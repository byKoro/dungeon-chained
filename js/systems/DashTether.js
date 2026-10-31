import { PLAYER_DASH } from '../config/GameConfig.js';

// Modo clássico: dash sempre liberado. Mapa da demo: só depois do altar.
export function dashUnlocked(hasDemoMap, progressState) {
    return !hasDemoMap || !!progressState?.dash;
}

// Com a corrente conectada, quem dá dash não passa de `maxDistance` do parceiro:
// desliza ao longo do raio e perde a velocidade que aponta para fora, então o dash nunca arrebenta o cabo.
export class DashTether {
    constructor({ chain, maxDistance = PLAYER_DASH.connectedMaxDistance } = {}) {
        this.chain = chain;
        this.maxDistance = maxDistance;
        this._braked = new Set();
    }

    holdsStrain(p1, p2) {
        return this.chain.isConnected && (p1.dashing || p2.dashing);
    }

    apply(p1, p2) {
        for (const p of [p1, p2]) if (p.justDashed || !this.chain.isConnected) this._braked.delete(p);
        if (!this.chain.isConnected) return;
        const a = this._active(p1), b = this._active(p2);
        if (!a && !b) return;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy) || 1;
        const nx = dx / dist, ny = dy / dist;
        const over = dist > this.maxDistance;
        const pull = over ? (dist - this.maxDistance) * (a && b ? 0.5 : 1) : 0;
        if (a) this._hold(p1, -nx, -ny, pull, over);
        if (b) this._hold(p2, nx, ny, pull, over);
    }

    // (ox, oy) aponta para longe do parceiro. A saída de um dash que já foi freado também perde a parte para fora,
    // mesmo que a mola tenha encurtado a distância no meio tempo.
    _hold(p, ox, oy, pull, over) {
        if (over) {
            p.x -= ox * pull; p.y -= oy * pull;
            if (p.dashing) this._braked.add(p);
        }
        if (over || (p.justEndedDash && this._braked.has(p))) this._dropOutward(p, ox, oy);
        if (p.justEndedDash) this._braked.delete(p);
    }

    _active(p) {
        return p.dashing || p.justEndedDash;
    }

    _dropOutward(p, ox, oy) {
        const out = p.vx * ox + p.vy * oy;
        if (out > 0) {
            p.vx -= ox * out;
            p.vy -= oy * out;
        }
    }
}
