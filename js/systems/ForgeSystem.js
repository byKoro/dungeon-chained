import { FORGE, anvilRecipes } from '../config/ForgeConfig.js';
import { TILE } from '../config/GameConfig.js';

const INTERACT_KEYS = ["e", "shiftright"];
const NAV_KEYS = {
    up: ["w", "arrowup"],
    down: ["s", "arrowdown"],
    confirm: [" ", "enter"],
    close: ["e", "shiftright", "escape"]
};

// Bigorna: qualquer jogador perto abre o menu com interagir; enquanto aberto o Game congela a simulação e
// os dois controlam o mesmo cursor. A compra passa pelo ForgeState e gasta do pote de sucata.
export class ForgeSystem {
    constructor({ rooms, getPlayers, input, forge, scrap, audio = null, canOpen = () => true, onOpen = null, onClose = null, onBuy = null, cfg = FORGE, tile = TILE }) {
        Object.assign(this, { rooms, getPlayers, input, forge, scrap, audio, canOpen, onOpen, onClose, onBuy, cfg, tile });
        this.reset();
    }

    reset() {
        this.open = false;
        this.anvil = null;
        this.nearby = null;
        this.blocked = false;
        this.cursor = 0;
        this.recipes = [];
        this.denyT = 0;
        this._interactHeld = INTERACT_KEYS.map(() => true);
        this._navHeld = {};
    }

    _anvils() {
        const room = this.rooms.current;
        if (!room) return [];
        const rect = this.rooms.cellRect();
        return (room.tiles.props || []).filter(p => p.type === "anvil").map(prop => ({
            prop, roomKey: room.key,
            x: rect.x + (prop.col + 1) * this.tile,
            y: rect.y + (prop.row + 0.5) * this.tile
        }));
    }

    // Por step, com a simulação rodando: proximidade, dica e abertura.
    update() {
        const players = (this.getPlayers() || []).filter(p => p && !p.falling && p.lives > 0);
        const tapped = INTERACT_KEYS.map((k, i) => {
            const down = !!this.input.isDown(k);
            const tap = down && !this._interactHeld[i];
            this._interactHeld[i] = down;
            return tap;
        });
        this.nearby = null;
        for (const a of this._anvils()) {
            const users = players.filter(p => Math.hypot(p.x - a.x, p.y - a.y) <= this.cfg.openRadius);
            if (!users.length) continue;
            this.nearby = a;
            this.blocked = !this.canOpen();
            const all = this.getPlayers() || [];
            if (!this.blocked && users.some(p => tapped[all.indexOf(p)])) this.openAt(a);
            break;
        }
    }

    openAt(anvil) {
        this.open = true;
        this.anvil = anvil;
        this.recipes = anvilRecipes(anvil.prop);
        this.cursor = Math.max(0, this.recipes.findIndex(id => this.status(id) === "ok"));
        this._navHeld = Object.fromEntries(Object.entries(NAV_KEYS).map(([k, keys]) => [k, keys.some(key => this.input.isDown(key))]));
        this.audio?.play("uiOpen");
        this.onOpen?.(anvil);
    }

    close({ silent = false } = {}) {
        if (!this.open) return;
        this.open = false;
        this._interactHeld = INTERACT_KEYS.map(() => true);
        if (!silent) this.audio?.play("uiClose");
        this.onClose?.(this.anvil);
    }

    status(id) {
        return this.forge.status(id, this.scrap?.amount ?? 0);
    }

    _keyEdges() {
        const out = {};
        for (const [name, keys] of Object.entries(NAV_KEYS)) {
            const down = keys.some(k => this.input.isDown(k));
            out[name] = down && !this._navHeld[name];
            this._navHeld[name] = down;
        }
        return out;
    }

    // Por frame (a simulação está parada): teclado de qualquer jogador + `pad` = MenuPad.poll().
    handleInput(pad = {}) {
        if (!this.open) return;
        const k = this._keyEdges();
        if (this.denyT > 0) this.denyT--;
        if (k.close || pad.b || pad.start) { this.close(); return; }
        if (!this.recipes.length) return;
        const move = (k.up || pad.up ? -1 : 0) + (k.down || pad.down ? 1 : 0);
        if (move) {
            this.cursor = (this.cursor + move + this.recipes.length) % this.recipes.length;
            this.audio?.play("uiMove");
        }
        if (k.confirm || pad.a) this.buy(this.recipes[this.cursor]);
    }

    buy(id) {
        const result = this.forge.buy(id, this.scrap.wallet);
        if (!result.ok) {
            this.denyT = 12;
            this.audio?.play("uiMove", { rateMultiplier: 0.6 });
            return result;
        }
        this.audio?.play("forgeBuy");
        this.onBuy?.(id, result, this.anvil);
        return result;
    }

    get prompt() {
        if (this.open || !this.nearby) return null;
        return this.blocked ? "forge.blocked" : "forge.prompt";
    }
}
