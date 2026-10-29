import { ANIMATED_PROPS } from '../config/PropConfig.js';
import { CHEST, chestScrapAmount } from '../config/ScrapConfig.js';
import { TILE } from '../config/GameConfig.js';

// Tecla de interagir de cada jogador (o X do controle chega como a tecla do jogador dele).
const INTERACT_KEYS = ["e", "shiftright"];

// Baús das salas do Editor 2.0: um jogador bem perto aperta interagir; o baú abre uma vez por partida e solta sucata.
export class ChestSystem {
    constructor({ rooms, scrap, getPlayers, input = null, audio = null, particleSystem = null, onOpen = null, cfg = CHEST, defs = ANIMATED_PROPS, tile = TILE }) {
        Object.assign(this, { rooms, scrap, getPlayers, input, audio, particleSystem, onOpen, cfg, defs, tile });
        this.reset();
    }

    reset() {
        this.opened = new Map();
        this.justOpened = [];
        this.nearby = false;
        this._held = INTERACT_KEYS.map(() => true);
        this._shinePhase = 0;
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

    _taps() {
        return INTERACT_KEYS.map((k, i) => {
            const down = !!this.input?.isDown(k);
            const tap = down && !this._held[i];
            this._held[i] = down;
            return tap;
        });
    }

    // Outro sistema usou o aperto neste step: não abre baú com ele.
    latchInteract() {
        this._held = INTERACT_KEYS.map(() => true);
    }

    update() {
        this.justOpened = [];
        this.nearby = false;
        this._shinePhase += this.cfg.shineSpeed;
        const taps = this._taps();
        const room = this.rooms.current;
        if (!room) return;
        const rect = this.rooms.cellRect();
        const players = this.getPlayers() || [];
        let used = false;
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
            const close = players.map(p => !!p && !p.falling && p.lives > 0 && Math.hypot(p.x - c.x, p.y - c.y) <= this.cfg.openRadius);
            if (!close.some(Boolean)) continue;
            this.nearby = true;
            if (used || !close.some((ok, i) => ok && taps[i])) continue;
            used = true;
            const amount = chestScrapAmount(prop);
            this.opened.set(id, { t: 0, burst: false, amount });
            this.justOpened.push({ prop, roomKey: room.key, amount });
            this.audio?.play("chestOpen");
        }
        if (used) this.onOpen?.();
    }

    get prompt() {
        return this.nearby ? "chest.prompt" : null;
    }

    // Saída da sala antes da tampa terminar de abrir: a sucata vai direto para o pote.
    flushPending() {
        let credited = 0;
        for (const state of this.opened.values()) {
            if (state.burst) continue;
            state.burst = true;
            credited += state.amount;
        }
        if (credited) this.scrap?.wallet.add(credited);
        return credited;
    }

    // Quadro para o RoomProps: fechado = primeiro quadro parado com o brilho; aberto = animação de abertura.
    frameFor(prop, roomKey) {
        const def = this.defs[prop.type];
        if (!def?.opens) return null;
        const state = this.opened.get(this._id(roomKey, prop));
        if (!state) return { type: prop.type, frame: 0, shine: (Math.sin(this._shinePhase) + 1) / 2 };
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
