export class ScrapWallet {
    constructor(amount = 0) {
        this.amount = 0;
        this.add(amount);
    }

    add(n) {
        const v = Math.floor(Number(n) || 0);
        if (v > 0) this.amount += v;
        return this.amount;
    }

    canAfford(n) {
        return this.amount >= n;
    }

    spend(n) {
        const v = Math.floor(Number(n) || 0);
        if (v < 0 || !this.canAfford(v)) return false;
        this.amount -= v;
        return true;
    }

    reset() {
        this.amount = 0;
    }
}
