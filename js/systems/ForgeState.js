import { FORGE, anvilRecipes } from '../config/ForgeConfig.js';

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
