// Barra de vida de chefe (desenhada em coordenadas de tela, na parte inferior).
export const BOSS_BAR = Object.freeze({
    // Escala do pixel da barra: altura da tela / divisor, no mínimo minScale.
    scaleDivisor: 200,
    minScale: 2,
    // Medidas em pixels lógicos (antes da escala).
    barHeight: 13,
    padding: 3,
    // Nome: escala do texto (em pixels lógicos; 1 já fica grande, pois o pixel da barra é de 4–5 px de tela)
    // e espaço entre a placa de nome e a barra.
    nameScale: 1,
    plateGap: 2,
    emblemSize: 11,
    // Largura em pixels de tela: a barra ocupa o espaço livre entre os retratos, dentro destes limites.
    minWidth: 240,
    maxWidth: 760,
    sideGap: 6,
    fadeSeconds: 0.25,
    // Tempo para o rastro de dano alcançar a vida atual.
    trailSeconds: 0.9,
    // Marcações de 10% em 10% sobre a vida.
    tickEvery: 0.1,
    // Pulso do brilho na fase 2 (ciclos por segundo).
    pulseHz: 1.6,
    colors: {
        text: '#f6e7c8',
        textLow: '#ffb347',
        textOutline: '#0b0910',
        well: '#1c0a10',
        trail: '#e8c9a0',
        tick: '#0b0910',
        phaseMark: '#0b0910',
        // [claro, médio, escuro] do preenchimento por fase.
        fill: [['#e0453a', '#a3192b', '#5c0f1c'], ['#ffc65c', '#e8622a', '#9a2a14']],
        trackBack: '#3a0d16',
        emblemBack: '#2a1018',
        flame: { o: '#e8622a', y: '#ffd36b', d: '#7a1d12' }
    }
});
