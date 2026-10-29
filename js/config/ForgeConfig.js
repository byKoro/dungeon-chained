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

// Sem `recipes` autorado, a bigorna oferece o catálogo padrão; uma lista vazia não oferece nada.
export function anvilRecipes(prop) {
    if (!Array.isArray(prop?.recipes)) return FORGE.defaultRecipes;
    return prop.recipes.filter(id => FORGE.recipes[id]);
}
