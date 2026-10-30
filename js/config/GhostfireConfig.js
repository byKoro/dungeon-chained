const SPRITE_SCALE = 21;

export const GHOSTFIRE = Object.freeze({
    health: 12,
    hitCooldown: 45,
    appearFrames: 30,
    roarFrames: 33,
    summonFrames: 45,
    summonReleaseFrame: 18,
    waitFrames: 108,
    chargeFrames: 30,
    chargeTracking: 0.09,
    indicatorFrames: 33,
    beamFrames: 30,
    fadeFrames: 9,
    recoverFrames: 54,
    teleportFrames: 27,
    deathFrames: 48,
    beamWidth: 3 * SPRITE_SCALE,
    sideInset: 120,
    hitRadius: 5.5 * SPRITE_SCALE,
    summonCount: 5,
    maxMinions: 10,
    summon: {
        flightFrames: 36, distance: 220,
        spacing: 44, spawnRadius: 18, playerPadding: 24, recoverFrames: 24,
        formation: [[0, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]],
        radius: 30, pixel: 6, glowRadius: 100, lightRadius: 170,
        tailLength: 48, tailWidth: 24, pulseSpeed: 0.7,
        colors: ["#a52716", "#f46421", "#ffbd4a", "#fff1bd"],
        trailEvery: 1, trail: { amount: 4, rise: 22, width: 18, sizeScale: 0.7 },
        launch: { amount: 22, rise: 60, width: 60, sizeScale: 1.4 },
        impact: { amount: 65, rise: 100, width: 120, sizeScale: 1.5 },
        flashAmount: 12, flashPower: 1.4
    },
    summonTypes: ["hellbat", "demonessA", "demonessB"],
    color: "#ff702e",
    flameColor: [255, 100, 35],
    attackShake: 8,
    arrivalShake: 18,
    summonShake: 6,
    deathShake: 24,
    sprite: {
        scale: SPRITE_SCALE, cell: 100, anchorX: 52.5, beamAnchorX: 39.5, anchorY: 42,
        mouthOffset: 7.5, beamRow: 41, beamHeight: 3,
        beamHotStart: 66, beamHotEnd: 89, beamTail: 11, beamFlow: 140,
        warningRow: 28, warningHeight: 28, warningColumn: 99,
        idleTicks: 10, summonTicks: 8, deathTicks: 7,
        hoverAmplitude: 6, hoverSpeed: 0.027,
        arrivalOffset: 120, teleportStretch: 0.7,
        glowRadius: 145, glowColor: "255, 120, 50",
        glowCoreAlpha: 0.32, glowEdgeAlpha: 0.14, glowMidpoint: 0.5, glowCenterOffset: 3,
        warningBaseAlpha: 0.65, warningPulseAlpha: 0.35,
        beamGlowScale: 4.5, warningGlowScale: 1.4, beamGlowAlpha: 0.6
    },
    indicatorAlpha: 0.22,
    hitAlpha: 0.5,
    hitBlinkFrames: 4,
    name: "O Senhor das Chamas",
    // Barra do boss fixa no rodapé central da tela (coordenadas de tela). O visual
    // (moldura de pedra + células de brasa) segue a linguagem das barras do jogo;
    // aqui ficam só a margem inferior e a cor do nome.
    healthBar: {
        bottomMargin: 14, textColor: "#ffd9a8"
    },
    lightRadius: 260,
    beamLightRadius: 180,
    beamLightSpacing: 60,
    lightProfile: {
        color: "255, 148, 65", flickerBase: 1, flickerSine: 0.03, flickerNoise: 0,
        falloff: [{ offset: 0, alpha: 1 }, { offset: 0.4, alpha: 0.7 }, { offset: 1, alpha: 0 }]
    }
});
