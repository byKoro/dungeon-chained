// Melhoria Segunda chance (bigorna da botas): uma vez por sala para cada jogador, o golpe ou a queda que o deixaria
// com 0 corações o deixa com 1, invulnerável por `invulnSteps`. A carga volta ao entrar numa sala e no respawn da sala.
// O Game chama `save(p)` logo depois de tirar a vida (na queda) e `check(players)` antes da regra de morte.
export class LastStand {
    constructor({ getParams, getPlayers, onSave = null }) {
        Object.assign(this, { getParams, getPlayers, onSave });
        this.reset();
    }

    // Sala nova ou respawn da sala: as duas cargas voltam.
    reset() {
        this.used = [false, false];
    }

    save(p) {
        const params = this.getParams();
        if (!params || !p || p.lives > 0 || p.infiniteLives) return false;
        const i = (this.getPlayers() || []).indexOf(p);
        if (i < 0 || this.used[i]) return false;
        this.used[i] = true;
        p.lives = 1;
        p.invulnerableTimer = Math.max(p.invulnerableTimer ?? 0, params.invulnSteps);
        this.onSave?.(p, i);
        return true;
    }

    check(players = this.getPlayers()) {
        let saved = false;
        for (const p of players || []) if (p && !p.falling && p.lives <= 0) saved = this.save(p) || saved;
        return saved;
    }
}
