// Geometria dos props desenhados pelo PropSprites: retângulo da arte, caixa da base e chave de ordenação.

export function propArtRect(def, dx, dy, tilePx) {
    const w = def.w * tilePx, h = def.h * tilePx;
    const artPx = tilePx / 16;
    const iw = def.art ? def.art.w * artPx : w, ih = def.art ? def.art.h * artPx : h;
    return { x: dx + (w - iw) / 2, y: dy + (h - ih) / 2, w: iw, h: ih, artPx };
}

export function propBaseBox(prop, def, rect, tilePx) {
    if (!def?.base) return null;
    const art = propArtRect(def, rect.x + prop.col * tilePx, rect.y + prop.row * tilePx, tilePx);
    const artW = art.w / art.artPx;
    const bx = prop.flip ? artW - def.base.x - def.base.w : def.base.x;
    return {
        x: art.x + bx * art.artPx,
        y: art.y + def.base.y * art.artPx,
        w: def.base.w * art.artPx,
        h: def.base.h * art.artPx
    };
}

// Pés acima do meio da base ⇒ a entidade fica atrás do prop.
export function propSortY(box, footOffset) {
    return box.y + box.h / 2 - footOffset;
}

// Empurra a entidade para que o círculo dos pés não entre na caixa; o corpo pode passar por cima da arte.
export function pushFeetOutOfBox(entity, box, footOffset, footRadius) {
    const fx = entity.x, fy = entity.y + footOffset;
    const nx = Math.max(box.x, Math.min(fx, box.x + box.w));
    const ny = Math.max(box.y, Math.min(fy, box.y + box.h));
    const dx = fx - nx, dy = fy - ny;
    const dist = Math.hypot(dx, dy);
    if (dist >= footRadius) return false;
    if (dist > 0) {
        const push = footRadius - dist;
        entity.x += (dx / dist) * push;
        entity.y += (dy / dist) * push;
        return true;
    }
    const left = fx - box.x, right = box.x + box.w - fx, up = fy - box.y, down = box.y + box.h - fy;
    const min = Math.min(left, right, up, down);
    if (min === up) entity.y -= up + footRadius;
    else if (min === down) entity.y += down + footRadius;
    else if (min === left) entity.x -= left + footRadius;
    else entity.x += right + footRadius;
    return true;
}
