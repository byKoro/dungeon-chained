export const CHAIN_TENSION = {
    anticipation: 0.10,
    effortEnter: 0.16,
    effortExit: 0.10,
    attackTau: 0.025,
    releaseTau: 0.065,
    inactiveTau: 0.015,
    maxFrameSeconds: 0.05,
    settleSeconds: 0.22,
    snapSeconds: 0.14,
    hitStopSeconds: 0.09,
    // Afinamento: perto da ruptura o cabo "estrangula". `risk` elevado a `power` reduz a
    // espessura desenhada de 1 até `minThickness`; `startRisk` segura o afinamento no começo.
    cableThin: { minThickness: 0.34, power: 1.7, startRisk: 0.12 },
    // Piscar: a corda pisca pra avisar que vai estourar. A frequência (Hz) e a profundidade
    // (quanto a opacidade cai no vale) crescem com o risco; `startRisk` segura no começo.
    cableBlink: { startRisk: 0.2, hzMin: 2, hzMax: 11, depthMin: 0.12, depthMax: 0.6 },
    // Estalo: corte SECO. As duas metades do cabo recuam retas e somem na janela `cutWindow` (fração
    // de `snapSeconds`); nada de chicote/overshoot. `color` = cor do cabo; `thickness` = grossura;
    // `sparks` = faíscas no ponto de ruptura.
    snap: { cutWindow: 0.45, thickness: 5, color: '#1a1a1e', sparks: 14 },
    // Tremida: assim que a corda entra em tensão (`start`) ela já dá uma tremidinha transversal
    // (ruído por segmento), que cresce com o risco. `power` deixa a entrada suave; `ampMin` é a
    // tremida inicial sutil e `ampMax` a do limite; `hzMin→hzMax` acelera o chacoalho na ruptura.
    preSnapShake: { start: 0.18, power: 1.4, ampMin: 0.8, ampMax: 3.6, hzMin: 10, hzMax: 30 },
    // `reduced` = fator de prefers-reduced-motion (encolhe tremida/chicote). A corda não ondula
    // mais com a tensão (sem onda "curvadinha"); o aviso é afinar + piscar + tremida no limite.
    motion: { reduced: 0.35 },
    audio: {
        silence: 0.015, minDb: -24, maxDb: -3,
        criticalDb: 2, rateMin: 0.78, rateMax: 1.32,
        cutoffMin: 1400, cutoffMax: 8500
    }
};
