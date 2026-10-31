export const TILE = 64;
export const ROOM_COLS = 14;
export const ROOM_ROWS = 9;
export const EMPTY_FLOOR_TILE = -2;
export const EMPTY_FLOOR_COLOR = "#25131a";
export const GRID_COLS = 3;
export const GRID_ROWS = 7;
export const WORLD_W = GRID_COLS * ROOM_COLS * TILE;
export const WORLD_H = GRID_ROWS * ROOM_ROWS * TILE;
export const ROOM_COUNT = 8;
export const BLOOD_COLORS = ["#4a0612", "#5c0a18", "#6e0f1c", "#480810", "#3a0510"];
export const BLOOD_PIXEL = TILE / 16;
export const BLOOD_STAIN_CONFIG = {
    gib: { count: 3, life: Infinity, sizeMin: 2, sizeMax: 4, alpha: 0.9 }
};
export const BLOOD_STEPS = 6;

export const MAX_ACTIVE_GIBS = 90;
export const MAX_FOOTPRINTS = 60;

export const CAM_MARGIN = 30;

export const CAMERA_DRONE = {
    enabled: true,
    maxOffset: 70,
    responseVel: 4.2,
    stiffness: 42,
    damping: 7.5
};

export const TRANSITION_SPEED = 0.05;

export const SIM_HZ = 60;
export const SIM_STEP = 1 / SIM_HZ;

export const MAX_SIM_STEPS_PER_FRAME = 5;

export const HIT_SLOWMO = {
    duration: 0.22,
    minScale: 0.25
};

// Pausa curta da simulação em tempo real a cada acerto; render e câmera seguem ativos.
export const HIT_STOP = {
    min: 0.02,
    max: 0.10,
    // Folga mínima depois de um hit stop antes de aceitar outro: evita travar o jogo em sequências.
    minGap: 0.08
};

export const ROOM_INTRO = {
    enabled: true,
    zoomFactor: 1.35,
    zoomInTime: 0.5,
    spawnHold: 0.7,
    zoomOutTime: 0.45
};

export const DOOR_STUB_TILES = 2;
export const DOOR_ENTER_DEPTH = 70;

// Folga para o player subir um pouco "para dentro" das paredes superiores (salas do Editor 2.0),
// dando a sensação de encostar/sobrepor a parede de cima. 20% de um tile.
export const TOP_WALL_CLIMB = TILE * 0.2;

export const PLAYER_DOOR_SPAWN_TILES = {
    N: {
        p1: { col: 6, row: 1 },
        p2: { col: 7, row: 1 }
    },
    S: {
        p1: { col: 6, row: ROOM_ROWS - 2 },
        p2: { col: 7, row: ROOM_ROWS - 2 }
    },
    W: {
        p1: { col: 1, row: 3 },
        p2: { col: 1, row: 4 }
    },
    E: {
        p1: { col: ROOM_COLS - 2, row: 3 },
        p2: { col: ROOM_COLS - 2, row: 4 }
    },
    CENTER: {
        p1: { col: 6, row: 4 },
        p2: { col: 7, row: 4 }
    }
};

export function getPlayerSpawnPositions(entryDoorDir, x0 = 0, y0 = 0, tilePx = TILE) {
    const rule = PLAYER_DOOR_SPAWN_TILES[entryDoorDir] || PLAYER_DOOR_SPAWN_TILES.CENTER;
    return {
        entryDir: entryDoorDir,
        p1: {
            col: rule.p1.col,
            row: rule.p1.row,
            x: x0 + (rule.p1.col + 0.5) * tilePx,
            y: y0 + (rule.p1.row + 0.5) * tilePx
        },
        p2: {
            col: rule.p2.col,
            row: rule.p2.row,
            x: x0 + (rule.p2.col + 0.5) * tilePx,
            y: y0 + (rule.p2.row + 0.5) * tilePx
        }
    };
}

export { AUDIO_CONFIG, AUDIO_CLIPS } from './AudioConfig.js';

export const PLAYER_SAFE_ZONE = 46;

export const HEART_DROP = {
    chance: 15,
    maxLives: 3
};

export const BACKGROUND_TILE = 78;

export const HOLE_TILE = -1;

// Pés no tile do buraco = queda imediata. A resistência fica no piso: faixa de `edgeMargin` px antes da borda.
export const HOLE_FALL = Object.freeze({
    edgeMargin: 20,
    footOffset: 14,
    inwardDamping: 0.7,
    pushBack: 0.9,

    livesLost: 1,
    respawnInvulnFrames: 90
});

