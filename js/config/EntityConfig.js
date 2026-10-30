import { DEMO_ENEMY_STATS } from './DemoCombatConfig.js';
import { TINY_RPG_ENEMIES } from './TinyRpgEnemies.js';
import { SUMMONER_SPRITE } from './SummonerConfig.js';

export function demonConfig(assets) {
    return {
        img: assets.demon, cellSize: 100,
        cropX: 28, cropY: 34, cropW: 52, cropH: 26, drawHeight: 82,
        rows: {
            walk: { row: 1, frames: 8, fps: 6 },
            attack: { row: 2, frames: 7, fps: 5, hitFrame: 5 },
            attack2: { row: 3, frames: 7, fps: 5, hitFrame: 4 },
            death: { row: 5, frames: 4, fps: 7 }
        },
        deathFlash: { row: 0, frame: 6 },
        gib: { gridCols: 5, gridRows: 4 }
    };
}

export function bloodMonsterConfig(assets) {
    return {
        img: assets.bloodMonster, cellSize: 100,
        cropX: 36, cropY: 30, cropW: 48, cropH: 30, drawHeight: 84,
        rows: {
            walk: { row: 1, frames: 8, fps: 6 },
            attack: { row: 2, frames: 8, fps: 5, hitFrame: 6 },
            attack2: { row: 3, frames: 8, fps: 5, hitFrame: 5 },
            death: { row: 5, frames: 4, fps: 7 }
        },
        deathFlash: { row: 0, frame: 6 },
        gib: { gridCols: 5, gridRows: 4 }
    };
}

export const MELEE_ENEMY_CONFIGS = [demonConfig, bloodMonsterConfig];

function tinyRpgConfig({ key, label, src, ...sprite }) {
    return (assets) => ({
        img: assets.get ? assets.get(key) : assets[key],
        ...sprite
    });
}

export const ENEMY_TYPES = [
    { key: "demon", label: "Demônio (Rápido)", config: demonConfig },
    { key: "bloodMonster", label: "Monstro de Sangue (Tanque)", config: bloodMonsterConfig },
    { key: 'assassin', label: 'Assassino', config: assets => ({ ...demonConfig(assets), combat: DEMO_ENEMY_STATS.assassin }) },
    { key: 'tank', label: 'Tanque', config: assets => ({ ...bloodMonsterConfig(assets), combat: DEMO_ENEMY_STATS.tank }) },
    ...['fireSkull', 'fireSkullBoss'].map(key => ({ key, label: key === 'fireSkullBoss' ? 'Boss Caveira de Fogo' : 'Caveira à distância',
        config: assets => ({ img: assets.get('fireSkull'), cellSize: 16, cropX: 0, cropY: 0, cropW: 16, cropH: 20, rows: { walk: { row: 0 } } }) })),
    ...TINY_RPG_ENEMIES.map(e => ({ key: e.key, label: e.label, src: e.src, config: tinyRpgConfig(e) })),
    // O Invocador reaproveita a folha do Cultista já carregada (key 'cultist').
    {
        key: SUMMONER_SPRITE.key, label: SUMMONER_SPRITE.label,
        config: assets => {
            const { key, label, src, ...sprite } = SUMMONER_SPRITE;
            return { img: assets.get ? assets.get('cultist') : assets.cultist, ...sprite };
        }
    }
];

export const ENEMY_TYPE_BY_KEY = Object.fromEntries(ENEMY_TYPES.map(t => [t.key, t]));

export function playerConfigs(assets) {
    return [
        {
            color: "#ffd166",
            controls: ["w", "s", "a", "d", " "],
            img: assets.p1,
            name: "Amarelo",
            sprite: {
                animated: true, frameCount: 8, cellSize: 100,
                cropX: 41, cropY: 37, cropW: 17, cropH: 23, drawHeight: 73,
                hurt: { img: assets.p1Hurt, frameCount: 5, hurtFrame: 2, cellSize: 100, cropX: 42, cropY: 38, cropW: 16, cropH: 22 },
                scared: { img: assets.p1Scared, frameCount: 8, cellSize: 100, cropX: 41, cropY: 37, cropW: 17, cropH: 23 }
            }
        },
        {
            color: "#6bb4db",
            controls: ["arrowup", "arrowdown", "arrowleft", "arrowright", "enter"],
            img: assets.p2,
            name: "Azul",
            sprite: {
                animated: true, frameCount: 8, cellSize: 100,
                cropX: 41, cropY: 37, cropW: 17, cropH: 23, drawHeight: 73,
                hurt: { img: assets.p2Hurt, frameCount: 5, hurtFrame: 2, cellSize: 100, cropX: 41, cropY: 37, cropW: 17, cropH: 23 },
                scared: { img: assets.p2Scared, frameCount: 8, cellSize: 100, cropX: 41, cropY: 37, cropW: 17, cropH: 23 }
            }
        }
    ];
}
