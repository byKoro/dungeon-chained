import { MeleeEnemy } from '../entities/MeleeEnemy.js';
import { GhostfireBoss } from '../entities/GhostfireBoss.js';
import { MELEE_ENEMY_CONFIGS, ENEMY_TYPE_BY_KEY } from '../config/EntityConfig.js';
import { BLOOD_STAIN_CONFIG } from '../config/GameConfig.js';

export class SpawnSystem {

    constructor({ assets, bloodCanvas }) {
        this.assets = assets;
        this.bloodCanvas = bloodCanvas;
    }

    randomMeleeConfig() {
        const factory = MELEE_ENEMY_CONFIGS[(Math.random() * MELEE_ENEMY_CONFIGS.length) | 0];
        return factory(this.assets);
    }

    createEnemy(x, y, floor, type = null) {
        const factory = (type && ENEMY_TYPE_BY_KEY[type]?.config) || null;
        const cfg = factory ? factory(this.assets) : this.randomMeleeConfig();
        const EnemyClass = type === "ghostfire" ? GhostfireBoss : MeleeEnemy;
        const foe = new EnemyClass(x, y, cfg.img, cfg, floor);
        foe.bloodPalette = this.bloodCanvas.palette;
        foe.gibStainConfig = BLOOD_STAIN_CONFIG.gib;
        return foe;
    }

}
