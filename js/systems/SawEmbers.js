import { FORGE } from '../config/ForgeConfig.js';

// Melhoria Brasa: a serra em voo do tackle deixa brasas no chão a cada `spacing` px. Cada brasa vive `lifeSteps`;
// um inimigo que encosta leva `damage` uma vez por lançamento (todas as brasas do mesmo lançamento contam juntas).
// Não fere jogadores; o Arauto (lavaStone) é imune. As brasas ficam mesmo se a serra pousar ou reconectar.
export class SawEmbers {
    constructor({ getParams, getTackle, getRoom, onEnemyHit = null, particleSystem = null, cfg = FORGE.embers }) {
        Object.assign(this, { getParams, getTackle, getRoom, onEnemyHit, particleSystem, cfg });
        this.reset();
    }

    reset() {
        this.embers = [];
        this._hits = new Map();
        this._last = null;
        this._t = 0;
    }

    update() {
        this._t++;
        const params = this.getParams();
        const tackle = this.getTackle();
        if (params) this._spawn(params, tackle);
        else this._last = null;
        for (let i = this.embers.length - 1; i >= 0; i--) {
            const e = this.embers[i];
            if (--e.life <= 0) { this.embers.splice(i, 1); continue; }
            if ((this._t + e.phase) % this.cfg.flameEvery === 0) {
                this.particleSystem?.triggerFlameBurst?.(e.x, e.y, this.cfg.color, { amount: this.cfg.flameAmount, rise: 18, width: 14, sizeScale: 0.6 });
            }
        }
        if (params) this._burn(params);
        for (const id of this._hits.keys()) if (!this.embers.some(e => e.launch === id)) this._hits.delete(id);
    }

    _spawn(params, tackle) {
        const w = tackle?.chain?.weapon;
        const flying = tackle?.mode === 'tackle' && tackle.state === 'flight' && w;
        if (!flying) { this._last = null; return; }
        const id = tackle.launchId;
        const at = { x: w.dropX, y: w.dropY };
        if (this._last?.launch === id && Math.hypot(at.x - this._last.x, at.y - this._last.y) < params.spacing) return;
        this.embers.push({ x: at.x, y: at.y, life: params.lifeSteps, launch: id, phase: this.embers.length % this.cfg.flameEvery });
        this._last = { ...at, launch: id };
    }

    _burn(params) {
        for (const enemy of this.getRoom()?.enemies || []) {
            if (enemy.state === 'dying' || enemy.state === 'dead' || enemy.isHidden || enemy.airborne) continue;
            if (enemy.effectMaterial === 'lavaStone' || (enemy.hp ?? 1) <= 0) continue;
            const r = params.radius + (enemy.hitRadius ?? 16);
            const ember = this.embers.find(e => !this._hit(e.launch).has(enemy) && Math.hypot(enemy.x - e.x, enemy.y - e.y) < r);
            if (!ember) continue;
            this._hit(ember.launch).add(enemy);
            const dx = enemy.x - ember.x, dy = enemy.y - ember.y, d = Math.hypot(dx, dy) || 1;
            const impact = { x: ember.x, y: ember.y, dirX: dx / d, dirY: dy / d };
            const result = enemy.takeHit ? enemy.takeHit(params.damage, impact) : (enemy.startDying?.(), { killed: true });
            if (result) this.onEnemyHit?.(enemy, result, impact);
        }
    }

    _hit(launch) {
        let set = this._hits.get(launch);
        if (!set) this._hits.set(launch, set = new Set());
        return set;
    }
}
