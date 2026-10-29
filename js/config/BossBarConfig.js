// Barra de vida de chefe (desenhada em coordenadas de tela, na parte inferior).
export const BOSS_BAR = Object.freeze({
    // Escala do pixel da barra: altura da tela / divisor, no mínimo minScale.
    scaleDivisor: 200,
    minScale: 2,
    // Medidas em pixels lógicos (antes da escala).
    barHeight: 9,
    padding: 3,
    labelGap: 3,
    // Largura em pixels de tela: a barra ocupa o espaço livre entre os retratos, dentro destes limites.
    minWidth: 220,
    maxWidth: 640,
    sideGap: 6,
    fadeSeconds: 0.25,
    // Tempo para o rastro de dano alcançar a vida atual.
    trailSeconds: 0.9,
    colors: {
        text: '#f4e3c1',
        well: '#1c0a10',
        fillDark: '#5c0f1c',
        fill: '#a3192b',
        fillLight: '#d63a4a',
        trail: '#e8c9a0',
        phaseMark: '#0b0910'
    }
});
