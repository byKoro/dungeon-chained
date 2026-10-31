import { TILE } from './GameConfig.js';

// Encontro das gaiolas (script do salão): cada estaca segura, por uma corda vertical, uma gaiola lá no alto.
// Distâncias em px de mundo, tempos em steps de 60 Hz, hit stop em segundos.
export const CAGE = Object.freeze({
    width: 1.5 * TILE,
    art: 4,
    // Geometria dos sprites (pixels de arte): fundo do corpo da gaiola, estaca e nó.
    sprite: Object.freeze({
        w: 24, bodyBottom: 28, groundOffset: 20,
        stakeW: 10, stakeH: 16, knotY: 6.5, stakeFoot: 20,
        ropeThick: 10
    }),
    // A serra (disco) passando pela estaca corta a corda.
    stakeRadius: 0.3 * TILE,
    stakeHitY: -10,
    // Corpo sólido da estaca: círculo no chão, `bodyY` px acima da base do sprite; bloqueia os pés e a serra largada.
    stakeBody: Object.freeze({ radius: 14, bodyY: 8 }),
    nearRadius: 2 * TILE,
    ropeUp: 6 * TILE,
    ropeFade: 0.45,
    swayAmp: 3,
    retractSpeed: 0.035,
    // Corte → aviso (sombra crescendo, poeira caindo do teto) → queda → impacto.
    cut: Object.freeze({ hitStop: 0.05, shake: 6, zoomPunch: 0.02, sparks: 14, stakeFlashSteps: 16, squash: 0.35 }),
    warnSteps: 30,
    fallHeight: 7 * TILE,
    fallSteps: 36,
    fallSpin: 0.5,
    ceilingDustEvery: 4,
    impact: Object.freeze({
        hitStop: 0.07, shake: 13, zoomPunch: 0.05, flash: 14, sparks: 22, dust: 18,
        pushRadius: 2.4 * TILE, pushForce: 13
    }),
    debrisSteps: 300,
    brokenScrap: 2,
    // Monstros saltando de dentro da gaiola quebrada até um tile de piso alcançável.
    jump: Object.freeze({ delay: 10, stagger: 7, steps: 28, height: 76, holdSteps: 10, shake: 3, dust: 6 }),
    landMinTiles: 1,
    landMaxTiles: 3,
    // Baú do encontro: cai da última corda quando a última leva morre.
    chest: Object.freeze({
        delay: 30, warnSteps: 24, fallSteps: 30, fallHeight: 7 * TILE, squashSteps: 26, openDelay: 34,
        hitStop: 0.1, shake: 17, zoomPunch: 0.08, flash: 18, sparks: 26, dust: 24,
        pushRadius: 2.8 * TILE, pushForce: 17
    }),
    // Luz quente na estaca ainda inteira (mais forte com a serra perto).
    // Pontos fracos ao longo da corda (fração de ropeUp) para ela não sumir no escuro.
    light: Object.freeze({ idleRadius: 90, nearRadius: 130, ropeAt: Object.freeze([0.3, 0.6]), ropeRadius: 46 }),
    colors: Object.freeze({
        rope: "#a8875a", shadow: "rgba(0, 0, 0, 0.42)", ring: "#ffd98a", shine: "#fff4c8"
    })
});

// Corda com baú: mesma estaca e mesma queda do baú do encontro; o baú marcado com o id da corda cai no próprio tile
// quando qualquer disco girando (preso, lançado ou solto por Inércia) passa pela estaca.
export const ROPE_CHEST = Object.freeze({
    ...CAGE,
    chestGround: 26,
    light: Object.freeze({ idleRadius: 70, nearRadius: 120, ropeAt: Object.freeze([0.3]), ropeRadius: 40 })
});

export const STAKE_LIGHT = Object.freeze({
    color: "255, 196, 120",
    flickerBase: 1, flickerSine: 0.06, flickerNoise: 0.02,
    falloff: Object.freeze([
        Object.freeze({ offset: 0.0, alpha: 0.7 }),
        Object.freeze({ offset: 0.35, alpha: 0.35 }),
        Object.freeze({ offset: 0.7, alpha: 0.12 }),
        Object.freeze({ offset: 1.0, alpha: 0 })
    ])
});

// Grades nos acessos da zona enquanto um encontro está ativo.
// Grade levadiça: sprites em assets/bars (scripts/gen-bars-sprites.py), um tile 16x16 com a altura da parede de
// frente. A treliça some atrás da verga e despenca dela. Steps de 60 Hz; `art` em pixels de arte (1 = TILE/16 px).
export const BARS = Object.freeze({
    art: Object.freeze({ frameH: 16, gateH: 10, lintel: 6, travel: 8 }),
    anticSteps: 12,
    dropSteps: 10,
    bounceSteps: 8,
    bouncePx: 2,
    raiseSteps: 48,
    solidAt: 0.7,
    shake: 7,
    hitStop: 0.04,
    sparks: 3,
    landDust: 3,
    shadow: "#25131a"
});

// Mapas com bigorna: perder todas as vidas faz a dupla renascer no início, sem game over.
export const RUN_DEATH = Object.freeze({
    invulnSteps: 120,
    fadeSeconds: 0.9
});
