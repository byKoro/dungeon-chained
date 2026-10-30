import { PLAYER_SAFE_ZONE } from './GameConfig.js';

// Cabo entre os jogadores (antes fixo no construtor do Game). Distâncias em px de mundo, tempos em steps de 60 Hz.
export const CHAIN = Object.freeze({
    rest: 130,
    stiffness: 0.02,
    breakDistance: 240,
    strainDistance: 165,
    strainLimit: 30,
    reconnectDistance: 110,
    pickupRadius: 60,
    snapImpulse: 12,
    playerSafeZone: PLAYER_SAFE_ZONE
});

// Serra largada empurrada pelos jogadores (sem dano). Velocidades em px/step, `share` = quanto da sobreposição
// a serra cede (o resto empurra o jogador de volta), `transfer` = fração do passo do jogador que vai para a serra.
export const SAW_PUSH = Object.freeze({
    radiusScale: 0.55,
    share: 0.3,
    transfer: 0.1,
    playerDrag: 0.25,
    friction: 0.88,
    // Teto enquanto alguém encosta (empurrão contínuo); solta, só o atrito freia.
    maxSpeed: 1.6,
    // Esbarrão forte (dash, knockback): chute de `kick` × velocidade, até `kickMax`.
    kick: 0.5,
    kickMax: 6,
    kickSteps: 10,
    wallBounce: 0.3,
    spinKick: 0.12,
    // Esbarrão: só a partir desta velocidade de aproximação, no máximo um a cada `bumpCooldown` steps.
    bumpSpeed: 1.2,
    bumpCooldown: 12,
    bumpPop: 0.3,
    bumpSparks: 3,
    bumpSound: Object.freeze({ cue: "sawLand", rate: 1.7, volume: 0.22 }),
    hardBumpSpeed: 6,
    hardBumpShake: 2,
    dustEvery: 6,
    dustSpeed: 1.4
});
