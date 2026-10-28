export const CULTIST = {
    hp: 2,
    speed: 1.4,
    preferredDistance: 440,
    distanceTolerance: 24,
    retreatProbeSteps: 12,
    castRange: 464,
    windupFrames: 45,
    recoverFrames: 70,
    playDeathAnimation: true,
    pillar: {
        radius: 30,
        firstFrame: 5,
        casterCropW: 30,
        damageFirstFrame: 8,
        damageLastFrame: 11,
        cropX: 70, cropY: 10, cropW: 30, cropH: 54,
        scale: 3, anchorX: 84, anchorY: 62
    }
};

export const CULTIST_SPRITE = {
    key: 'cultist', label: 'Cultista (Pilar de Fogo)', src: 'assets/enemies/cultist.png',
    cellSize: 100, cropX: 40, cropY: 20, cropW: 38, cropH: 46,
    body: { x: 43, y: 36, w: 21, h: 24 }, drawHeight: 138,
    combat: CULTIST,
    rows: {
        walk: { row: 1, frames: 8, fps: 7 },
        attack: { row: 3, frames: 14, fps: 6, hitFrame: 8 },
        death: { row: 5, frames: 10, fps: 7 }
    }
};
