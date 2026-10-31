import { FORGE, SAW_DRAG, anvilRecipes } from '../config/ForgeConfig.js';

// O que a dupla já forjou nesta partida: nível de cada receita (item = 0 ou 1).
export class ForgeState {
    constructor(recipes = FORGE.recipes) {
        this.recipes = recipes;
        this.reset();
    }

    reset({ items = [] } = {}) {
        this.levels = {};
        for (const id of items) if (this.recipes[id]) this.levels[id] = 1;
    }

    level(id) {
        return this.levels[id] ?? 0;
    }

    has(id) {
        return this.level(id) > 0;
    }

    maxLevel(id) {
        return this.recipes[id]?.costs.length ?? 0;
    }

    nextCost(id) {
        return this.recipes[id]?.costs[this.level(id)] ?? null;
    }

    // ok | maxed | locked (item da melhoria ainda não liberado) | poor (falta sucata) | unknown
    status(id, amount) {
        const r = this.recipes[id];
        if (!r) return "unknown";
        if (this.level(id) >= this.maxLevel(id)) return "maxed";
        if (r.item && !this.has(r.item)) return "locked";
        if (amount < this.nextCost(id)) return "poor";
        return "ok";
    }

    buy(id, wallet) {
        const status = this.status(id, wallet.amount);
        if (status !== "ok") return { ok: false, status };
        const cost = this.nextCost(id);
        if (!wallet.spend(cost)) return { ok: false, status: "poor" };
        this.levels[id] = this.level(id) + 1;
        return { ok: true, status, cost, level: this.levels[id] };
    }
}

export function mapOffersRecipe(map, id) {
    for (const room of Object.values(map?.rooms || {})) {
        for (const p of room.props || []) {
            if (p.type === "anvil" && anvilRecipes(p).includes(id)) return true;
        }
    }
    return false;
}

// Converte os níveis comprados em parâmetros do cabo e da serra (valores-base em `base`).
export function applySawUpgrades(forge, chain, weapon, base, recipes = FORGE.recipes) {
    chain.strainDistance = base.strainDistance;
    chain.breakDistance = base.breakDistance;
    const link = forge.level("quickLink");
    const scale = link > 0 ? recipes.quickLink.pickupScale[link - 1] : 1;
    chain.pickupRadius = base.pickupRadius * scale;
    chain.reconnectDistance = base.reconnectDistance * scale;
    chain.reconnectDelay = link > 0 ? recipes.quickLink.delaySteps[link - 1] : (base.reconnectDelay ?? 20);
    if (!weapon) return;
    weapon.sizeScale = 1 + recipes.size.perLevel * forge.level("size");
    weapon.doubleSaw = false;
    const inertia = forge.level("inertia");
    weapon.inertiaSteps = inertia > 0 ? Math.round(recipes.inertia.seconds[inertia - 1] * 60) : 0;
}

// Raio da onda do Estalo no nível atual (0 = sem a melhoria).
export function snapWaveRadius(forge, recipes = FORGE.recipes) {
    const lvl = forge.level("snapWave");
    return lvl > 0 ? recipes.snapWave.radius[lvl - 1] : 0;
}

// Corações comprados: sobe o máximo dos dois e enche o que foi ganho; voltando ao nível 0, corta o excesso.
export function applyHeartUpgrades(forge, players, base = 3, recipes = FORGE.recipes) {
    const max = base + recipes.hearts.perLevel * forge.level("hearts");
    for (const p of players) {
        if (!p) continue;
        const gained = max - (p.maxLives ?? base);
        p.maxLives = max;
        p.lives = Math.max(0, Math.min(max, p.lives + Math.max(0, gained)));
    }
}

// Arrasto da serra largada: distância máxima (px) e escala de velocidade de quem arrasta.
export function sawDragStats(tile, cfg = SAW_DRAG) {
    return { limit: cfg.dragTiles * tile, speedScale: cfg.dragSpeed };
}
