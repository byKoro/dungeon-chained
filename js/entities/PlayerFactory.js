import { Player } from './Player.js';
import { playerConfigs } from '../config/EntityConfig.js';

/**
 * PlayerFactory — cria os dois jogadores a partir das configs de EntityConfig.
 *
 * Antes `createPlayers()` montava p1/p2 inline no main.js com crops hardcoded.
 * Aqui a construção fica isolada e orientada a dados.
 */
export class PlayerFactory {
    /**
     * @param {object} opts
     * @param {AssetLoader} opts.assets
     * @param {BloodCanvas} opts.bloodCanvas  fornece a paleta de sangue
     */
    constructor({ assets, bloodCanvas }) {
        this.assets = assets;
        this.bloodCanvas = bloodCanvas;
    }

    // Cria [p1, p2] posicionados na origem (o chamador reposiciona).
    create() {
        const configs = playerConfigs(this.assets);
        return configs.map(cfg => {
            const player = new Player(0, 0, cfg.color, cfg.controls, cfg.img, cfg.name, cfg.sprite);
            player.bloodPalette = this.bloodCanvas.palette;
            return player;
        });
    }
}
