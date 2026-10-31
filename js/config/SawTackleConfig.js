// Tackle da serra solta (spec .agents/backlog/tackle-serra.md). Distâncias em px de mundo, velocidades em px/step
// e tempos em steps de 60 Hz, salvo quando o nome termina em `Seconds`. Valores provisórios para playtest.
export const SAW_TACKLE = Object.freeze({
    // Contato do dash com a serra: raio do disco × `contactScale` + raio do jogador.
    contactScale: 0.55,

    // Impacto: hit stop local (só o jogador do tackle e a serra), depois a reação curta para trás.
    hitStopSeconds: 0.06,
    reactionSteps: 14,
    recoilSpeed: 4.5,
    // Proteção curta: cobre só o hit stop e a reação (sem dash extra; o cooldown do dash é o normal).
    invulnSteps: 18,
    impactScale: 0.74,
    impactShake: 5,
    impactSparks: 10,

    // Mira assistida: uma correção por lançamento, só para inimigos à frente e sem parede no meio.
    aimConeDeg: 30,
    aimRange: 420,
    aimMaxTurnDeg: 20,

    // Voo do tackle: velocidade constante (sem atrito); quica como sinuca e volta para a origem.
    speed: 15,
    sweepStep: 8,
    // Contato com inimigos: raio do disco × `enemyContactScale` + raio do inimigo (ou elipses do corpo sólido).
    enemyContactScale: 0.6,
    // Paredes e limites: raio do disco × `wallContactScale`.
    wallContactScale: 0.5,
    spin: 2.6,
    returnStartSteps: 40,
    returnTurnRate: 0.09,
    returnRampSteps: 30,
    // Depois de bater numa parede durante a volta, solta o volante um pouco para não insistir na mesma parede.
    steerPauseSteps: 8,
    arriveRadius: 56,
    minFlightSteps: 12,
    maxFlightSteps: 240,

    flightMode: 'return',
    coastDistance: 600,
    coastFriction: 0.975,
    coastMinSpeed: 1,
    landingSpeed: 4,
    landingRepathSteps: 15,
    // Em voo, andar menos que `stallMinMove` px por `stallSteps` passos seguidos = presa: pousa.
    stallMinMove: 1,
    stallSteps: 8,
    // Sem rota para pousar depois destas tentativas: cai direto no piso seguro mais próximo.
    landingMaxRetries: 4,
    // Serra já dentro de parede ou do corpo do Arauto: procura o ponto livre mais próximo em anéis de
    // `unstickStep` px, até o raio do disco × `unstickMaxScale`, antes de mover.
    unstickStep: 4,
    unstickMaxScale: 3,

    // Presa no inimigo.
    hits: 5,
    hitIntervalSeconds: 0.1,
    damagePerHit: 1,
    // Sem acerto aceito por este tempo (alvo invulnerável ou inválido): solta e segue o voo.
    stuckMaxWaitSeconds: 0.6,
    stuckSparks: 2,

    // Arauto: depois dos hits, 'return' volta direto para a origem (padrão); 'drop' cai junto ao contato.
    arautoAfterHits: 'return',

    // Golpes, investida e aterrissagem do Arauto lançam a serra solta.
    // Sem volta à origem: perde velocidade com atrito e quiques e cai onde parar (piso seguro).
    bossLaunchSpeed: 13,
    bossRestitution: 0.85,
    bossFriction: 0.975,
    bossMinSpeed: 1,
    bossMaxFlightSteps: 150,

    // Rastro de vento atrás da serra em voo.
    trailLength: 9,
    trailColor: 'rgba(235, 242, 255, 0.55)',
    trailWidth: 0.7,

    // Dash que encosta na serra presa: não faz tackle; só um aviso curto de que ela está ocupada.
    lockedSparks: 3,
    sound: Object.freeze({
        tackle: Object.freeze({ cue: 'sawLand', rate: 1.25, volume: 0.9 }),
        bounce: Object.freeze({ cue: 'sawLand', rate: 1.9, volume: 0.3 }),
        land: Object.freeze({ cue: 'sawLand', rate: 1, volume: 0.6 }),
        locked: Object.freeze({ cue: 'sawLand', rate: 2.2, volume: 0.2 })
    })
});
