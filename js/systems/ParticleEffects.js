import { Footprint } from '../particles/Footprint.js';
import { BLOOD_STEPS, MAX_FOOTPRINTS } from '../config/GameConfig.js';

export class ParticleEffects {

    constructor({ particleSystem, bloodCanvas, audio = null }) {
        this.particleSystem = particleSystem;
        this.bloodCanvas = bloodCanvas;
        this.audio = audio;
        this.footprints = [];

        this.stepBlocker = null;
    }

    clear() {
        this.footprints = [];
    }

    spawnRunSmoke(player) {
        const mag = Math.hypot(player.vx, player.vy) || 1;
        const dirX = player.vx / mag, dirY = player.vy / mag;
        const x = player.x - dirX * 12;
        const y = player.y + 15 - dirY * 12 * 0.4;
        this.particleSystem.triggerDust(x, y, dirX, dirY, 11);
    }

    spawnWalkDust(player) {
        if (player.walkDustCooldown === undefined) player.walkDustCooldown = 0;
        if (player.walkDustCooldown > 0) player.walkDustCooldown--;
        if (player.speedMag < player.speed * 0.25) return;
        if (player.walkDustCooldown > 0) return;
        const mag = Math.hypot(player.vx, player.vy) || 1;
        const dirX = player.vx / mag, dirY = player.vy / mag;
        const x = player.x - dirX * 11;
        const y = player.y + 15 - dirY * 11 * 0.4;
        this.particleSystem.triggerDust(x, y, dirX, dirY, 2);
        player.walkDustCooldown = player.speedMag > player.speed * 0.6 ? 7 : 12;
    }

    spawnBrakeDust(player) {

        const dirX = player.stopDirX, dirY = player.stopDirY;

        const x = player.x - dirX * 10;
        const y = player.y + 15 - dirY * 10 * 0.4;

        const strength = Math.min(1, player.stopSpeed / player.speed);

        const back = 7 + Math.round(strength * 9);
        this.particleSystem.triggerDust(x, y, -dirX, -dirY, back);

        if (strength > 0.4) {
            const perpX = -dirY, perpY = dirX;
            const side = 2 + Math.round(strength * 4);
            this.particleSystem.triggerDust(x, y + 1,  perpX,  perpY, side);
            this.particleSystem.triggerDust(x, y + 1, -perpX, -perpY, side);
        }
    }

    handleStep(player) {
        if (!player.justStepped) return;

        if (this.audio && (player.footstepSoundCooldown ?? 0) <= 0) {
            this.audio.play("playerStep");
            player.footstepSoundCooldown = player.speedMag > player.speed * 0.7 ? 7 : 10;
        }
        const x = player.stepX, y = player.stepY, ang = player.stepAngle;

        if (this.stepBlocker?.(x, y)) return;
        if (this.bloodCanvas.isBloodZone(x, y)) player.bloodStepsLeft = BLOOD_STEPS;
        if (player.bloodStepsLeft > 0) {
            const intensity = player.bloodStepsLeft / BLOOD_STEPS;
            this.bloodCanvas.stampFootprint(x, y, ang, intensity);
            player.bloodStepsLeft--;
        } else {
            this.footprints.push(new Footprint(x, y, ang));
            if (this.footprints.length > MAX_FOOTPRINTS) this.footprints.shift();
        }
    }

    processPlayer(player) {

        if (player.footstepSoundCooldown > 0) player.footstepSoundCooldown--;
        if (player.justStartedRunning) this.spawnRunSmoke(player);
        if (player.justStopped) this.spawnBrakeDust(player);
        this.spawnWalkDust(player);
        this.handleStep(player);
    }

    update() {
        for (let i = this.footprints.length - 1; i >= 0; i--) {
            this.footprints[i].update();
            if (this.footprints[i].done) this.footprints.splice(i, 1);
        }
    }

    draw(ctx) {
        this.footprints.forEach(f => f.draw(ctx));
    }
}
