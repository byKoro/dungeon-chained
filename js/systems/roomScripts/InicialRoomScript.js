import { CageEncounter } from '../CageEncounter.js';

// Sala `inicial`: o encontro da gaiola no Salão. Ids vêm do Editor 2.0 (zona e encontro "salao").
export class InicialRoomScript {
    constructor(api) {
        this.cage = new CageEncounter({ api, zoneId: "salao", encounterId: "salao" });
    }

    update() { this.cage.update(); }
    onDeath() { this.cage.onDeath(); }
    drawFloor(ctx) { this.cage.drawFloor(ctx); }
    drawAir(ctx) { this.cage.drawAir(ctx); }
    lights() { return this.cage.lights(); }
}
