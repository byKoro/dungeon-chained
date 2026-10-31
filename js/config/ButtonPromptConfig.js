// Ícones de botão dos tutoriais rápidos (card do dash e próximos). Medidas em px de arte da folha.
export const BUTTON_PROMPT = Object.freeze({
    sheet: "assets/ui/button_prompts.png",
    cell: 16,
    // Linha 0 = normal, linha 1 = pressionado.
    icons: Object.freeze({
        key: Object.freeze({ col: 0, w: 16 }),
        xboxA: Object.freeze({ col: 1, w: 14 }),
        xboxX: Object.freeze({ col: 2, w: 14 }),
        psCross: Object.freeze({ col: 3, w: 14 }),
        psSquare: Object.freeze({ col: 4, w: 14 })
    }),
    // Tecla esticável: bordas fixas de `keyEdge` px e miolo de 1 px (coluna `keyEdge` da célula).
    keyEdge: 4,
    keyPadX: 3,
    keyLabelY: 4,
    // Botão de cada ação por dispositivo; no teclado, uma chave i18n do rótulo por jogador (P1, P2).
    actions: Object.freeze({
        dash: Object.freeze({ keyboard: Object.freeze(["key.space", "key.enter"]), xbox: "xboxA", playstation: "psCross" }),
        interact: Object.freeze({ keyboard: Object.freeze(["key.e", "key.shift"]), xbox: "xboxX", playstation: "psSquare" })
    }),
    // Sem vídeo para sincronizar, o ícone pisca normal/pressionado neste período (ms).
    pulsePeriodMs: 900,
    playerColors: Object.freeze(["#ffd166", "#6bb4db"])
});
