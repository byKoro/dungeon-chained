import { ANIMATED_PROPS } from '../../config/PropConfig.js';
import { SCRIPT_LINES } from '../../config/DialogueConfig.js';

// Sala `inicial`: só o roteiro de falas do design. As gaiolas do Salão agora são genéricas (RoomEvents, por encontro autorado).
export class InicialRoomScript {
    constructor(api, cfg = SCRIPT_LINES) {
        this.api = api;
        this.cfg = cfg;
        this._steps = 0;
        const props = api.authored.props || [];
        this.anvil = props.find(p => p.type === "anvil") || null;
        this.gate = (api.authored.doors || []).find(d => d.type === "boss") || null;
    }

    update() {
        this._steps++;
        if (this.cfg.enabled) this._lines();
    }

    // Cada fala toca uma vez por run: fica em `completed`, que sobrevive à morte.
    _once(id, lines) {
        if (this.api.isCompleted(id)) return;
        this.api.complete(id);
        for (const [who, key] of lines) this.api.dialogue?.say(who, key);
    }

    _anyNear(x, y, tiles) {
        const r = tiles * this.api.tile;
        return (this.api.getPlayers() || []).some(p => p && p.lives > 0 && !p.falling && Math.hypot(p.x - x, p.y - y) <= r);
    }

    _lines() {
        const api = this.api, cfg = this.cfg;
        if (this._steps >= cfg.startDelaySteps) this._once("talk:start", [[0, "talk.start.1"], [1, "talk.start.2"]]);
        const opened = (api.chests?.justOpened || []).filter(o => o.roomKey === api.room.key);
        if (opened.some(o => !o.prop.encounter)) this._once("talk:chest1", [[1, "talk.chest1"]]);
        if (opened.some(o => o.prop.encounter)) this._once("talk:chest2", [[0, "talk.chest2"]]);
        if (this.anvil) {
            const def = ANIMATED_PROPS.anvil, c = api.tileCenter(this.anvil.col, this.anvil.row);
            const x = c.x + (def.w - 1) * api.tile / 2, y = c.y + (def.h - 1) * api.tile / 2;
            if (this._anyNear(x, y, cfg.anvilNearTiles)) this._once("talk:anvil", [[0, "talk.anvilNear"]]);
        }
        if (this.gate) {
            const c = api.tileCenter(this.gate.col, this.gate.row + 1);
            const x = c.x + ((this.gate.width || 1) - 1) * api.tile / 2;
            if (this._anyNear(x, c.y, cfg.bossGateTiles)) this._once("talk:bossGate", [[1, "talk.bossGate"], [0, "talk.rightDoor"]]);
        }
    }
}
