import { Footprint } from '../particles/Footprint.js';
import { BLOOD_STEPS, MAX_FOOTPRINTS } from '../config/GameConfig.js';

/**
 * ParticleEffects — efeitos "de pé" dos jogadores: poeira ao correr/andar e
 * pegadas (normais ou ensanguentadas).
 *
 * Antes `spawnRunSmoke`, `spawnWalkDust` e `handleStep` eram funções soltas no
 * main.js que liam campos do player e mexiam no pool global de pegadas. Aqui
 * ficam agrupadas e donas do próprio pool de pegadas.
 */
export class ParticleEffects {
    /**
     * @param {object} opts
     * @param {ParticleSystem} opts.particleSystem
     * @param {BloodCanvas} opts.bloodCanvas
     */
    constructor({ particleSystem, bloodCanvas, audio = null }) {
        this.particleSystem = particleSystem;
        this.bloodCanvas = bloodCanvas;
        this.audio = audio;
        this.footprints = [];
    }

    clear() {
        this.footprints = [];
    }

    // Fumaça do arranque (quando o jogador começa a correr).
    spawnRunSmoke(player) {
        const mag = Math.hypot(player.vx, player.vy) || 1;
        const dirX = player.vx / mag, dirY = player.vy / mag;
        const x = player.x - dirX * 12;
        const y = player.y + 15 - dirY * 12 * 0.4;
        this.particleSystem.triggerDust(x, y, dirX, dirY, 11);
    }

    // Poeirinha contínua ao caminhar (com cooldown por jogador).
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

    // Rajada de poeira ao frear bruscamente: sai contra o sentido do movimento
    // (os pés derrapando no chão). A quantidade acompanha a força da freada.
    spawnBrakeDust(player) {
        // Direção do movimento no instante da freada (capturada no Player).
        const dirX = player.stopDirX, dirY = player.stopDirY;
        // Origem aos pés, levemente atrás do jogador no sentido do movimento.
        const x = player.x - dirX * 10;
        const y = player.y + 15 - dirY * 10 * 0.4;
        // Intensidade proporcional à velocidade da freada (freada mais forte,
        // mais poeira). A poeira é lançada no sentido CONTRÁRIO ao movimento.
        const strength = Math.min(1, player.stopSpeed / player.speed);
        const amount = 6 + Math.round(strength * 10);
        this.particleSystem.triggerDust(x, y, -dirX, -dirY, amount);
    }

    // Carimba uma pegada quando o jogador dá um passo (sangue se pisou em sangue).
    handleStep(player) {
        if (!player.justStepped) return;
        // Som de passo com cooldown por jogador: corre -> toca mais rápido.
        if (this.audio && (player.footstepSoundCooldown ?? 0) <= 0) {
            this.audio.play("playerStep", { volume: 0.35, rate: 0.92 + Math.random() * 0.16 });
            player.footstepSoundCooldown = player.speedMag > player.speed * 0.7 ? 7 : 10;
        }
        const x = player.stepX, y = player.stepY, ang = player.stepAngle;
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

    // Processa todos os efeitos de pé de um jogador num frame.
    processPlayer(player) {
        // Cooldown do som de passo (decrementa por frame; usado em handleStep).
        if (player.footstepSoundCooldown > 0) player.footstepSoundCooldown--;
        if (player.justStartedRunning) this.spawnRunSmoke(player);
        if (player.justStopped) this.spawnBrakeDust(player);
        this.spawnWalkDust(player);
        this.handleStep(player);
    }

    // Atualiza e descarta pegadas expiradas.
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
