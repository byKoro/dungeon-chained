export const FLAME_GOLEM = {
    name: 'Arauto das Brasas',
    hp: 80,
    speed: 0.8,
    // 5x a arte (39 px): escala inteira mantém os pixels nítidos (156 = 4x, igual ao cenário).
    // Colisão e alcances continuam separados abaixo.
    drawHeight: 195,
    hitRadius: 36,
    // O contato desloca apenas o outro corpo; o chefe mantém seu movimento.
    immovable: true,
    bodyCollision: {
        torsoX: 48, torsoRadiusY: 30, torsoY: 32,
        armX: 48, armY: 24, armRadius: 16, armLift: 12, armSpread: 8
    },
    walkTicksPerFrame: 6,
    // Morte lenta, independente da aceleração da fase 2 (ticks por quadro da última linha da PNG).
    deathTicksPerFrame: 12,
    // Valor provisório de balanceamento: ticks de invulnerabilidade entre dois acertos da serra.
    hitCooldownSteps: 5,
    secondPhaseHp: 30,
    phases: [
        { movementSpeedMultiplier: 1, animationSpeedMultiplier: 1, dashSpeedMultiplier: 1, dashCount: 1 },
        { movementSpeedMultiplier: 1.35, animationSpeedMultiplier: 1.2, dashSpeedMultiplier: 1.2, dashCount: 2 }
    ],
    attacks: {
        attack: {
            triggerRange: 110, range: 70, knockback: 16,
            windupTicks: 40, recoverTicks: 36, ticksPerFrame: 5, hitFrame: 6
        },
        attack2: {
            raisedFrame: 4,
            triggerRange: 160, radius: 100, knockback: 48,
            windupTicks: 35, recoverTicks: 55, ticksPerFrame: 6, hitFrame: 6
        },
        attack3: {
            // A direção acompanha o alvo durante o aviso e fica fixa na investida.
            triggerRange: 480, speed: 12, durationTicks: 18, hitRadius: 50,
            knockback: 52,
            windupTicks: 40, recoverTicks: 60, ticksPerFrame: 5, launchFrame: 5,
            collisionProbePx: 8
        }
    },
    // Escolha de ataque pela situação (sem ciclo fixo). Detalhes em combat-and-entities.md → Arauto reativo.
    ai: {
        // 'single': cada decisão faz 1 investida ou 1 salto e depois reavalia.
        // 'sequence': fase 1 faz phases[0].dashCount investidas; fase 2 faz phases[1].dashCount investidas ou slam.count saltos.
        chainMode: 'single',
        // Fase 1: um jogador no alcance do melee por este tempo contínuo faz a próxima decisão ser a pancada.
        pressureSeconds: 2,
        // Perseguição: o caminho para o corpo termina a esta distância do alvo, sem parede no meio (px).
        chaseReachPx: 88
    },
    // Fase 2: o golpe de área (attack2) vira salto com slam, usado quando nenhuma investida é possível.
    slam: {
        // Distância máxima até o alvo para começar o salto (px).
        triggerRange: 480,
        // Saltos por decisão no modo 'sequence' (no 'single' é sempre 1).
        count: 3,
        // Pausa agachada antes de cada salto depois do primeiro (o primeiro usa o windup de attack2).
        prepTicks: 24,
        airTicks: 30,
        jumpHeight: 110,
        radius: 100,
        knockback: 56,
        // Pausa depois de cada impacto antes do próximo salto.
        betweenTicks: 20,
        // Recuperação depois do último impacto, antes da próxima habilidade.
        finalRecoverTicks: 100,
        // Alcance máximo da busca por piso seguro ao redor do ponto desejado (px).
        landingSearchPx: 192
    },
    telegraph: {
        // Marcas no chão só para teste: o aviso final é a própria animação do ataque (pose de espera).
        showMarks: true,
        // Fração do windup em que a animação avança até a pose de espera; depois ela fica parada nessa pose.
        rampRatio: 0.6,
        color: '#ffad57', secondaryColor: '#80534c', lineWidth: 3,
        markerRadius: 20, crossSize: 8, dashLine: [10, 8]
    },
    // Sombra oval nos pés (proporções da largura do corpo em px de mundo).
    shadow: { widthRatio: 0.62, heightRatio: 0.34, yOffset: -6, alpha: 0.6, jumpShrink: 0.35 },
    // Contorno escuro de 1 pixel de arte em volta da silhueta.
    outline: null,
    // Luz quente de brasa em volta do golem (raio em px de mundo).
    light: { radius: 190, windupBoost: 0.35, slamBoost: 0.6, pulse: 0.08, corpseStrength: 0.25 },
    // Brasas subindo dos ombros e da cabeça.
    embers: { perSecond: 7, windupMultiplier: 2.5, rise: 70, width: 70, amount: 2, color: [255, 150, 70] }
};

export const FLAME_GOLEM_SPRITE = {
    key: 'flameGolem', label: 'Arauto das Brasas', src: 'assets/enemies/flame_golem.png',
    cellSize: 100, cropX: 30, cropY: 20, cropW: 59, cropH: 39,
    body: { x: 36, y: 29, w: 32, h: 28 }, drawHeight: FLAME_GOLEM.drawHeight,
    combat: {
        effectMaterial: 'lavaStone',
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
