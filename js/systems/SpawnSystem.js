import { MeleeEnemy } from '../entities/MeleeEnemy.js';
import { MELEE_ENEMY_CONFIGS, ENEMY_TYPE_BY_KEY } from '../config/EntityConfig.js';
import { BLOOD_STAIN_CONFIG } from '../config/GameConfig.js';

/**
 * SpawnSystem — fábrica de inimigos.
 *
 * Encapsula a escolha de config, a criação do MeleeEnemy e a fiação da paleta
 * de sangue / config de manchas. Antes isso vivia inline em `enterRoom` no
 * main.js.
 */
export class SpawnSystem {
    /**
     * @param {object} opts
     * @param {object} opts.assets    AssetLoader (imagens dos inimigos)
     * @param {object} opts.bloodCanvas  buffer de sangue (fornece a paleta)
     */
    constructor({ assets, bloodCanvas }) {
        this.assets = assets;
        this.bloodCanvas = bloodCanvas;
    }

    randomMeleeConfig() {
        const factory = MELEE_ENEMY_CONFIGS[(Math.random() * MELEE_ENEMY_CONFIGS.length) | 0];
        return factory(this.assets);
    }

    /**
     * Cria um inimigo. Se `type` (chave de ENEMY_TYPES, vinda da peça autoral
     * do editor) for informado, usa a config correspondente; senão sorteia.
     */
    createEnemy(x, y, floor, type = null) {
        const factory = (type && ENEMY_TYPE_BY_KEY[type]?.config) || null;
        const cfg = factory ? factory(this.assets) : this.randomMeleeConfig();
        const foe = new MeleeEnemy(x, y, cfg.img, cfg, floor);
        foe.bloodPalette = this.bloodCanvas.palette;
        foe.gibStainConfig = BLOOD_STAIN_CONFIG.gib;
        return foe;
    }

}
