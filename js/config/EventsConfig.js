import { TILE } from './GameConfig.js';

// Encontro das gaiolas (script do salão): cada corda vertical segura uma gaiola lá no alto.
// Distâncias em px de mundo, tempos em steps de 60 Hz.
export const CAGE = Object.freeze({
    width: 1.5 * TILE,
    art: 4,
    // Geometria dos sprites (pixels de arte): fundo do corpo da gaiola, estaca e nó.
    sprite: Object.freeze({
        w: 24, bodyBottom: 28, groundOffset: 20,
        stakeW: 10, stakeH: 16, knotY: 6.5, stakeFoot: 20,
        ropeThick: 10
    }),
    // Trecho de baixo da corda que o cabo alcança; corte quando o cabo passa a `cutRadius` dele.
    cutReach: 1.4 * TILE,
    cutRadius: 0.45 * TILE,
    nearRadius: 1.6 * TILE,
    // A corda sobe `ropeUp` e some no escuro do teto a partir de `ropeFade` (fração do comprimento).
    ropeUp: 6 * TILE,
    ropeFade: 0.45,
    swayAmp: 3,
    retractSpeed: 0.04,
    fallHeight: 6 * TILE,
    fallSteps: 34,
    fallSpin: 0.6,
    dropStagger: 6,
    landMin: 0.4 * TILE,
    landMax: 1.3 * TILE,
    debrisSteps: 240,
    brokenScrap: 2,
    cutShake: 5,
    snapShake: 8,
    impactShake: 12,
    landDust: 12,
    colors: Object.freeze({ rope: "#a8875a", glow: "rgba(255, 220, 140, 0.5)", shadow: "rgba(0, 0, 0, 0.4)" })
});

// Grades nos acessos da zona enquanto um encontro está ativo.
export const BARS = Object.freeze({
    dropSteps: 14,
    height: 1.25 * TILE,
    shake: 6,
    colors: Object.freeze({ bar: "#4a4452", light: "#8d8698", dark: "#1f1b26", beam: "#2b2735" })
});

// Mapas com bigorna: perder todas as vidas faz a dupla renascer no início, sem game over.
export const RUN_DEATH = Object.freeze({
    invulnSteps: 120,
    fadeSeconds: 0.9
});
