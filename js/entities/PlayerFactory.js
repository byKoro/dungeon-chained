import { Player } from './Player.js';
import { playerConfigs } from '../config/EntityConfig.js';

export class PlayerFactory {

    constructor({ assets, bloodCanvas }) {
        this.assets = assets;
        this.bloodCanvas = bloodCanvas;
    }

    create() {
        const configs = playerConfigs(this.assets);
        return configs.map(cfg => {
            const player = new Player(0, 0, cfg.color, cfg.controls, cfg.img, cfg.name, cfg.sprite);
            player.bloodPalette = this.bloodCanvas.palette;
            return player;
        });
    }
}
