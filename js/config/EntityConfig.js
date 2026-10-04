/**
 * EntityConfig — descrição (crop/animação) dos sprites de inimigos e jogadores.
 *
 * As configs recebem as imagens já carregadas (do AssetLoader) em vez de
 * criá-las, para manter a configuração separada do carregamento de assets.
 */

// ---- Inimigos melee ----

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

// Lista de fábricas de config de inimigos melee disponíveis.
export const MELEE_ENEMY_CONFIGS = [demonConfig, bloodMonsterConfig];

// ---- Jogadores ----
// Cada player: { color, controls, img, name, sprite }

export function playerConfigs(assets) {
    return [
        {
            color: "#ffd166",
            controls: ["w", "s", "a", "d"],
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
            controls: ["arrowup", "arrowdown", "arrowleft", "arrowright"],
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
