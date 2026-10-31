import { TILE } from './GameConfig.js';

// Catálogo global da forja. Cada bigorna do Editor 2.0 escolhe quais receitas oferece (`prop.recipes`).
// `costs[n]` = preço do nível n+1; `item` = receita que precisa estar liberada antes.
export const FORGE = Object.freeze({
    openRadius: 1.7 * TILE,
    recipes: Object.freeze({
        saw: { kind: "item", costs: [10] },
        size: { kind: "upgrade", item: "saw", costs: [15, 30, 50], perLevel: 0.12 },
        // Solta (cabo arrebentado ou queda), a serra segue girando e cortando inimigos por `seconds[nível-1]`.
        inertia: { kind: "upgrade", item: "saw", costs: [20, 35, 55], seconds: [1.5, 2.5, 4] },
        // O cabo arrebentando solta uma onda em volta da serra que acerta os inimigos no raio (px de mundo).
        snapWave: { kind: "upgrade", item: "saw", costs: [25, 45], radius: [1.6 * TILE, 2.4 * TILE] },
        // Reconectar de mais longe (`pickupScale` × raio de pegar e distância de reconexão) e mais cedo (`delaySteps`).
        quickLink: { kind: "upgrade", item: "saw", costs: [15, 30], pickupScale: [1.4, 1.8], delaySteps: [12, 6] },
        // +1 coração máximo para cada jogador por nível (e já vem cheio).
        hearts: { kind: "upgrade", costs: [80, 140], perLevel: 1 }
    }),
    defaultRecipes: Object.freeze(["saw", "size", "inertia", "snapWave", "quickLink", "hearts"]),
    // Feedback da onda do Estalo, além do que o arrebentar já faz.
    snapWave: Object.freeze({ ringLife: 16, ringColor: "#ffe9b0", sparks: 14, shake: 4, sound: Object.freeze({ cue: "sawLand", rate: 0.6, volume: 0.7 }) }),
    // Serra girando por inércia: giro mínimo mantido e quanto do giro sobra a cada step depois do tempo.
    inertia: Object.freeze({ minSpin: 0.85, spinToRotation: 0.32 }),
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
    // Distância máxima do arrasto (tiles) e velocidade de quem arrasta.
    dragTiles: 2,
    dragSpeed: 0.4,
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
