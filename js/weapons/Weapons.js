export class Weapon {
    constructor(name, hitThreshold = 22) {
        this.name = name;
        this.hitThreshold = hitThreshold;
    }

    update() {}

    draw(ctx, p1, p2) {}
}