export const ARAUTO_AUDIO = {
    grind: { minimumSpin: 0.1, power: 0.5, rateMin: 0.78, rateMax: 1.15, cutoffMin: 4500, cutoffMax: 14000 },
    dash: { level: 0.85, rate: 0.85, phaseRate: 0.12, cutoff: 3000, minimumSpeed: 0.1 },
    attackTau: 0.02,
    releaseTau: 0.035,
    inactiveTau: 0.01,
    contactTolerance: 0.5,
    slowmoDepth: 0.12,
    groundDuck: { db: -6, attackMs: 5, holdMs: 100, releaseMs: 500 },
    slamDuck: { db: -10, attackMs: 5, holdMs: 180, releaseMs: 800 }
};
