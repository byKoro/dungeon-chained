// Indicador de interagir sobre baús e bigornas. Tempos em ms, distâncias em px de mundo.
export const INTERACT_PROMPT = Object.freeze({
    sheet: "assets/ui/interact_prompt.png",
    cell: 16,
    // 1 px de arte = 4 px de mundo (mesma densidade do resto do jogo).
    pixelScale: 4,
    // Folha de uma linha, neutra. Colunas: [normal, pressionado] por dispositivo; a última é o selo de bloqueado.
    // Com os dois no alcance e botões diferentes, o botão troca a cada `pulsePeriodMs`.
    columns: Object.freeze({ keyboardE: 0, keyboardShift: 2, xbox: 4, playstation: 6, blocked: 8 }),
    // Teclado por jogador: P1 usa E, P2 usa Shift direito.
    keyboardIcon: Object.freeze(["keyboardE", "keyboardShift"]),
    gap: 6,
    bobAmplitude: 3,
    bobPeriodMs: 1600,
    pulsePeriodMs: 900,
    popMs: 160,
    popOvershoot: 1.25,
    blockedAlpha: 0.5,
    // Borda de 1 pixel de arte em volta do objeto no alcance. Steps de 60 Hz.
    outline: Object.freeze({ color: "#ffffff", fadeInSteps: 6, fadeOutSteps: 9 })
});
