// Falas dos jogadores em balões. Tempos em segundos de simulação (param na pausa).
export const DIALOGUE = Object.freeze({
    enabled: true,
    charsPerSecond: 40,
    holdBase: 1.0,
    holdPerChar: 0.035,
    gapSeconds: 0.2,
    fadeIn: 0.18,
    fadeOut: 0.2,
    blipEveryChars: 2,
    blipRates: [0.92, 1.18],
    blipJitter: 0.05,
    defaultExpr: "desconfiado",
    headOffset: 46,
    interactKeys: ["e", "shiftright"]
});

// Roteiro da sala `inicial` (em teste): gatilhos das falas. Steps de 60 Hz, distâncias em tiles.
export const SCRIPT_LINES = Object.freeze({
    enabled: true,
    startDelaySteps: 45,
    anvilNearTiles: 2.5,
    bossGateTiles: 3
});
