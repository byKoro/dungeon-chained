import { TILE } from '../config/GameConfig.js';
import { DEMO } from '../config/DemoConfig.js';

export class DemoDoors {
    constructor({ assets, renderer, rooms }) {
        Object.assign(this, { assets, renderer, rooms });
        this.opened = new Map();
    }

    draw(ctx) {
        if (!this.rooms.dungeon.document) return;
        const rect = this.rooms.cellRect(), locked = this.rooms.isLocked(), now = performance.now();
        for (const door of this.rooms.doorsOfCurrent()) {
            const closed = door.blocked || locked;
            const key = `${this.rooms.currentKey}/${door.id}`;
            if (closed) this.opened.delete(key); else if (!this.opened.has(key)) this.opened.set(key, now);
            if (door.type === 'boss') {
                const img = this.assets.get('bossGate');
                if (img?.complete && img.naturalWidth) {
                    const frame = closed ? 0 : Math.min(3, Math.floor((now - this.opened.get(key)) / DEMO.gateFrameMs) + 1);
                    const size = img.naturalWidth / 2;
                    ctx.drawImage(img, frame % 2 * size, Math.floor(frame / 2) * size, size, size, door.x - TILE * 1.5, rect.y - TILE * 0.5, TILE * 3, TILE * 3);
                }
            } else if (closed) {
                for (const [i, p] of door.cells.entries()) this.renderer.tileset.draw(ctx, ['N', 'S'].includes(door.dir) ? 36 + i % 2 : door.dir === 'W' ? 47 + i % 2 * 10 : 48 + i % 2 * 10, rect.x + p.col * TILE, rect.y + p.row * TILE, TILE, TILE);
            }
        }
    }
}
