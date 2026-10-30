import { TILE } from './GameConfig.js';

// Catálogo global da forja. Cada bigorna do Editor 2.0 escolhe quais receitas oferece (`prop.recipes`).
// `costs[n]` = preço do nível n+1; `item` = receita que precisa estar liberada antes.
export const FORGE = Object.freeze({
    openRadius: 1.7 * TILE,
    recipes: Object.freeze({
        saw: { kind: "item", costs: [10] },
        size: { kind: "upgrade", item: "saw", costs: [8, 14, 22], perLevel: 0.2 },
        elasticity: { kind: "upgrade", item: "saw", costs: [8, 14, 22], perLevel: 0.15 },
        doubleSaw: { kind: "upgrade", item: "saw", costs: [30], splitAt: 0.85, mergeAt: 0.7, splitSteps: 12 },
        // Por nível (índice 0 = sem a melhoria): distância de arrasto em tiles e velocidade de quem arrasta.
        weight: { kind: "upgrade", item: "saw", costs: [10, 18], dragTiles: [2, 3, 4], dragSpeed: [0.4, 0.55, 0.7] }
    }),
    defaultRecipes: Object.freeze(["saw", "size", "elasticity", "weight", "doubleSaw"]),
    denySteps: 12,
    denyRate: 0.6,
    // Faixa de brilho na bigorna, no mesmo ritmo do baú fechado (CHEST.shineSpeed).
    shineSpeed: 0.03,
    splitFeedback: Object.freeze({ shake: 3, sparks: 6, power: 0.8, splitRate: 1.35, mergeRate: 1.15 })
});

export const FORGE_RECIPE_IDS = Object.freeze(Object.keys(FORGE.recipes));

// Arrastar a serra largada: um jogador segura interagir perto dela e a puxa por um cabo curto.
// Distâncias em px de mundo, tempos em steps de 60 Hz.
export const SAW_DRAG = Object.freeze({
    grabRadius: 70,
    grabSteps: 14,
    ropeLength: 46,
    ropeSlack: 40,
    regrabSteps: 30,
    snapShake: 4,
    snapSparks: 6,
    ropeColor: "#2a2230",
    ropeLight: "#6e6684",
    ropeWidth: 4,
    ropeSag: 10
});

// Cinemática de craft da Serra (~4 s, segundos de simulação).
export const SAW_CINEMATIC = Object.freeze({
    letterboxIn: 0.45,
    hits: Object.freeze([0.7, 1.25, 1.8]),
    hitShake: Object.freeze([3, 5, 8]),
    hitSparks: Object.freeze([10, 14, 20]),
    jumpStart: 2.05,
    jumpEnd: 2.85,
    jumpHeight: 120,
    jumpSpins: 3,
    squashTime: 0.3,
    squashAmount: 0.32,
    glowTime: 0.6,
    outStart: 3.35,
    end: 3.8,
    zoom: 1.7,
    focusOffsetY: -16,
    barRatio: 0.12,
    landShake: 5,
    landFlash: 14,
    sawLift: 18,
    firstReconnectScale: 1.1,
    firstReconnectShake: 9
});

// Sem `recipes` autorado, a bigorna oferece o catálogo padrão; uma lista vazia não oferece nada.
export function anvilRecipes(prop) {
    if (!Array.isArray(prop?.recipes)) return FORGE.defaultRecipes;
    return prop.recipes.filter(id => FORGE.recipes[id]);
}
