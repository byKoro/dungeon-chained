/**
 * Rect2D - Engine-agnostic 2D axis-aligned bounding box (AABB).
 * Zero browser or engine dependencies. Directly portable to C# struct Rect2D.
 */
export class Rect2D {
    constructor(x = 0, y = 0, w = 0, h = 0) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    get left() {
        return this.x;
    }

    get right() {
        return this.x + this.w;
    }

    get top() {
        return this.y;
    }

    get bottom() {
        return this.y + this.h;
    }

    get centerX() {
        return this.x + this.w * 0.5;
    }

    get centerY() {
        return this.y + this.h * 0.5;
    }

    set(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        return this;
    }

    clone() {
        return new Rect2D(this.x, this.y, this.w, this.h);
    }

    contains(px, py) {
        if (typeof px === 'object' && px !== null) {
            py = px.y;
            px = px.x;
        }
        return px >= this.x && px <= this.x + this.w &&
               py >= this.y && py <= this.y + this.h;
    }

    intersects(other) {
        return this.x < other.x + other.w &&
               this.x + this.w > other.x &&
               this.y < other.y + other.h &&
               this.y + this.h > other.y;
    }

    intersectsCircle(cx, cy, radius) {
        const nearestX = Math.max(this.x, Math.min(cx, this.x + this.w));
        const nearestY = Math.max(this.y, Math.min(cy, this.y + this.h));
        const dx = cx - nearestX;
        const dy = cy - nearestY;
        return (dx * dx + dy * dy) < (radius * radius);
    }

    static fromBounds(left, top, right, bottom) {
        return new Rect2D(left, top, right - left, bottom - top);
    }
}
