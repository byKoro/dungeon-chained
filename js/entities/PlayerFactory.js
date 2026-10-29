import { Player } from './Player.js';
import { playerConfigs } from '../config/EntityConfig.js';
import { PLAYER_EXPRESSIONS } from '../core/AssetLoader.js';

const PLAYER_DIRS = ['player_01', 'player_02'];

export class PlayerFactory {

    constructor({ assets, bloodCanvas }) {
        this.assets = assets;
        this.bloodCanvas = bloodCanvas;
    }

    create() {
        const configs = playerConfigs(this.assets);
        return configs.map((cfg, i) => {
            const sprite = this._withExpressions(cfg.sprite, PLAYER_DIRS[i]);
            const player = new Player(0, 0, cfg.color, cfg.controls, cfg.img, cfg.name, sprite);
            player.bloodPalette = this.bloodCanvas.palette;
            return player;
        });
    }

    // Mesmo formato do trailer: as folhas de expressão têm o mesmo recorte da caminhada.
    _withExpressions(sprite, dir) {
        if (!sprite || !dir || !this.assets?.get) return sprite;
        const expressions = {};
        for (const name of PLAYER_EXPRESSIONS) {
            const img = this.assets.get(`${dir}_expr_${name}`);
            if (!img) continue;
            expressions[name] = {
                img, frameCount: sprite.frameCount, cellSize: sprite.cellSize,
                cropX: sprite.cropX, cropY: sprite.cropY, cropW: sprite.cropW, cropH: sprite.cropH
            };
        }
        return { ...sprite, expressions };
    }
}
