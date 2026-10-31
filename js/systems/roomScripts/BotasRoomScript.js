import { BOOTS } from '../../config/DemoConfig.js';
import { ANIMATED_PROPS } from '../../config/PropConfig.js';

// Sala "botas": cinemática de entrada (uma vez por run). A câmera sai dos jogadores, passa pelos baús e termina
// na bota flutuando sobre a bigorna (clímax), depois volta para a dupla. Usa o foco de câmera do DemoCamera
// (api.cameraFocus/clearCameraFocus). Enquanto roda, segura os jogadores parados (velocidade zerada).
export class BotasRoomScript {
    constructor(api, cfg = BOOTS.cinematic) {
        this.api = api;
        this.cfg = cfg;
        this.phase = "idle";
        this.t = 0;
        this.stops = this._buildStops();
        this.index = 0;
    }

    // Paradas da câmera: baús (hold curto) e a bota sobre a bigorna (hold maior, zoom maior).
    _buildStops() {
        const api = this.api, c = this.cfg, authored = api.authored || {};
        const stops = [];
        for (const prop of authored.props || []) {
            if (prop.type !== "chest") continue;
            const p = api.tileCenter(prop.col, prop.row);
            stops.push({ x: p.x, y: p.y, zoom: c.chestZoom, hold: c.chestHoldSteps });
        }
        const anvil = (authored.props || []).find(p => p.type === "anvil");
        if (anvil) {
            const def = ANIMATED_PROPS.anvil, p = api.tileCenter(anvil.col, anvil.row);
            stops.push({ x: p.x + (def.w - 1) * api.tile / 2, y: p.y - BOOTS.liftTiles * api.tile, zoom: c.bootsZoom, hold: c.bootsHoldSteps, boots: true });
        }
        return stops;
    }

    update() {
        if (this.phase === "done") return;
        if (this.phase === "idle") {
            // Uma vez por run; se não há paradas (sem baús/bigorna), nem roda.
            if (this.api.isCompleted("botas:intro") || !this.stops.length) { this.phase = "done"; return; }
            this.api.complete("botas:intro");
            this.phase = "start";
            this.t = 0;
            this.index = 0;
            return;
        }

        this._freezePlayers();
        this.t++;
        const c = this.cfg;

        if (this.phase === "start") {
            if (this.t >= c.startDelaySteps) { this.phase = "tour"; this.t = 0; this._focusCurrent(); }
            return;
        }
        if (this.phase === "tour") {
            const stop = this.stops[this.index];
            // panSteps para a câmera assentar + hold da parada.
            if (this.t >= c.panSteps + stop.hold) {
                this.index++;
                this.t = 0;
                if (this.index >= this.stops.length) { this.phase = "return"; this.api.clearCameraFocus(); return; }
                this._focusCurrent();
            }
            return;
        }
        if (this.phase === "return") {
            // Deixa a câmera voltar para a dupla antes de liberar.
            if (this.t >= c.panSteps) { this.phase = "done"; }
        }
    }

    _focusCurrent() {
        const s = this.stops[this.index];
        this.api.cameraFocus(s.x, s.y, s.zoom);
    }

    _freezePlayers() {
        for (const p of this.api.getPlayers() || []) { if (p) { p.vx = 0; p.vy = 0; } }
    }

    // A dupla morreu durante a cinemática: solta a câmera e encerra (a sala reseta por fora).
    onDeath() {
        if (this.phase !== "done") { this.api.clearCameraFocus?.(); this.phase = "done"; }
    }
}