// Só com a corrente arrebentada. 9 × 12 px ≈ 108 px: cruza vão de 1 tile, nunca 2.
export const PLAYER_DASH = Object.freeze({
    speed: 12,
    durationSteps: 9,
    exitSpeed: 4.2,
    cooldownSteps: 60,
    afterimages: 4,
    afterimageEvery: 2,
    afterimageAlpha: 0.7,
    afterimageLife: 10,
    afterimageTint: 0.92,
    dustCount: 6,
    ringDust: 8,
    landDust: 5,
    // Visual apenas: estica na direção do dash, achata ao parar e volta com overshoot.
    stretch: 0.32,
    landSquash: 0.28,
    landSteps: 9,
    flashSteps: 4,
    shake: 2.5,
    landStepRate: 0.85
});

export const HOLE_FX = Object.freeze({
    pixel: 4,
    color: "132, 100, 96",
    maxMotes: 140,

    dust: {
        lipRate: 0.012,
        sideRate: 0.004,
        alpha: 0.7,
        gravity: 0.025,
        maxSpeed: 1.6,
        drift: 0.12,
        life: [50, 90],
        fadeDepth: 52
    },

    crumbs: {
        edgeRate: 0.18,
        fallBurst: 9,
        alpha: 0.9,
        gravity: 0.09,
        maxSpeed: 3.2,
        spread: 1.1,
        bigChance: 0.3,
        life: [24, 40],
        fadeDepth: 60
    },

    fall: {
        sink: 34,
        darken: 0.85,
        lightMin: 0.3
    }
});

// Blob autotile, art from scripts/gen-hole-tiles.py (--js prints this table).
// Bit set = that neighbour is not a hole. Edges 1 N, 2 E, 4 S, 8 W; inner corners
// 16 NW, 32 NE, 64 SE, 128 SW only count when both orthogonals beside them are holes.
export const HOLE_TILES = Object.freeze({
    0: 116, 1: 103, 2: 105, 3: 102, 4: 104, 5: 115, 6: 109, 7: 112,
    8: 106, 9: 101, 10: 114, 11: 110, 12: 107, 13: 113, 14: 111, 15: 100,
    16: 120, 18: 121, 20: 122, 22: 123, 32: 124, 36: 125, 40: 126, 44: 127,
    48: 128, 52: 129, 64: 130, 65: 131, 72: 132, 73: 133, 80: 134, 96: 135,
    104: 136, 112: 137, 128: 138, 129: 139, 130: 140, 131: 141, 144: 142, 146: 143,
    160: 144, 176: 145, 192: 146, 193: 147, 208: 148, 224: 149, 240: 150
});

export function holeMask(isHole, col, row) {
    let mask = 0;
    if (!isHole(col, row - 1)) mask |= 1;
    if (!isHole(col + 1, row)) mask |= 2;
    if (!isHole(col, row + 1)) mask |= 4;
    if (!isHole(col - 1, row)) mask |= 8;
    if (!(mask & 9) && !isHole(col - 1, row - 1)) mask |= 16;
    if (!(mask & 3) && !isHole(col + 1, row - 1)) mask |= 32;
    if (!(mask & 6) && !isHole(col + 1, row + 1)) mask |= 64;
    if (!(mask & 12) && !isHole(col - 1, row + 1)) mask |= 128;
    return mask;
}

export function holeTileForMask(mask) {
    return HOLE_TILES[mask] ?? HOLE_TILES[mask & 15];
}

export function holeTileFor(floor, col, row) {
    const isHole = (c, r) => {
        const line = floor[r];
        return !!line && line[c] === HOLE_TILE;
    };
    return holeTileForMask(holeMask(isHole, col, row));
}

export const PROP_SCATTER = {

    floorTiles: [16],

    tiles: [59, 77, 68, 64],

    defaultDensity: 0.08,
    minDensity: 0.0,
    maxDensity: 0.4
};

export function scatterPropsOnFloor(floor, opts = {}) {
    const density = Math.max(0, Math.min(1, opts.density ?? PROP_SCATTER.defaultDensity));
    const propTiles = opts.tiles && opts.tiles.length ? opts.tiles : PROP_SCATTER.tiles;
    const occupied = opts.occupied || new Set();
    const rng = opts.rng || Math.random;
    const rows = floor.length;
    const cols = rows > 0 ? floor[0].length : 0;

    const candidates = [];
    for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
            const idx = floor[r][c];
            if (idx < 0) continue;
            if (!PROP_SCATTER.floorTiles.includes(idx)) continue;
            if (occupied.has(`${c},${r}`)) continue;
            candidates.push({ col: c, row: r });
        }
    }

    const target = Math.round(candidates.length * density);

    for (let i = candidates.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const out = [];
    for (let i = 0; i < target && i < candidates.length; i++) {
        const { col, row } = candidates[i];
        const index = propTiles[(rng() * propTiles.length) | 0];
        out.push({ col, row, index, flip: rng() < 0.5 });
    }
    return out;
}

export const PLAYER_LIGHT_RADIUS = 260;

export const LIGHT_PIXEL_SCALE = 1.5;

