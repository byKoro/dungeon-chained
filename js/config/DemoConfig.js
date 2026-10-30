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
    messageSeconds: 3,
    aimThreshold: 0.5,
    sweepStep: 8
};

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
    chestRope: { label: 'Corda com baú (estaca)', color: '#f0b85a', symbol: 'B', scripted: true }
};

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
