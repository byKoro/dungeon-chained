import { ANIMATED_PROPS } from '../config/PropConfig.js';
import { CHEST, chestScrapAmount } from '../config/ScrapConfig.js';
import { TILE } from '../config/GameConfig.js';

// Baús das salas do Editor 2.0: abrem uma vez por partida quando qualquer jogador chega perto e soltam sucata.
export class ChestSystem {
    constructor({ rooms, scrap, getPlayers, audio = null, particleSystem = null, cfg = CHEST, defs = ANIMATED_PROPS, tile = TILE }) {
        Object.assign(this, { rooms, scrap, getPlayers, audio, particleSystem, cfg, defs, tile });
        this.reset();
    }

    reset() {
        this.opened = new Map();
        this.justOpened = [];
    }

    _id(roomKey, prop) {
        return `${roomKey}/${prop.col},${prop.row}`;
    }

    isOpen(roomKey, prop) {
        return this.opened.has(this._id(roomKey, prop));
    }

    _center(prop, def, rect) {
        return {
            x: rect.x + (prop.col + def.w / 2) * this.tile,
            y: rect.y + (prop.row + def.h / 2) * this.tile
        };
    }

    update() {
        this.justOpened = [];
        const room = this.rooms.current;
        if (!room) return;
        const rect = this.rooms.cellRect();
        const players = (this.getPlayers() || []).filter(p => p && !p.falling && p.lives > 0);
        for (const prop of room.tiles.props || []) {
            const def = this.defs[prop.type];
            if (!def?.opens) continue;
            const id = this._id(room.key, prop);
            const state = this.opened.get(id);
            const c = this._center(prop, def, rect);
            if (state) {
                state.t++;
                if (!state.burst && state.t >= this.cfg.burstDelaySteps) {
                    state.burst = true;
                    this.scrap?.spawnBurst(c.x, c.y - this.cfg.burstLift, state.amount, { dir: this.cfg.burstDir, spread: this.cfg.burstSpread });
                    this.particleSystem?.triggerFlash(c.x, c.y - this.cfg.burstLift, 8, 0.7);
                }
                continue;
            }
            if (!players.some(p => Math.hypot(p.x - c.x, p.y - c.y) <= this.cfg.openRadius)) continue;
            const amount = chestScrapAmount(prop);
            this.opened.set(id, { t: 0, burst: false, amount });
            this.justOpened.push({ prop, roomKey: room.key, amount });
            this.audio?.play("chestOpen");
        }
    }

    // Quadro da animação de abertura para o RoomProps; null = baú fechado (anima normalmente).
    frameFor(prop, roomKey) {
        const def = this.defs[prop.type];
        const state = def?.opens ? this.opened.get(this._id(roomKey, prop)) : null;
        if (!state) return null;
        const open = this.defs[def.opens];
        const frame = Math.min(open.frames.length - 1, Math.floor(state.t / this.cfg.frameSteps));
        let sx = 1, sy = 1;
        if (state.t < this.cfg.squashSteps) {
            const k = state.t / this.cfg.squashSteps;
            const wave = Math.sin(k * Math.PI * 2) * (1 - k);
            sy = 1 - this.cfg.squashAmount * wave;
            sx = 1 + this.cfg.squashAmount * 0.6 * wave;
        }
        return { type: def.opens, frame, sx, sy };
    }
}
