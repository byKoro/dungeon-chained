/**
 * AudioConfig — Configuração centralizada de áudio para todos os casos de uso do jogo.
 *
 * Permite gerenciar, alterar arquivos de som, aumentar ou diminuir volume,
 * ajustar pitch / variações e ativar/desativar cada efeito sonoro individualmente.
 *
 * Cada caso de uso (cue) possui:
 *  - description: Descrição do caso de uso no jogo.
 *  - files: Lista de caminhos relativos para os arquivos de som (.wav, .ogg, .flac).
 *  - volume: Volume base (0.0 = mudo, 1.0 = volume máximo).
 *  - rate: Velocidade / tom de reprodução base (1.0 = normal, < 1 mais grave, > 1 mais agudo).
 *  - rateVariance: Variação aleatória aplicada ao rate (+/- rateVariance) para evitar repetição mecânica.
 *  - enabled: Define se o efeito está ativo (true/false).
 */

export const AUDIO_CONFIG = {
    // Volume geral que multiplica todos os sons do jogo (0.0 a 1.0)
    masterVolume: 1.0,

    // Mudo geral do jogo
    muted: false,

    // Configurações detalhadas por caso de uso
    cues: {
        playerHurt: {
            description: "Dano sofrido pelos jogadores ao colidir com inimigos",
            files: [1, 2, 3, 4, 5, 6].map(i => `assets/audio/player-hurt-${String(i).padStart(2, "0")}.wav`),
            volume: 0.75,
            rate: 1.0,
            rateVariance: 0.10,
            enabled: true
        },

        monsterHurt: {
            description: "Dano sofrido pelos monstros atingidos pela arma",
            files: [1, 2, 3].map(i => `assets/audio/monster-hurt-0${i}.ogg`),
            volume: 0.58,
            rate: 0.95,
            rateVariance: 0.10,
            enabled: true
        },

        playerStep: {
            description: "Passos dos jogadores ao caminhar pela dungeon",
            files: [1, 2, 3, 4, 5, 6].map(i => `assets/audio/footstep-stone-0${i}.ogg`),
            volume: 0.35,
            rate: 1.0,
            rateVariance: 0.08,
            enabled: true
        },

        enemyStep: {
            description: "Passos dos monstros em perseguição (mais graves e lentos)",
            files: [1, 2, 3, 4, 5, 6].map(i => `assets/audio/footstep-stone-0${i}.ogg`),
            volume: 0.32,
            rate: 0.72,
            rateVariance: 0.04,
            enabled: true
        },

        enemyAttack: {
            description: "Som de ataque físico / impacto das garras do monstro",
            files: [1, 2, 3].map(i => `assets/audio/enemy-attack-0${i}.wav`),
            volume: 0.45,
            rate: 0.92,
            rateVariance: 0.08,
            enabled: true
        },

        enemyAttackVoice: {
            description: "Rugido / rosnado da criatura ao desferir um ataque",
            files: [1, 2, 3].map(i => `assets/audio/monster-attack-0${i}.ogg`),
            volume: 0.30,
            rate: 0.92,
            rateVariance: 0.08,
            enabled: true
        },

        pickup: {
            description: "Coleta de item no chão (ex: coração de vida)",
            files: ["assets/audio/item-pickup.flac"],
            volume: 0.65,
            rate: 1.0,
            rateVariance: 0.05,
            enabled: true
        }
    }
};

/**
 * Utilitário para extrair o mapa de listas de arquivos (compatibilidade com AUDIO_CLIPS).
 * @param {typeof AUDIO_CONFIG} [config=AUDIO_CONFIG]
 * @returns {Record<string, string[]>}
 */
export function getAudioClipsMap(config = AUDIO_CONFIG) {
    return Object.fromEntries(
        Object.entries(config.cues).map(([name, cue]) => [name, cue.files || []])
    );
}

// Mapa legado para preservar retrocompatibilidade total com código existente
export const AUDIO_CLIPS = getAudioClipsMap(AUDIO_CONFIG);
