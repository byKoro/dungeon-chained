export const DEMO = {
    manifest: 'map/demo/active.json',
    sessionKey: 'editor2_playtest',
    // Variações de chão do tileset (linhas 0–2, colunas 6–9).
    floorTiles: [16, 6, 7, 8, 9, 17, 18, 19, 26, 27, 28, 29],
    propTiles: [59, 77, 68, 64],
    interactionRadius: 88,
    cameraMargin: 120,
    cameraMode: 'zoom',
    // Aproximação da câmera dos mapas do Editor 2.0 sobre o enquadramento de uma sala 14×9.
    cameraZoom: 1.2,
    gateFrameMs: 200,
    // Portão do boss trancado fica em destaque: luz vermelha pulsando (raio em px de mundo, período em ms reais).
    gateHighlight: { radius: 170, pulse: 0.22, periodMs: 1800, lift: 0.4 },
    // Metade da abertura do sprite do portão (22 px de arte × 4); os pilares bloqueiam o resto.
    gatePassHalfWidth: 44,
    throwSpeed: 18,
    throwFriction: 0.985,
    throwMinSpeed: 1,
    throwBounce: 0.85,
    ropeRadius: 34,
    keyDropSeconds: 0.4,
    keyHeight: 48,
    aimThreshold: 0.5,
    sweepStep: 8,
    // Chave coletável: sprite 16×16 desenhado em escala inteira (pixels crespos), flutuando com brilho e reflexo
    // como a serra largada. Px de mundo; fases em rad/step de 60 Hz; tempos de celebração em steps.
    key: Object.freeze({
        artScale: 5,            // 16 px × 5 = 80 px, escala inteira (sem serrilhado)
        bobAmp: 6, bobSpeed: 0.06,   // flutuação (igual à serra: sin(phase) * amp)
        floatHeight: 14,        // repouso um tiquinho acima do chão
        frameMs: 150,           // troca de quadro da chave (demoKey1..4)
        // Reflexo transversal igual ao da serra largada (_buildBeam): faixa diagonal estreita varrendo o sprite.
        shineSpeed: 0.03, shineAlpha: 0.85,
        // Sombra pixelada (em px de arte da chave): elipse em blocos que encolhe/clareia conforme a chave sobe.
        shadow: Object.freeze({ w: 6, h: 2, baseAlpha: 0.38, hoverFade: 0.14, offsetY: 16 }),
        // Luz leve que a chave emite (px de mundo), pulsando com a flutuação. O sprite em si não escurece (máscara).
        light: Object.freeze({ radius: 95, pulse: 0.12 }),
        // Pegar: pop-out (incha com overshoot, pisca branco no pico, encolhe até sumir; sem girar) + burst pixelado + zoom.
        pickup: Object.freeze({
            celebrateSteps: 22, growSteps: 6, peakScale: 1.45, stretch: 0.3, flashSteps: 3, rise: 18,
            zoomPunch: 0.08, zoomHold: 8, shake: 6, hitStop: 0.04,
            sparks: 26, sparksPower: 1.3, flash: 18, dust: 12, reburstEvery: 7, reburstSparks: 8,
            sound: "keyCollect", soundRate: 1
        })
    })
};

