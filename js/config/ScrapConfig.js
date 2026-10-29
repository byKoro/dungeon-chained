import { TILE } from './GameConfig.js';

// Sucata: moeda compartilhada da dupla. Tempos em steps de 60 Hz, distâncias em px de mundo.
export const SCRAP = Object.freeze({
    restSteps: 24,
    magnetRadius: 2.5 * TILE,
    magnetAccel: 0.55,
    magnetMaxSpeed: 9,
    vacuumAccel: 0.9,
    vacuumMaxSpeed: 15,
    collectRadius: 18,
    gravity: 0.38,
    bounce: 0.42,
    minBounceVz: 1.1,
    airDrag: 0.985,
    groundFriction: 0.8,
    burst: { speedMin: 1.2, speedMax: 3.4, vzMin: 4.5, vzMax: 7, startZ: 18 },
    enemyBurst: { speedMin: 0.6, speedMax: 2.2, vzMin: 3, vzMax: 5, startZ: 20 },
    pickupStreakMs: 900,
    pickupStreakMax: 10,
    pickupRateStep: 0.03,
    // Placeholder: arte da moeda até chegar o sprite da sucata.
    frames: [1, 2, 3, 4].map(i => `assets/coin/coin_${i}.png`),
    frameSteps: 8,
    drawSize: 32,
    shadowRadius: 7,
    drops: Object.freeze({ demon: 1, bloodMonster: 3, blackKnightB: 5 }),
    chestDefault: 10
});
