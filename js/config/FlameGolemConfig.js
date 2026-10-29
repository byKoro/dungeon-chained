export const FLAME_GOLEM = {
    hp: 6,
    speed: 0.8,
    drawHeight: 123,
    hitRadius: 24,
    walkTicksPerFrame: 6,
    deathTicksPerFrame: 7,
    secondPhaseHp: 3,
    phases: [
        { movementSpeedMultiplier: 1, animationSpeedMultiplier: 1, dashSpeedMultiplier: 1, dashCount: 1 },
        { movementSpeedMultiplier: 1.35, animationSpeedMultiplier: 1.35, dashSpeedMultiplier: 1.6, dashCount: 2 }
    ],
    attacks: {
        attack: {
            triggerRange: 64, range: 72, knockback: 16,
            windupTicks: 40, recoverTicks: 36, ticksPerFrame: 5, hitFrame: 6
        },
        attack2: {
            triggerRange: 160, radius: 150, knockback: 48,
            windupTicks: 50, recoverTicks: 55, ticksPerFrame: 6, hitFrame: 6
        },
        attack3: {
            triggerRange: 480, speed: 12, durationTicks: 18, hitRadius: 30,
            // 0 fixa a direcao marcada; 1 aponta para o alvo a cada tick.
            knockback: 52, trackingStrength: 0.025,
            windupTicks: 40, recoverTicks: 60, ticksPerFrame: 5, launchFrame: 5,
            collisionProbePx: 8
        }
    },
    telegraph: {
        color: '#ffad57', secondaryColor: '#80534c', lineWidth: 3,
        markerRadius: 20, crossSize: 8, dashLine: [10, 8]
    }
};

export const FLAME_GOLEM_SPRITE = {
    key: 'flameGolem', label: 'Golem de Chamas', src: 'assets/enemies/flame_golem.png',
    cellSize: 100, cropX: 30, cropY: 20, cropW: 59, cropH: 39,
    body: { x: 36, y: 29, w: 32, h: 28 }, drawHeight: FLAME_GOLEM.drawHeight,
    combat: { hp: FLAME_GOLEM.hp, speed: FLAME_GOLEM.speed, playDeathAnimation: true },
    rows: {
        walk: { row: 1, frames: 12, fps: FLAME_GOLEM.walkTicksPerFrame },
        attack: { row: 2, frames: 9, fps: FLAME_GOLEM.attacks.attack.ticksPerFrame, hitFrame: FLAME_GOLEM.attacks.attack.hitFrame },
        attack2: { row: 3, frames: 9, fps: FLAME_GOLEM.attacks.attack2.ticksPerFrame, hitFrame: FLAME_GOLEM.attacks.attack2.hitFrame },
        attack3: { row: 4, frames: 9, fps: FLAME_GOLEM.attacks.attack3.ticksPerFrame },
        death: { row: 5, frames: 6, fps: FLAME_GOLEM.deathTicksPerFrame }
    },
    deathFlash: { row: 0, frame: 0 },
    gib: { gridCols: 5, gridRows: 4, box: { x: 36, y: 41, w: 37, h: 18 } }
};
