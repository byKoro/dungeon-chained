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

        // ---- Sons gerados por tools/gen_sfx.py (rodar de novo regera) ----
        // Campos extras: cooldownMs (intervalo mínimo entre disparos do mesmo
        // cue), maxVoices (polifonia; rouba a voz mais antiga) e loop.

        pickup: {
            description: "Coleta do coração: batimento 'tum-tum' + arpejo subindo (tom sobe em coletas seguidas)",
            files: [1, 2].map(i => `assets/audio/heart-pickup-0${i}.wav`),
            volume: 0.6,
            rate: 1.0,
            rateVariance: 0.03,
            pitchShift: true,
            cooldownMs: 60,
            enabled: true
        },

        sawHit: {
            description: "Lâmina cortando o monstro (hit_sound.mp3 retrabalhado: sem silêncio inicial, sub-thump e 'rip' dos dentes)",
            files: [1, 2, 3].map(i => `assets/audio/saw-hit-0${i}.wav`),
            volume: 0.7,
            rate: 1.0,
            rateVariance: 0.06,
            pitchShift: true,
            cooldownMs: 45,   // cortes no mesmo quadro viram UM golpe mais forte
            maxVoices: 3,
            enabled: true
        },

        sawSnap: {
            description: "Corrente arrebentando: estalo + ping metálico + twang do cabo + elos soltos",
            files: ["assets/audio/saw-snap.wav"],
            volume: 0.95,
            rate: 1.0,
            rateVariance: 0.05,
            pitchShift: true,
            cooldownMs: 200,
            enabled: true
        },

        sawLand: {
            description: "Lâmina largada pousando na pedra (clang + giro de moeda morrendo)",
            files: [1, 2].map(i => `assets/audio/saw-land-0${i}.wav`),
            volume: 0.7,
            rate: 1.0,
            rateVariance: 0.06,
            pitchShift: true,
            cooldownMs: 200,
            enabled: true
        },

        sawPickup: {
            description: "Serra recolhida/corrente reconectada: elos puxando + trava + 'shing' + motor",
            files: ["assets/audio/saw-pickup.wav"],
            volume: 0.85,
            rate: 1.0,
            rateVariance: 0.04,
            pitchShift: true,
            cooldownMs: 200,
            enabled: true
        },

        playerFall: {
            description: "Jogador caindo no abismo (vento descendo + assobio + baque distante)",
            files: ["assets/audio/player-fall.wav"],
            volume: 0.75,
            rate: 1.0,
            rateVariance: 0.05,
            pitchShift: true,
            cooldownMs: 120,
            enabled: true
        },

        doorOpen: {
            description: "Sala limpa: trinco + pedra arrastando (portas destravam)",
            files: ["assets/audio/door-open.wav"],
            volume: 0.7,
            rate: 1.0,
            rateVariance: 0.03,
            enabled: true
        },

        sawMotor: {
            description: "Motor da serra em loop (regime do circular-saw.mp3); nível/tom/brilho seguem o giro — ver SawMotorAudio",
            files: ["assets/audio/saw-motor-loop.wav"],
            volume: 0.38,     // nível com a serra a toda (spin = 1)
            loop: true,       // tocado por audio.createLoopVoice (controlável)
            enabled: true
        },

        ambience: {
            description: "Ambiente da dungeon em loop (drone, vento, gotas, rangidos distantes)",
            files: ["assets/audio/ambience-dungeon.wav"],
            volume: 0.45,
            loop: true,       // tocado por audio.playLoop (Web Audio, sem emenda)
            enabled: true
        },

        // Botão de pressão. Sem arquivo dedicado ainda: reaproveita o passo de
        // pedra ACELERADO (vira um "clack" seco). Troque `files` quando houver
        // um som de clique próprio.
        buttonPress: {
            description: "Botão de pressão afundando (clique ao pisar)",
            files: ["assets/audio/footstep-stone-02.ogg", "assets/audio/footstep-stone-05.ogg"],
            volume: 0.8,
            rate: 1.7,
            rateVariance: 0.05,
            pitchShift: true,   // rate também sobe o TOM (clique mais agudo)
            enabled: true
        },

        buttonRelease: {
            description: "Botão de pressão voltando (clique leve ao sair)",
            files: ["assets/audio/footstep-stone-03.ogg"],
            volume: 0.4,
            rate: 2.0,
            rateVariance: 0.05,
            pitchShift: true,
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
