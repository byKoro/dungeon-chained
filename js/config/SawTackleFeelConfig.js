import { SAW_TACKLE } from './SawTackleConfig.js';

export const SAW_TACKLE_FEEL = {
    referenceSpeed: SAW_TACKLE.speed,
    maxFrameSeconds: 0.05,
    maxBursts: 12,
    pixel: 4,
    burstCone: 1.6,
    burstAngleStep: 2.399963,
    glowTextureSize: 128,
    thermal: { idle: '#96c4ff', warmSeconds: 0.45, coolSeconds: 0.45, minimumHeat: 0.001 },
    glowStops: [{ offset: 0, alpha: 'cc' }, { offset: 0.18, alpha: '80' },
        { offset: 0.45, alpha: '22' }, { offset: 1, alpha: '00' }],
    burst: { glowScale: 2, glowAlpha: 0.25, sparkGlowScale: 4, sparkGlowAlpha: 0.3,
        alpha: 0.75, distanceBase: 0.55, distanceVariation: 0.45, fadePower: 2 },
    reducedMotion: 0.35,
    impact: { seconds: 0.22, rays: 10, radius: 22, travel: 42, length: 18, dust: 12 },
    launch: { seconds: 0.18, rays: 6, radius: 18, travel: 32, length: 22 },
    bite: { seconds: 0.18, rays: 8, radius: 16, travel: 20, length: 12, shake: 9 },
    hit: { seconds: 0.12, rays: 7, radius: 12, travel: 24, length: 15, shake: 8, killShake: 12, blood: 7, spread: 0.8 },
    bounce: { seconds: 0.14, rays: 5, radius: 10, travel: 22, length: 10, shake: 3 },
    land: { seconds: 0.18, rays: 6, radius: 14, travel: 18, length: 9, dust: 9 },
    blade: { jitter: 4, jitterHz: 19, kickSeconds: 0.20, kickScale: 0.22, hitSeconds: 0.13, pulseScale: 0.12,
        glowScale: 1.45, flightGlowAlpha: 0.40, cutGlowAlpha: 0.55, cutPulseGlow: 0.25, frameRate: 2,
        steelShade: 0.62, crossAxisFrequency: 1.3, rimStart: 4.5, rimDark: [60, 18, 16], rimHot: [242, 157, 43] },
    cut: { emissionsPerSecond: 24, maxEmissionsPerFrame: 3, sparks: 3, power: 1.1, cone: 1.2 },
    trail: { width: 5, coreWidth: 2, orbit: 0.88, alpha: 0.65, glowStride: 3, glowAlpha: 0.16, rise: 14,
        segmentBase: 0.35, segmentVariation: 0.25, fadePower: 2, hotEvery: 3 },
    colors: { hot: '#ffc34d', flight: '#a52b20', metal: '#df4b20', stone: '#c83a19' },
    light: {
        flight: '190, 48, 22', cut: '230, 88, 29', stone: '220, 62, 24',
        flightRadius: 150, cutRadius: 175, cutStrength: 0.65, flightStrength: 0.5, burstRadius: 145, trailRadius: 50,
        maxBursts: 2, maxTrail: 2, flicker: 0.03, flatten: 0.85,
        burstRadiusStart: 0.6, burstRadiusGrow: 0.4, trailStrength: 0.45,
        falloff: [{ offset: 0, alpha: 0.95 }, { offset: 0.3, alpha: 0.55 },
            { offset: 0.55, alpha: 0.28 }, { offset: 0.78, alpha: 0.1 }, { offset: 1, alpha: 0 }]
    },
    audio: {
        attackTau: 0.025, releaseTau: 0.055, inactiveTau: 0.015,
        slowmoDepth: 0.2,
        minimumFlightSpeed: 3, hitVolume: 0.55,
        flightMinDb: -17, flightMaxDb: -8, flightRate: 0.9, flightRateDepth: 0.3,
        cutDb: -3, stoneDb: -5, cutRate: 1, stoneRate: 0.84,
        flightCutoff: 5200, cutCutoff: 11000, stoneCutoff: 7500,
        hitPulse: { cents: -160, gainDb: 2.5, hz: 16, decay: 0.035, duration: 0.12 },
        launchDuck: { db: -7, attackMs: 8, holdMs: 100, releaseMs: 350 }
    }
};
