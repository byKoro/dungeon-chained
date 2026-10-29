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
