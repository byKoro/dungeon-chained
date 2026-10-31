export class Weapon {
    constructor(name, hitThreshold = 22) {
        this.name = name;
        this.hitThreshold = hitThreshold;
    }

    update() {}

    drawChain(ctx, p1, p2) {}

    draw(ctx, p1, p2) {}
}
