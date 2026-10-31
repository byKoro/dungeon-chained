import { PLAYER_UPGRADES } from '../config/ForgeConfig.js';

// Melhoria "Vínculo" (bigorna da sala "botas"): com os dois jogadores perto um do outro por um tempo
// contínuo, cada um recupera 1 vida. Depois, um cooldown antes de curar de novo. O contador reinicia se
// eles se afastam ou se qualquer um toma dano. Sem a melhoria (params null) o sistema fica inerte.
export class CoopHeal {
    constructor({ getPlayers, particleSystem = null, audio = null, onHeal = null, cfg = PLAYER_UPGRADES.coopHeal }) {
        Object.assign(this, { getPlayers, particleSystem, audio, onHeal, cfg });
        this.params = null;
        this.reset();
    }

    reset() {
        this.hold = 0;
        this.cooldown = 0;
        // Flags de um step para o CoopHealFeedback: quem curou e por que o carregamento caiu ('hurt' | 'apart').
        this.healed = [];
        this.broke = null;
        const players = this.getPlayers?.() || [];
        this._damageSeen = [players[0]?.damageTaken ?? 0, players[1]?.damageTaken ?? 0];
    }

    // null = melhoria não comprada; { holdSteps, cooldownSteps } no nível atual.
    setParams(params) {
        this.params = params;
        if (!params) this.reset();
    }

    get charging() {
        return !!this.params && this.cooldown === 0 && this.hold > 0;
    }

    get progress() {
        return this.params && this.cooldown === 0 ? Math.min(1, this.hold / this.params.holdSteps) : 0;
    }

    update() {
        this.healed = [];
        this.broke = null;
        if (!this.params) return;
        const players = this.getPlayers() || [];
        const [p1, p2] = players;
        if (!p1 || !p2) { this.hold = 0; return; }

        // Alguém tomou dano desde o último step: reinicia o contador (o `damageTaken` do Player só sobe).
        let hurt = false;
        for (let i = 0; i < 2; i++) {
            const d = players[i]?.damageTaken ?? 0;
            if (d > (this._damageSeen[i] ?? 0)) hurt = true;
            this._damageSeen[i] = d;
        }
        if (hurt) { this._break('hurt'); return; }

        if (this.cooldown > 0) { this.cooldown--; this.hold = 0; return; }

        const alive = p1.lives > 0 && p2.lives > 0 && !p1.falling && !p2.falling;
        const near = Math.hypot(p1.x - p2.x, p1.y - p2.y) <= this.cfg.radius;
        if (!alive || !near) { this._break('apart'); return; }

        this.hold++;
        if (this.hold < this.params.holdSteps) return;

        // Cura 1 vida de cada um que estiver faltando; só entra em cooldown se curou alguém.
        this.hold = 0;
        let healed = false;
        for (const p of [p1, p2]) {
            if (p.lives < (p.maxLives ?? p.lives)) { p.lives += 1; healed = true; this.healed.push(p); }
        }
        if (!healed) return;
        this.cooldown = this.params.cooldownSteps;
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        this.particleSystem?.triggerFlash?.(mx, my, this.cfg.flashLife ?? 10, 0.8);
        this.audio?.play?.("pickup", { rateMultiplier: 1.1 });
        this.onHeal?.(mx, my);
    }

    _break(reason) {
        if (this.hold > 0) this.broke = reason;
        this.hold = 0;
    }
}
