import { ANIMATED_PROPS, PROP_COLLISION } from '../config/PropConfig.js';
import { HOLE_FALL, TILE } from '../config/GameConfig.js';
import { propBaseBox, propSortY, pushFeetOutOfBox } from '../core/PropBodies.js';

const PLAYER_FOOT = HOLE_FALL.footOffset ?? 14;

// Props animados das salas do Editor 2.0. Os que têm `base` colidem pelos pés e são ordenados por y com as entidades;
// os outros ficam na camada do chão. `getFrame(prop, roomKey)` permite a outro sistema (baús) trocar o quadro.
export class RoomProps {
    constructor({ rooms, sprites, getFrame = null, defs = ANIMATED_PROPS, tile = TILE }) {
        Object.assign(this, { rooms, sprites, getFrame, defs, tile });
        this._cache = new WeakMap();
    }

    _layout() {
        const room = this.rooms.current;
        if (!room) return { floor: [], solid: [] };
        let layout = this._cache.get(room);
        if (layout) return layout;
        const rect = this.rooms.cellRect();
        layout = { rect, floor: [], solid: [] };
        for (const prop of room.tiles.props || []) {
            const def = prop.type ? this.defs[prop.type] : null;
            if (!def) continue;
            const box = propBaseBox(prop, def, rect, this.tile);
            if (box) layout.solid.push({ prop, def, box, sortY: propSortY(box, PLAYER_FOOT), feetSortY: propSortY(box, 0) });
            else layout.floor.push({ prop, def });
        }
        this._cache.set(room, layout);
        return layout;
    }

    get solid() {
        return this._layout().solid;
    }

    resolveCollisions(entities) {
        const solid = this._layout().solid;
        if (!solid.length) return;
        for (const e of entities) {
            if (!e || e.falling || e.state === "dying") continue;
            const foot = e.footY !== undefined ? e.footY - e.y : PLAYER_FOOT;
            for (const s of solid) pushFeetOutOfBox(e, s.box, foot, PROP_COLLISION.footRadius);
        }
    }

    drawFloor(ctx, ms) {
        const { rect, floor } = this._layout();
        for (const { prop } of floor) {
            this.sprites.draw(ctx, prop.type, rect.x + prop.col * this.tile, rect.y + prop.row * this.tile, this.tile, ms, !!prop.flip);
        }
    }

    drawables(ms) {
        const { rect, solid } = this._layout();
        const key = this.rooms.current?.key;
        return solid.map(s => ({
            y: s.sortY,
            feetSortY: s.feetSortY,
            draw: ctx => this._drawSolid(ctx, s, rect, key, ms)
        }));
    }

    _drawSolid(ctx, s, rect, roomKey, ms) {
        const { prop } = s;
        const dx = rect.x + prop.col * this.tile, dy = rect.y + prop.row * this.tile;
        const over = this.getFrame?.(prop, roomKey);
        if (over) this.sprites.drawFrame(ctx, over.type, over.frame, dx, dy, this.tile, !!prop.flip, over.sx ?? 1, over.sy ?? 1, over.shine ?? null);
        else this.sprites.draw(ctx, prop.type, dx, dy, this.tile, ms, !!prop.flip);
    }
}
