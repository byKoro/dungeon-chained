import { TILE, LIGHT_PIXEL_SCALE } from '../config/GameConfig.js';
import { DEMO, BOSS_GATE_LIGHT } from '../config/DemoConfig.js';
import { STAIR_INDEX } from '../config/MapEditorConfig.js';

export class DemoDoors {
    constructor({ assets, renderer, rooms }) {
        Object.assign(this, { assets, renderer, rooms });
        this.opened = new Map();
    }

    // Escadas vão no chão (sob as entidades); portas normais fechadas ficam na frente do redesenho da parede sul.
    drawGates(ctx) {
        this._draw(ctx, true);
    }

    draw(ctx) {
        this._draw(ctx, false);
    }

    // Portão do boss ordenado por y com as entidades: a base dele é a borda da sala (`door.y`), então quem está
    // dentro do vão (pés acima da borda) fica atrás do arco, e quem está na sala fica na frente.
    drawables() {
        if (!this.rooms.dungeon.document) return [];
        const rect = this.rooms.cellRect();
        return this.rooms.doorsOfCurrent().filter(d => d.type === 'boss')
            .map(door => ({ y: rect.y - TILE, feetSortY: door.y, draw: ctx => this._drawBossGate(ctx, door, rect) }));
    }

    _drawBossGate(ctx, door, rect) {
        const img = this.assets.get('bossGate');
        if (!img?.complete || !img.naturalWidth) return;
        const closed = door.blocked || this.rooms.isLocked(), now = performance.now();
        const key = `${this.rooms.currentKey}/${door.id}`;
        if (closed) this.opened.delete(key); else if (!this.opened.has(key)) this.opened.set(key, now);
        const frame = closed ? 0 : Math.min(3, Math.floor((now - this.opened.get(key)) / DEMO.gateFrameMs) + 1);
        const size = img.naturalHeight;
        const prev = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, frame * size, 0, size, size, door.x - TILE, rect.y - TILE, TILE * 2, TILE * 2);
        ctx.imageSmoothingEnabled = prev;
    }

    renderLights(postProcessor, now = performance.now()) {
        if (!this.rooms.dungeon.document) return;
        const h = DEMO.gateHighlight, rect = this.rooms.cellRect();
        const pulse = 1 + h.pulse * Math.sin((now / h.periodMs) * Math.PI * 2);
        for (const door of this.rooms.doorsOfCurrent()) {
            if (door.type !== 'boss' || !door.blocked) continue;
            const s = this.renderer.worldToScreen(door.x, rect.y + TILE * h.lift);
            const px = Math.max(2, Math.round((TILE / 16) * s.zoom * LIGHT_PIXEL_SCALE));
            postProcessor.addLight(s.x, s.y, h.radius * pulse * s.zoom, px, 1, BOSS_GATE_LIGHT);
        }
    }

    _draw(ctx, gates) {
        if (!this.rooms.dungeon.document) return;
        const rect = this.rooms.cellRect(), locked = this.rooms.isLocked(), now = performance.now();
        for (const door of this.rooms.doorsOfCurrent()) {
            if (door.type === 'boss') continue;   // y-sorted: `drawables()`
            if ((door.type === 'stairs') !== gates) continue;
            if (door.type === 'stairs') {
                this.renderer.tileset.draw(ctx, STAIR_INDEX, door.x - TILE / 2, door.y - TILE / 2, TILE, TILE);
                continue;
            }
            const closed = door.blocked || locked;
            const key = `${this.rooms.currentKey}/${door.id}`;
            if (closed) this.opened.delete(key); else if (!this.opened.has(key)) this.opened.set(key, now);
            if (closed) {
                for (const [i, p] of door.cells.entries()) this.renderer.tileset.draw(ctx, ['N', 'S'].includes(door.dir) ? 36 + i % 2 : door.dir === 'W' ? 47 + i % 2 * 10 : 48 + i % 2 * 10, rect.x + p.col * TILE, rect.y + p.row * TILE, TILE, TILE);
            }
        }
    }
}
