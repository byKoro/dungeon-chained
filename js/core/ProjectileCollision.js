export function firstWallImpact(x, y, nextX, nextY, walls, radius = 0) {
    let nearest = null;
    for (const wall of walls) {
        const minX = wall.x - radius, maxX = wall.x + wall.w + radius;
        const minY = wall.y - radius, maxY = wall.y + wall.h + radius;
        // A flecha nasce dentro da parede que sustenta o lançador.
        if (x > minX && x < maxX && y > minY && y < maxY) continue;
        let enter = 0, exit = 1;
        for (const [origin, delta, min, max] of [[x, nextX - x, minX, maxX], [y, nextY - y, minY, maxY]]) {
            if (delta === 0) {
                if (origin < min || origin > max) { enter = Infinity; break; }
            } else {
                const a = (min - origin) / delta, b = (max - origin) / delta;
                enter = Math.max(enter, Math.min(a, b));
                exit = Math.min(exit, Math.max(a, b));
            }
        }
        if (enter <= exit && (!nearest || enter < nearest.t)) {
            const cx = x + (nextX - x) * enter, cy = y + (nextY - y) * enter;
            nearest = { t: enter, x: cx, y: cy,
                surfaceX: Math.max(wall.x, Math.min(wall.x + wall.w, cx)),
                surfaceY: Math.max(wall.y, Math.min(wall.y + wall.h, cy)) };
        }
    }
    return nearest;
}
