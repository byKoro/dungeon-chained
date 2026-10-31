/**
 * Vec2 - Engine-agnostic 2D vector mathematics.
 * Zero browser or engine dependencies. Directly portable to C# struct Vec2.
 */
export class Vec2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }

    clone() {
        return new Vec2(this.x, this.y);
    }

    add(v) {
        return new Vec2(this.x + v.x, this.y + v.y);
    }

    sub(v) {
        return new Vec2(this.x - v.x, this.y - v.y);
    }

    scale(s) {
        return new Vec2(this.x * s, this.y * s);
    }

    len() {
        return Math.hypot(this.x, this.y);
    }

    lenSq() {
        return this.x * this.x + this.y * this.y;
    }

    normalize() {
        const l = this.len();
        if (l === 0) return new Vec2(0, 0);
        return new Vec2(this.x / l, this.y / l);
    }

    dist(v) {
        return Math.hypot(this.x - v.x, this.y - v.y);
    }

    dot(v) {
        return this.x * v.x + this.y * v.y;
    }

    static zero() {
        return new Vec2(0, 0);
    }

    static add(a, b) {
        return new Vec2(a.x + b.x, a.y + b.y);
    }

    static sub(a, b) {
        return new Vec2(a.x - b.x, a.y - b.y);
    }

    static scale(a, s) {
        return new Vec2(a.x * s, a.y * s);
    }

    static dist(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    static dot(a, b) {
        return a.x * b.x + a.y * b.y;
    }
}
