// Feedback visual do Vínculo (cura por proximidade). Unidades: px de mundo e steps de 60 Hz.
// `pixel` = 1 px de arte (TILE 64 / 16), igual a HOLE_FX e SawTackleFeel.
export const COOP_HEAL_FEEL = Object.freeze({
    pixel: 4,
    // Centro do anel em relação ao jogador: mesmo ponto da sombra (`Renderer.drawRoundShadow`).
    footOffsetY: 17,
    colors: Object.freeze({
        dim: "#1f6b45",
        fill: "#5ef08f",
        head: "#e6ffd9",
        mote: Object.freeze(["#5ef08f", "#a6ffbf", "#e6ffd9"]),
        shard: "#3fae6c"
    }),
    fadeInSteps: 8,
    fadeOutSteps: 12,
    ring: Object.freeze({
        rx: 32, ry: 14,
        dimAlpha: 0.45,
        fillAlpha: 0.9,
        // A partir de `pulseFrom` do progresso o anel pisca, mais rápido quanto mais perto de curar.
        pulseFrom: 0.75, pulseDepth: 0.35, pulseHzMin: 2, pulseHzMax: 6
    }),
    motes: Object.freeze({
        // Partículas por step por jogador: `rateBase + rateGrow · progresso`.
        rateBase: 0.05, rateGrow: 0.18,
        // Nascem numa faixa perto do anel (fração do raio), para subir pelos lados do corpo e não cobrir o sprite.
        bandMin: 0.85, bandMax: 1.15,
        // Arco (rad) em volta das laterais esquerda/direita do anel onde nascem; fora dele ficariam sobre o corpo.
        sideArc: 0.8,
        riseMin: 0.35, riseMax: 0.8,
        wobble: 0.25, wobbleHz: 1.2,
        lifeMin: 36, lifeMax: 64,
        fadeFrom: 0.6,
        crossChance: 0.18,
        max: 90
    }),
    heal: Object.freeze({
        ringSteps: 26, ringFrom: 1, ringTo: 2.4,
        motes: 10, moteRiseBoost: 1.8,
        numberOffsetY: -46, numberColor: "#7dffa4",
        pulseSteps: 30
    }),
    // `holdSteps`: depois de quebrar, o anel novo espera este tempo antes de reaparecer (o carregamento já recomeçou).
    shards: Object.freeze({ count: 12, speed: 1.8, drag: 0.86, life: 16, holdSteps: 24 }),
    light: Object.freeze({
        color: "94, 240, 143",
        radius: 70, radiusGrow: 40, healRadius: 70,
        strengthMin: 0.25, strengthMax: 0.6, healStrength: 0.7,
        flatten: 0.6,
        falloff: Object.freeze([{ offset: 0, alpha: 0.9 }, { offset: 0.45, alpha: 0.4 }, { offset: 1, alpha: 0 }])
    }),
    reducedMotion: 0.35
});
