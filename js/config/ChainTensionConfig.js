export const CHAIN_TENSION = {
    anticipation: 0.10,
    effortEnter: 0.16,
    effortExit: 0.10,
    criticalEnter: 0.72,
    criticalExit: 0.60,
    attackTau: 0.025,
    releaseTau: 0.065,
    inactiveTau: 0.015,
    maxFrameSeconds: 0.05,
    settleSeconds: 0.22,
    snapSeconds: 0.24,
    expressions: { effort: 'raiva', critical: 'furia' },
    glow: {
        samples: 32, inset: 0.08,
        low: [154, 22, 40], medium: [245, 32, 40], high: [255, 114, 82],
        haloWidth: 34, bodyWidth: 16, coreWidth: 5,
        haloAlpha: 0.20, bodyAlpha: 0.42, coreAlpha: 0.85,
        pulseDepth: 0.22
    },
    motion: {
        pixel: 2, amplitude: 7, effortPower: 0.5, waveCycles: 3,
        hzMin: 5, hzMax: 16, pulseHzMin: 1.5, pulseHzMax: 5,
        anchorInset: 27, pulseRadius: 9, pulseTravel: 14,
        snapTravel: 18, settleAmplitude: 2,
        light: '#fff0c2', dark: '#9e713d', reduced: 0.35
    },
    audio: {
        silence: 0.015, minDb: -24, maxDb: -3,
        criticalDb: 2, rateMin: 0.78, rateMax: 1.32,
        cutoffMin: 1400, cutoffMax: 8500
    }
};
