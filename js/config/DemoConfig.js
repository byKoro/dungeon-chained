export const DEMO = {
    manifest: 'map/demo/active.json',
    sessionKey: 'editor2_playtest',
    // Variações de chão do tileset (linhas 0–2, colunas 6–9).
    floorTiles: [16, 6, 7, 8, 9, 17, 18, 19, 26, 27, 28, 29],
    propTiles: [59, 77, 68, 64],
    interactionRadius: 88,
    cameraMargin: 120,
    cameraMode: 'zoom',
    gateFrameMs: 200,
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

export const INTERACTIVES = {
    altarDash: { label: 'Altar: Dash', color: '#68dbff', symbol: 'D' },
    altarSaw: { label: 'Altar: Lançar serra', color: '#e9a55e', symbol: 'S' },
    lever: { label: 'Alavanca + ponte', color: '#a6e88b', symbol: 'L' },
    ropeKey: { label: 'Corda + chave', color: '#ffe083', symbol: 'K' },
    key: { label: 'Chave coletável', color: '#ffe083', symbol: 'K' }
};
