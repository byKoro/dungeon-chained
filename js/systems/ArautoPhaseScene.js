import { CinematicBars } from '../ui/CinematicBars.js';
import { ARAUTO_FX } from '../config/ArautoEffectsConfig.js';
import { FLAME_GOLEM } from '../config/FlameGolemConfig.js';

export class ArautoPhaseScene {
    constructor({ renderer, hud, particleSystem, getPlayers }) {
        Object.assign(this, { renderer, hud, particleSystem, getPlayers });
        this.bars = new CinematicBars();
        this.reset();
    }

    reset() {
        if (this.enemy) {
            this.renderer.camX = this.camera.x;
            this.renderer.camY = this.camera.y;
            this.renderer.zoom = this.camera.zoom;
            this.enemy.lavaReveal = this.enemy.phase === 2 ? 1 : 0;
            this.hud.onBossTransformation(null);
        }
        this.enemy = null;
        this.elapsed = 0;
        this.bars.reset();
    }

    get active() { return !!this.enemy; }

    tryStart(enemies) {
        if (this.active) return true;
        for (const enemy of enemies) {
            if (enemy.effectMaterial !== 'lavaStone') continue;
            enemy.phaseTransitionControlled = true;
            if (enemy.phase !== 1 || enemy.hp <= 0 || enemy.hp > FLAME_GOLEM.secondPhaseHp
                || !['chase', 'recover'].includes(enemy.state) || enemy.airborne) continue;
            this.enemy = enemy;
            this.elapsed = 0;
            this.burst = false;
            this.angry = false;
            this.camera = { x: this.renderer.camX, y: this.renderer.camY, zoom: this.renderer.zoom };
            this.bars.show();
            this.hud.onBossTransformation('assustado');
            for (const p of this.getPlayers()) p.latchDashKey?.();
            return true;
        }
        return false;
    }

    update(dt) {
        if (!this.active) return;
        const cfg = ARAUTO_FX.scene, enemy = this.enemy;
        this.elapsed += dt;
        const t = this.elapsed;
        enemy.lavaReveal = Math.min(1, t / cfg.burstAt);
        if (!this.burst && t >= cfg.burstAt) {
            this.burst = true;
            enemy._updatePhase();
            this.renderer.triggerShake(cfg.burstShake);
            this.particleSystem.triggerLavaDebris(enemy.x, enemy.y, cfg.burstPieces, { groundY: enemy.footY });
            this.particleSystem.triggerFlameBurst(enemy.x, enemy.y, [255, 150, 70],
                { amount: cfg.burstEmbers, rise: enemy.drawHeight, width: enemy.drawHeight });
        }
        if (!this.angry && t >= cfg.angerAt) {
            this.angry = true;
            this.hud.onBossTransformation('raiva');
        }
        const returning = t >= cfg.returnAt;
        if (returning) this.bars.hide();
        this.bars.update(dt);
        const k = returning ? Math.max(0, (cfg.duration - t) / (cfg.duration - cfg.returnAt))
            : Math.min(1, t / cfg.burstAt);
        const eased = k * k * (3 - 2 * k);
        // The endpoint is exact before gameplay can advance again.
        this.renderer.camX = this.camera.x + (enemy.x - this.camera.x) * eased;
        this.renderer.camY = this.camera.y + (enemy.y - this.camera.y) * eased;
        this.renderer.zoom = this.camera.zoom * (1 + (cfg.zoom - 1) * eased);
        if (t >= cfg.duration) {
            this.renderer.camX = this.camera.x; this.renderer.camY = this.camera.y; this.renderer.zoom = this.camera.zoom;
            for (const p of this.getPlayers()) p.latchDashKey?.();
            this.hud.onBossTransformation(null);
            this.enemy = null;
            this.bars.reset();
        }
    }

    draw(ctx, width, height) { this.bars.draw(ctx, width, height); }
}
