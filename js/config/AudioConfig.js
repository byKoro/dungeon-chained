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

        enemySpawn: {
            description: "Inimigo surgindo da chama na intro da sala (fwoomp de fogo + baque + rosnado)",
            files: [1, 2, 3].map(i => `assets/audio/enemy-spawn-0${i}.wav`),
            volume: 0.55,
            rate: 1.0,
            rateVariance: 0.08,
            pitchShift: true,
            cooldownMs: 70,   // spawns escalonados próximos não empilham
            maxVoices: 4,
            enabled: true
        },

        playerHit: {
            description: "Impacto no corpo do jogador ao perder vida (qualquer fonte: inimigo, flecha, spike)",
            files: [1, 2, 3].map(i => `assets/audio/player-hit-0${i}.wav`),
            volume: 0.62,
            rate: 1.0,
            rateVariance: 0.07,
            pitchShift: true,
            cooldownMs: 50,
            maxVoices: 2,
            enabled: true
        },

        arrowFire: {
            description: "Armadilha de parede disparando flecha (trava + twang da corda + assobio)",
            files: [1, 2, 3].map(i => `assets/audio/arrow-fire-0${i}.wav`),
            volume: 0.5,
            rate: 1.0,
            rateVariance: 0.06,
            pitchShift: true,
            cooldownMs: 40,   // vários atiradores em fase = um disparo encorpado
            maxVoices: 4,
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

        // ---- Interface (botões pixel art) — tocados via js/ui/UiSound.js ----
        // Hierarquia: mover foco (baixo) < confirmar < abrir/fechar a pausa.
        // Variação de tom mínima: som de UI deve ser previsível.
        uiMove: {
            description: "Foco/hover mudando entre botões (tic curto)",
            files: ["assets/audio/ui-move.wav"],
            volume: 0.3,
            rate: 1.0,
            rateVariance: 0.02,
            pitchShift: true,
            cooldownMs: 40,   // passar o mouse rápido não vira metralhadora
            maxVoices: 2,
            enabled: true
        },

        uiConfirm: {
            description: "Botão acionado (clack + dois toques metálicos subindo)",
            files: ["assets/audio/ui-confirm.wav"],
            volume: 0.55,
            rate: 1.0,
            rateVariance: 0.0,
            cooldownMs: 120,
            enabled: true
        },

        uiOpen: {
            description: "Pausa abrindo (o mundo abafa e afunda)",
            files: ["assets/audio/ui-open.wav"],
            volume: 0.5,
            rate: 1.0,
            rateVariance: 0.0,
            cooldownMs: 150,
            enabled: true
        },

        uiClose: {
            description: "Pausa fechando / voltar ao jogo (sobe e abre)",
            files: ["assets/audio/ui-close.wav"],
            volume: 0.4,
            rate: 1.0,
            rateVariance: 0.0,
            cooldownMs: 150,
            enabled: true
        },

        // Botão de pressão (placa de pedra). O Game sobe o tom quando este
        // aperto completa o par (os dois botões pressionados = progresso).
        buttonPress: {
            description: "Placa afundando ao pisar: clique de pedra + baque + raspado + catraca do mecanismo",
            files: [1, 2].map(i => `assets/audio/button-press-0${i}.wav`),
            volume: 0.75,
            rate: 1.0,
            rateVariance: 0.04,
            pitchShift: true,
            cooldownMs: 80,   // pé "tremendo" na borda não vira metralhadora
            enabled: true
        },

        buttonRelease: {
            description: "Placa voltando ao sair (tuk leve subindo + destrava), bem mais baixo que o aperto",
            files: ["assets/audio/button-release.wav"],
            volume: 0.3,
            rate: 1.0,
            rateVariance: 0.05,
            pitchShift: true,
            cooldownMs: 80,
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
