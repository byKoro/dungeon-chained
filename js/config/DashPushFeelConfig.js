// Juice do Impacto (dash arremessa inimigos). Px de mundo, steps de 60 Hz; `hitStop` em segundos reais.
export const DASH_PUSH_FEEL = Object.freeze({
    // Contato do dash com o inimigo: impacto médio (é golpe, não só movimento).
    contact: Object.freeze({
        hitStop: 0.04, shake: 5, sparks: 8, power: 1.1, cone: 0.9, flash: 8, dust: 6, flashSteps: 8,
        sound: Object.freeze({ cue: "enemyAttack", rate: 0.75, volume: 0.8 })
    }),
    // Rastro enquanto voa: poeira nos pés a cada `every` steps acima de `minSpeed` px/step.
    trail: Object.freeze({ every: 2, minSpeed: 3, dust: 2 }),
    // Parada brusca (parede, borda de buraco, outro corpo): andou menos que `ratio` × a velocidade do step anterior.
    slam: Object.freeze({
        // `stopReach`: se o jogador que arremessou ainda está em dash a até `stopReach` × (soma dos raios), o dash para.
        minSpeed: 4, ratio: 0.45, hitStop: 0.03, shake: 6, dust: 10, sparks: 5, stopReach: 2.5,
        sound: Object.freeze({ cue: "arautoGround", rate: 1.6, volume: 0.45 })
    }),
    // Passos de vida máxima de um arremesso acompanhado (segurança se o inimigo sumir sem parar).
    maxSteps: 90,
    reducedMotion: 0.35
});
