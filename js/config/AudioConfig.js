/**
 * AudioConfig — configuração de som por efeito, editável à mão.
 *
 * Aqui você controla cada som individualmente, sem mexer no código:
 *   files  = lista de variações do som. Trocar/adicionar/remover caminhos muda
 *            quais arquivos tocam (o AudioManager sorteia um a cada reprodução).
 *   volume = quão alto o som toca (0 = mudo, 1 = cheio). Mais alto = número maior.
 *   rate   = velocidade de reprodução. Número fixo (ex.: 1 = normal) OU um par
 *            [min, max] para sortear uma velocidade aleatória nessa faixa a cada
 *            toque (dá variação natural, evita repetição mecânica).
 *   MASTER_VOLUME = multiplicador global aplicado em cima de todos os volumes
 *            (0..1). Baixe para abafar o jogo inteiro de uma vez.
 */

// Multiplicador global de volume (0..1), aplicado sobre o volume de cada som.
export const MASTER_VOLUME = 1.0;

export const AUDIO_CONFIG = {
    playerHurt: {
        files: [1, 2, 3, 4, 5, 6].map(i => `assets/audio/player-hurt-${String(i).padStart(2, "0")}.wav`),
        volume: 0.75,
        rate: [0.9, 1.1]
    },
    monsterHurt: {
        files: [1, 2, 3].map(i => `assets/audio/monster-hurt-0${i}.ogg`),
        volume: 0.58,
        rate: [0.85, 1.05]
    },
    playerStep: {
        files: [1, 2, 3, 4, 5, 6].map(i => `assets/audio/footstep-stone-0${i}.ogg`),
        volume: 0.35,
        rate: [0.92, 1.08]
    },
    enemyStep: {
        files: [1, 2, 3, 4, 5, 6].map(i => `assets/audio/footstep-stone-0${i}.ogg`),
        volume: 0.32,
        rate: [0.68, 0.76]
    },
    enemyAttack: {
        files: [1, 2, 3].map(i => `assets/audio/enemy-attack-0${i}.wav`),
        volume: 0.45,
        rate: [0.85, 1.0]
    },
    enemyAttackVoice: {
        files: [1, 2, 3].map(i => `assets/audio/monster-attack-0${i}.ogg`),
        volume: 0.3,
        rate: [0.85, 1.0]
    },
    pickup: {
        files: ["assets/audio/item-pickup.flac"],
        volume: 0.65,
        rate: [0.95, 1.05]
    }
};
