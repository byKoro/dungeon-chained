// Game-feel dos acertos da serra em inimigos.
// Timers `*Steps` contam passos de simulação (60 Hz): congelam no hit stop e desaceleram no slow-mo.
// Durações em segundos (`hitStop`) usam tempo real e valem só para o GameLoop.

// Reação do inimigo ao golpe (lida por MeleeEnemy).
export const ENEMY_HIT = Object.freeze({
    sawDamage: 1,
    // Invulnerabilidade após um golpe aceito: evita dano/feedback repetido a cada frame de contato.
    cooldownSteps: 0,

    stagger: { steps: 14, knockback: 6.5 },

    // Poise só existe em inimigos com `combat.poise` > 0 (ver DemoCombatConfig).
    poise: {
        perHit: 1,
        breakSteps: 60,
        breakKnockback: 10,
        // Janela em que o dano é multiplicado; um pouco maior que o stun para o jogador aproveitar.
        vulnerableSteps: 72,
        vulnerableDamageMult: 2,
        // Sem tomar golpes por este tempo, a poise volta cheia.
        regenDelaySteps: 150
    },

    // 5–6 passos a 60 Hz = 0,083–0,10 s (faixa pedida: 0,05–0,10 s).
    flash: { steps: 5, breakSteps: 6, first: '#ffffff', second: '#ff3b3b', alpha: 0.9 },
    // Pulso suave durante a vulnerabilidade: comunica a quebra de poise sem barra visível.
    vulnerablePulse: { color: '#ffd24a', alpha: 0.32, periodSteps: 8 },
    // Deslocamento do sprite (px de mundo) enquanto está em hurt/stunned.
    jitter: { hurt: 3, stunned: 1.5 }
});

// Feedback do contato (lido por CombatSystem).
export const HIT_FEEL = Object.freeze({
    shake: { hit: 6, kill: 10, poiseBreak: 12 },
    // Segundos de tempo real; o GameLoop ainda limita a HIT_STOP.min..max.
    hitStop: { hit: 0.035, kill: 0.07, poiseBreak: 0.09 },
    sparks: { hit: 6, kill: 9, poiseBreak: 12, power: 1, cone: 0.9 },
    blood: { hit: 5, poiseBreak: 9, spread: 0.8 },
    dust: { hit: 3, poiseBreak: 6 },
    glint: { amount: 3, power: 0.6 },
    // Ruptura de poise reaproveita o sawHit mais grave e mais alto: não há asset de ferimento.
    poiseBreakAudio: { rateMultiplier: 0.82, volumeMultiplier: 1.3 }
});

export const DAMAGE_NUMBER = Object.freeze({
    max: 24,
    // Tamanho de um pixel da fonte em px de mundo (arte 16 px por tile = 4 px de mundo).
    pixel: 4,
    popScale: 1.5,
    popSteps: 5,
    riseSpeed: 1.8,
    riseDamping: 0.93,
    driftX: 0.35,
    scatterX: 10,
    lifeSteps: 44,
    fadeSteps: 14,
    color: '#fff4d6',
    killColor: '#ff6b4a',
    breakColor: '#ffd24a',
    outline: '#1a0d14'
});