export const TORCHES = {
    enabled: true,
    index: 90,
    sideIndex: 91,

    light: {
        pixelScale: 1.2,

        offsetY: 26,
        offsetX: 22,
        color: "255, 190, 110",

        flickerSpeed: 0.1,
        flickerBase: 0.94,
        flickerSine: 0.045,
        flickerNoise: 0.03,

        wash: {
            enabled: false,

            depth: 300,
            falloff: [
                { offset: 0.0, alpha: 0.42 },
                { offset: 0.35, alpha: 0.2 },
                { offset: 0.7, alpha: 0.06 },
                { offset: 1.0, alpha: 0.0 }
            ]
        },

        area: {
            radius: 240,
            flatten: 1,
            pushIn: 70,

            falloff: [
                { offset: 0.0, alpha: 0.9 },
                { offset: 0.2, alpha: 0.62 },
                { offset: 0.4, alpha: 0.38 },
                { offset: 0.6, alpha: 0.2 },
                { offset: 0.78, alpha: 0.09 },
                { offset: 0.9, alpha: 0.03 },
                { offset: 1.0, alpha: 0.0 }
            ]
        },

        glow: {
            radius: 60,
            flatten: 0.95,
            falloff: [
                { offset: 0.0, alpha: 0.85 },
                { offset: 0.45, alpha: 0.4 },
                { offset: 0.75, alpha: 0.14 },
                { offset: 1.0, alpha: 0.0 }
            ]
        }
    }
};

export const DOOR_LIGHT = {
    enabled: true,

    length: 180,
    spread: 0.5,

    startFade: 0.22,

    pixelScale: 1.3,
    color: "255, 225, 90",

    flashDuration: 1.6,
    pulseSpeed: 10,
    pulseDepth: 0.18,
    fadeExponent: 1.6
};

export const WIND = {
    enabled: true,
    count: 60,
    layer: "world",

    speed: 2.6,
    angle: 0.15,
    angleDrift: 0.0025,
    angleDriftRange: 0.5,

    gustSpeed: 0.012,
    gustMin: 0.45,
    gustMax: 1.35,

    sway: 0.6,
    swaySpeed: 0.05,
    speedVariation: 0.5,

    color: "200, 195, 180",
    alphaMin: 0.06,
    alphaMax: 0.22,
    sizeMin: 2,
    sizeMax: 4,
    streak: 2.2,

    margin: 120
};

export const POST_PROCESSING = {
    enabled: true,

    vignette: {
        enabled: true,
        innerRadius: 0.55,
        strength: 0.7,
        color: "8, 5, 12",
        midStop: 0.7,
        midAlphaFactor: 0.45
    },

    lighting: {
        enabled: true,
        ambient: "41, 35, 53",
        lightColor: "255, 220, 150",
        flatten: 1,

        flickerSpeed: 0.005,
        flickerBase: 0.5,
        flickerSine: 0.05,
        flickerNoise: 0.03,

        falloff: [
            { offset: 0.0, alpha: 1.0 },
            { offset: 0.25, alpha: 0.6 },
            { offset: 0.45, alpha: 0.35 },
            { offset: 0.65, alpha: 0.17 },
            { offset: 0.82, alpha: 0.07 },
            { offset: 1.0, alpha: 0.0 }
        ]
    }
};

export const HAZARDS = {

    spike: {
        size: TILE,
        damageRadius: 26,
        drawSize: TILE * 0.9
    },

    arrowTrap: {
        intervalFrames: 90,
        warnFrames: 34,
        indicatorSize: 20,
        indicatorColor: "#ffd166",
        indicatorWarnColor: "#ff5470"
    },
    arrow: {
        speed: 4.5,
        length: 26,
        width: 5,
        hitRadius: 10,
        color: "#f4e9c1",
        headColor: "#ff5470",
        maxLifeFrames: 360
    },

    button: {
        radius: 26,
        pressRadius: 26,
        pressYScale: 1.5,
        footOffset: 15,
        capOffsetY: -4,
        frameSize: 16,
        drawSize: 64,

        assistRadius: 46,
        assistStrength: 0.12,

        pressSquash: 0.24,
        releaseStretch: 0.14,
        springK: 0.28,
        springDamp: 0.34,
        baseColor: "#3a2f4a",
        ringColor: "#8a7fb0",
        idleColor: "#6bb4db",
        pressedColor: "#54d98b",
        pulseSpeed: 0.08
    },

    challenge: {
        holdFrames: 10,
        barrierColor: "#2a2330",
        barrierGlow: "#e53170"
    }
};

// Espaço/Enter/A também são dash: quem aperta no instante da morte não reinicia sem ver a tela.
export const GAME_OVER_INPUT_DELAY_MS = 400;

export const MENU_PAD = {
    buttons: { a: 0, b: 1, start: 9, up: 12, down: 13, left: 14, right: 15 },
    axisThreshold: 0.6,
    repeatDelayMs: 350,
    repeatMs: 110
};