// Botas flutuando sobre a bigorna da sala "botas": item que concede o dash ao ser pego por proximidade.
// Mesmo visual da chave/serra largada. Px de mundo; fases em rad/step de 60 Hz; tempos em steps.
export const BOOTS = Object.freeze({
    assetKey: "boots",
    artScale: 4,                 // 16 px × 4 = 64 px
    liftTiles: 0.9,              // altura do flutuar acima do topo da bigorna (tiles)
    pickupRadius: DEMO.interactionRadius,   // ~88 px: um jogador perto pega (sem botão)
    bobAmp: 5, bobSpeed: 0.06,
    // Reflexo transversal da serra largada (_buildBeam): faixa diagonal estreita varrendo o sprite.
    shineSpeed: 0.03, shineAlpha: 0.85,
    // Sombra pixelada (px de arte da bota) no tampo da bigorna; `offsetY` em px de mundo abaixo do centro em repouso.
    shadow: Object.freeze({ w: 6, h: 2, baseAlpha: 0.38, hoverFade: 0.14, offsetY: 40 }),
    // Luz leve (KEY_LIGHT) pulsando com a flutuação. O sprite em si não escurece (máscara).
    light: Object.freeze({ radius: 95, pulse: 0.12 }),
    // Pegar: pop-out da chave (incha com overshoot, pisca branco, encolhe esticando; sem girar) + burst + zoom.
    pickup: Object.freeze({
        celebrateSteps: 24, growSteps: 6, peakScale: 1.5, stretch: 0.3, flashSteps: 3, rise: 22,
        zoomPunch: 0.08, zoomHold: 8, shake: 10, hitStop: 0.06,
        sparks: 26, sparksPower: 1.3, flash: 18, dust: 12,
        reburstEvery: 7, reburstSparks: 9, sound: "sawPickup", soundRate: 1.1
    }),
    // Cinemática de entrada (BotasRoomScript): holds em steps, zoom relativo ao enquadramento.
    cinematic: Object.freeze({
        chestZoom: 1.25, bootsZoom: 1.5,
        chestHoldSteps: 26, bootsHoldSteps: 48, panSteps: 22, startDelaySteps: 10,
        cardText: "ability.dash"
    })
});

// Distância máxima entre os jogadores = enquadramento normal da câmera (sem afastar o zoom), por eixo.
// O freio começa quando um jogador sairia da margem da câmera (`softMargin`) e vira parede a `hardMargin` da borda
// da tela (meio corpo). Px de mundo; `resistance` = quanto da velocidade de afastar some por step no limite duro.
export const PLAYER_LEASH = Object.freeze({
    enabled: true,
    softMargin: DEMO.cameraMargin,
    hardMargin: 40,
    resistance: 0.45,
    // Deslocamento num step acima disso é teletransporte (porta, renascer): o limite só passa a valer dali.
    teleportStep: 96,
    dust: Object.freeze({ minSpeed: 1.2, count: 3, cooldownSteps: 14 })
});

export const INTERACTIVES = {
    altarDash: { label: 'Altar: Dash', color: '#68dbff', symbol: 'D' },
    altarSaw: { label: 'Altar: Lançar serra', color: '#e9a55e', symbol: 'S' },
    lever: { label: 'Alavanca + ponte', color: '#a6e88b', symbol: 'L' },
    ropeKey: { label: 'Corda + chave', color: '#ffe083', symbol: 'K' },
    key: { label: 'Chave coletável', color: '#ffe083', symbol: 'K' },
    // Encontro das gaiolas (scripts de sala): não são ativados por interagir.
    rope: { label: 'Corda com gaiola (estaca)', color: '#d8c39a', symbol: 'C', scripted: true },
    // Corda com baú: o baú com `rope` = id desta estaca cai quando a serra corta a corda.
    chestRope: { label: 'Corda com baú (estaca)', color: '#f0b85a', symbol: 'B', scripted: true },
    // Corda com grade: cortar a corda levanta os tiles de grade (`gate`) desta estaca, abrindo a passagem.
    gateRope: { label: 'Corda com grade (estaca)', color: '#7fd6c0', symbol: 'G', scripted: true }
};

// Luz leve da chave coletável: azul-prata frio, queda curta (não ilumina a sala, só um respiro em volta).
export const KEY_LIGHT = Object.freeze({
    color: "185, 215, 255",
    flickerBase: 1, flickerSine: 0.04, flickerNoise: 0.01,
    falloff: Object.freeze([
        Object.freeze({ offset: 0.0, alpha: 0.45 }),
        Object.freeze({ offset: 0.4, alpha: 0.2 }),
        Object.freeze({ offset: 0.75, alpha: 0.06 }),
        Object.freeze({ offset: 1.0, alpha: 0 })
    ])
});

export const BOSS_GATE_LIGHT = Object.freeze({
    color: "235, 56, 72",
    flickerBase: 1, flickerSine: 0.05, flickerNoise: 0.03,
    falloff: Object.freeze([
        Object.freeze({ offset: 0.0, alpha: 0.75 }),
        Object.freeze({ offset: 0.3, alpha: 0.4 }),
        Object.freeze({ offset: 0.65, alpha: 0.14 }),
        Object.freeze({ offset: 1.0, alpha: 0 })
    ])
});
