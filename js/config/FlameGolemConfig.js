export const FLAME_GOLEM = {
    name: 'Arauto das Brasas',
    hp: 100,
    speed: 0.8,
    // Dobro da escala anterior (123). Colisão e alcances continuam separados abaixo.
    drawHeight: 246,
    hitRadius: 24,
    shadowRadius: 26,
    walkTicksPerFrame: 6,
    // Morte lenta, independente da aceleração da fase 2 (ticks por quadro da última linha da PNG).
    deathTicksPerFrame: 12,
    // Valor provisório de balanceamento: ticks de invulnerabilidade entre dois acertos da serra.
    hitCooldownSteps: 10,
    secondPhaseHp: 50,
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
    // Fase 2: o slot do golpe de área (attack2) vira uma sequência de saltos com slam em direção aos jogadores.
    slam: {
        count: 3,
        // Pausa agachada antes de cada salto depois do primeiro (o primeiro usa o windup de attack2).
        prepTicks: 24,
        airTicks: 30,
        jumpHeight: 110,
        radius: 130,
        knockback: 56,
        // Pausa depois de cada impacto antes do próximo salto.
        betweenTicks: 16,
        // Recuperação depois do último impacto, antes da próxima habilidade.
        finalRecoverTicks: 110,
        // Alcance máximo da busca por piso seguro ao redor do ponto desejado (px).
        landingSearchPx: 192
    },
    telegraph: {
        color: '#ffad57', secondaryColor: '#80534c', lineWidth: 3,
        markerRadius: 20, crossSize: 8, dashLine: [10, 8]
    }
};

export const FLAME_GOLEM_SPRITE = {
    key: 'flameGolem', label: 'Arauto das Brasas', src: 'assets/enemies/flame_golem.png',
    cellSize: 100, cropX: 30, cropY: 20, cropW: 59, cropH: 39,
    body: { x: 36, y: 29, w: 32, h: 28 }, drawHeight: FLAME_GOLEM.drawHeight,
    combat: {
        hp: FLAME_GOLEM.hp, speed: FLAME_GOLEM.speed, playDeathAnimation: true,
        // Recebe dano sem stagger, empurrão ou hit stop local; morre só com a animação e deixa escombros.
        superArmor: true, hitCooldownSteps: FLAME_GOLEM.hitCooldownSteps, leavesCorpse: true,
        bossBar: { name: FLAME_GOLEM.name }
    },
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
