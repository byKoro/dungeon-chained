// Indicador da serra fora da tela (HUD). Reusa o sprite da serra (assets/saw/saw.png),
// desenhado nítido (nearest-neighbor) e escalado por inteiro, como o resto da UI.
export const SAW_INDICATOR = {
    // Folga entre a borda da tela e a marca (a ponta da seta/texto). O alcance da própria marca é somado a isto,
    // então nada encosta na borda. Em px de tela.
    edgeMargin: 24,
    // Enquanto a serra está a menos que isto para dentro da borda visível (px de tela), não mostra.
    hideWithinScreen: 24,
    // Tamanho do disco (sprite da serra) em art px; 1 art px = `scale` px de tela.
    discSize: 20,
    // Giro lento do disco (rad por frame a 60 Hz), só pra dar vida ao ícone.
    spinPerFrame: 0.05,
    // Seta apontando pra serra, à frente do disco (em art px).
    arrow: { length: 6, width: 9, gap: 2 },
    // Distância da serra escrita embaixo do disco (em tiles do mundo), oculta abaixo deste valor.
    showDistanceTiles: 1.5,
    pulseHz: 2.2,
    pulseDepth: 0.14,
    colors: {
        arrow: '#ffd166',
        arrowLight: '#ffe9a6',
        arrowDark: '#9a6b12',
        outline: '#0b0910',
        text: '#efe3c2',
        textShadow: '#0b0910',
    },
};
