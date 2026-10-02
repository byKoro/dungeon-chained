import { MeleeEnemy } from '../entities/MeleeEnemy.js';
import { MELEE_ENEMY_CONFIGS } from '../config/EntityConfig.js';
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

    createEnemy(x, y, floor) {
        const cfg = this.randomMeleeConfig();
        const foe = new MeleeEnemy(x, y, cfg.img, cfg, floor);
        foe.bloodPalette = this.bloodCanvas.palette;
        foe.gibStainConfig = BLOOD_STAIN_CONFIG.gib;
        return foe;
    }

    /**
     * Popula uma sala de combate: distribui inimigos num anel ao redor do centro.
     * @param {object} bounds { minX, maxX, minY, maxY } bounds jogáveis da sala
     * @param {number} floor  andar atual (influencia a quantidade)
     * @returns {MeleeEnemy[]}
     */
    populateRoom(bounds, floor) {
        const cx = (bounds.minX + bounds.maxX) / 2;
        const cy = (bounds.minY + bounds.maxY) / 2;
        const count = 3 + Math.floor(Math.random() * 3) + Math.floor(floor / 2);

        const enemies = [];
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * Math.PI * 2;
            const ex = cx + Math.cos(angle) * (bounds.maxX - bounds.minX) * 0.28;
            const ey = cy + Math.sin(angle) * (bounds.maxY - bounds.minY) * 0.28;
            enemies.push(this.createEnemy(ex, ey, floor));
        }
        return enemies;
    }
}
