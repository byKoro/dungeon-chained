// Barra de vida de chefe (desenhada em coordenadas de tela, na parte inferior).
export const BOSS_BAR = Object.freeze({
    // Escala do pixel da barra: altura da tela / divisor, no mínimo minScale.
    scaleDivisor: 200,
    minScale: 2,
    // Medidas em pixels lógicos (antes da escala). barHeight + padding * 2 = 19 = altura do botão RESUME
    // (moldura de pedra + face de 11 px + lábio de 2 px): a barra reaproveita esse desenho.
    barHeight: 13,
    padding: 3,
    // Espaço abaixo da moldura para a sombra e os pingos de lava.
    dripRoom: 5,
    // Nome: escala do texto (em pixels lógicos; 1 já fica grande, pois o pixel da barra é de 4–5 px de tela)
    // e espaço entre a placa de nome e a barra.
    nameScale: 1,
    plateGap: 2,
    // Largura em pixels de tela: a barra ocupa o espaço livre entre os retratos, dentro destes limites.
    minWidth: 240,
    maxWidth: 760,
    sideGap: 6,
    fadeSeconds: 0.25,
    // Tempo para o rastro de dano alcançar a vida atual.
    trailSeconds: 0.9,
    // Marcações de 10% em 10% sobre a vida.
    tickEvery: 0.1,
    // Pulso do brilho na fase 2 e dos pingos de lava (ciclos por segundo).
    pulseHz: 1.6,
    dripPulseHz: 0.6,
    // Pingos de lava pendurados na moldura: [posição relativa à largura, comprimento em px], como no RESUME.
    drips: [[0.22, 3], [0.27, 1], [0.71, 2]],
    colors: {
        text: '#f6e7c8',
        textLow: '#ffb347',
        textOutline: '#0b0910',
        trail: '#e8c9a0',
        tick: '#0b0910',
        phaseMark: '#0b0910',
        // Face da vida por fase: fase 1 = vermelho do botão RESUME (FACES.red), fase 2 = lava do Arauto.
        face: [
            { base: '#8a1424', light: '#c22a3c', dark: '#6e0f1c', spec: '#ff6b7a', lip: '#3d0710' },
            { base: '#ff963c', light: '#ffdc86', dark: '#e84c22', spec: '#fff2c4', lip: '#9a2a14' }
        ],
        // Pingos com as cores de lava do Arauto (ARAUTO_FX.lavaColors): base presa na moldura, corpo, ponta.
        drip: { base: '#e84c22', body: '#ff963c', tip: '#ffdc86' }
    }
});
