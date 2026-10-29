import { TILE } from './GameConfig.js';

// Catálogo global da forja. Cada bigorna do Editor 2.0 escolhe quais receitas oferece (`prop.recipes`).
// `costs[n]` = preço do nível n+1; `item` = receita que precisa estar liberada antes.
export const FORGE = Object.freeze({
    openRadius: 1.7 * TILE,
    recipes: Object.freeze({
        saw: { kind: "item", costs: [10] },
        size: { kind: "upgrade", item: "saw", costs: [8, 14, 22], perLevel: 0.2 },
        elasticity: { kind: "upgrade", item: "saw", costs: [8, 14, 22], perLevel: 0.15 },
        doubleSaw: { kind: "upgrade", item: "saw", costs: [30], splitAt: 0.85, mergeAt: 0.7, splitSteps: 12 }
    }),
    defaultRecipes: Object.freeze(["saw", "size", "elasticity", "doubleSaw"])
});

export const FORGE_RECIPE_IDS = Object.freeze(Object.keys(FORGE.recipes));

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
    barRatio: 0.12,
    sawLift: 18,
    firstReconnectScale: 1.1,
    titleSeconds: 1.8
});

// Sem `recipes` autorado, a bigorna oferece o catálogo padrão; uma lista vazia não oferece nada.
export function anvilRecipes(prop) {
    if (!Array.isArray(prop?.recipes)) return FORGE.defaultRecipes;
    return prop.recipes.filter(id => FORGE.recipes[id]);
}
