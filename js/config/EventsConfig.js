import { TILE } from './GameConfig.js';

// Encontro da gaiola com cordas (script do salão). Distâncias em px de mundo, tempos em steps de 60 Hz.
export const CAGE = Object.freeze({
    // Altura do fundo da gaiola acima do tile dela.
    hang: 0.8 * TILE,
    width: 1.5 * TILE,
    height: 1.6 * TILE,
    art: 4,
    // Geometria dos sprites (pixels de arte): gancho, fundo do corpo, amarras das cordas, nó da estaca.
    sprite: Object.freeze({
        w: 24, hookY: 1.5, bodyBottom: 28, floorOffset: 16,
        ropeLeftX: 3.5, ropeRightX: 20.5, ropeY: 25.5,
        stakeW: 10, stakeH: 16, knotX: 8.5, knotY: 7.5, stakeFoot: 20,
        ropeThick: 12, ropeSag: 14
    }),
    cutRadius: 1.5 * TILE,
    nearRadius: 2.5 * TILE,
    dropSteps: 30,
    dropStagger: 8,
    landMin: 0.9 * TILE,
    landMax: 2 * TILE,
    tiltPerCut: 0.09,
    fallSteps: 22,
    debrisSteps: 240,
    brokenScrap: 2,
    cutShake: 5,
    snapShake: 8,
    impactShake: 12,
    landShake: 4,
    landDust: 8,
    flashSteps: 14,
    colors: Object.freeze({
        bar: "#3d3742", barLight: "#77707f", frame: "#2a2430", rope: "#a8875a", ropeDark: "#5c4630",
        stake: "#5a4632", glow: "rgba(255, 220, 140, 0.5)", shadow: "rgba(0, 0, 0, 0.35)"
    })
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
