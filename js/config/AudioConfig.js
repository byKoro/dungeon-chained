export const AUDIO_CONFIG = {

    masterVolume: 1.0,

    muted: false,

    cues: {
        sawTackleImpact: {
            description: 'Pancada metálica grave do dash na serra solta',
            files: ['assets/audio/saw-tackle-impact.wav'], volume: 0.65,
            rate: 1, rateVariance: 0.035, pitchShift: true, cooldownMs: 90, maxVoices: 2, enabled: true
        },
        sawTackleLaunch: {
            description: 'Arrancada pesada da serra após o tackle',
            files: ['assets/audio/saw-tackle-launch.wav'], volume: 0.45,
            rate: 1, rateVariance: 0.04, pitchShift: true, cooldownMs: 80, maxVoices: 2, enabled: true
        },
        sawTackleFlight: {
            description: 'Motor e passagem de ar da serra em voo',
            files: ['assets/audio/saw-tackle-flight-loop.wav'], volume: 0.45, loop: true, enabled: true
        },
        sawTackleCut: {
            description: 'Serragem mecânica contínua da serra cravada no alvo',
            files: ['assets/audio/saw-tackle-cut-loop.wav'], volume: 0.50, loop: true, enabled: true
        },
        sawTackleBite: {
            description: 'Mordida inicial dos dentes da serra no alvo',
            files: ['assets/audio/saw-tackle-bite.wav'], volume: 0.42,
            rate: 1, rateVariance: 0.04, pitchShift: true, cooldownMs: 100, maxVoices: 2, enabled: true
        },
        sawTackleBounce: {
            description: 'Ricochete metálico seco da serra contra a parede',
            files: ['assets/audio/saw-tackle-bounce.wav'], volume: 0.48,
            rate: 1, rateVariance: 0.06, pitchShift: true, cooldownMs: 70, maxVoices: 2, enabled: true
        },
        sawTackleLand: {
            description: 'Peso da serra assentando no chão após o voo',
            files: ['assets/audio/saw-tackle-land.wav'], volume: 0.5,
            rate: 1, rateVariance: 0.03, pitchShift: true, cooldownMs: 100, maxVoices: 2, enabled: true
        },
        chainTension: {
            description: 'Cabo metálico sob carga: rangido contínuo que cresce com a tensão',
            files: ['assets/audio/chain-tension-loop.wav'],
            volume: 0.65, loop: true, enabled: true
        },
        arautoSawStone: {
            description: 'Estalos secos de pedra no contato da serra, repetidos conforme o giro',
            files: ['assets/audio/arauto-saw-stone-loop.wav'],
            volume: 0.78, loop: true, enabled: true
        },
        arautoDashLoop: {
            description: 'Vento forte e encorpado durante a investida do Arauto',
            files: ['assets/audio/arauto-dash-loop.wav'],
            volume: 0.45, loop: true, enabled: true
        },
        arautoDashStart: {
            description: 'Whoosh pesado na arrancada da investida do Arauto',
            files: [1, 2, 3].map(i => `assets/audio/arauto-dash-0${i}.wav`),
            volume: 0.6, rate: 1, rateVariance: 0.04, pitchShift: true,
            cooldownMs: 50, maxVoices: 2, enabled: true
        },
        arautoGround: {
            description: 'Pancada de rocha no chão: ataque seco, grave e pedregulhos',
            files: [1, 2, 3].map(i => `assets/audio/arauto-ground-0${i}.wav`),
            volume: 0.5, rate: 1, rateVariance: 0.03, pitchShift: true,
            cooldownMs: 50, maxVoices: 2, enabled: true
        },
        arautoAssemble: {
            description: 'Pedra se encaixando na remontagem do Arauto (provisório: pancada de rocha mais leve e aguda)',
            files: [1, 2, 3].map(i => `assets/audio/arauto-ground-0${i}.wav`),
            volume: 0.32, rate: 1.45, rateVariance: 0.08, pitchShift: true,
            cooldownMs: 60, maxVoices: 2, enabled: true
        },
        arautoSlam: {
            description: 'Aterrissagem pesada do Arauto: estrondo mais grave e cauda de pedras',
            files: [1, 2, 3].map(i => `assets/audio/arauto-slam-0${i}.wav`),
            volume: 0.6, rate: 1, rateVariance: 0.03, pitchShift: true,
            cooldownMs: 50, maxVoices: 2, enabled: true
        },
        ghostfireRoar: {
            description: "Rugido do Ghostfire do trailer",
            files: ["assets/audio/trailer/roar.wav"],
            volume: 0.8, rate: 0.72, rateVariance: 0, enabled: true
        },
        ghostfireCharge: {
            description: "Carga do raio do Ghostfire",
            files: ["assets/audio/trailer/beam-charge.wav"],
            volume: 0.75, rate: 1, rateVariance: 0, enabled: true
        },
        ghostfireBeam: {
            description: "Disparo do raio do Ghostfire",
            files: ["assets/audio/trailer/beam-fire.wav"],
            volume: 0.85, rate: 1, rateVariance: 0, enabled: true
        },
        ghostfireSummon: {
            description: "Chamas da invocação do Ghostfire",
            files: [1, 2].map(i => `assets/audio/trailer/flame-0${i}.wav`),
            volume: 0.7, rate: 0.85, rateVariance: 0.03, enabled: true
        },
        ghostfireDeath: {
            description: "Explosão final do Ghostfire",
            files: [1, 2, 3].map(i => `assets/audio/trailer/boom-0${i}.wav`),
            volume: 0.9, rate: 0.6, rateVariance: 0.03, enabled: true
        },
        playerHurt: {
            description: "Dano sofrido pelos jogadores ao colidir com inimigos",
            files: [1, 2, 3].map(i => `assets/audio/player-hit-0${i}.wav`),
            volume: 0.75,
            rate: 1.0,
            rateVariance: 0.10,
            enabled: true
        },

        monsterHurt: {
            description: "Dano sofrido pelos monstros atingidos pela arma (camada vocal opcional)",
            files: [],
            volume: 0.58,
            rate: 0.95,
            rateVariance: 0.10,
            enabled: false
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
            description: "Rugido / rosnado da criatura ao desferir um ataque (opcional)",
            files: [],
            volume: 0.30,
            rate: 0.92,
            rateVariance: 0.08,
            enabled: false
        },

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
            description: "Lâmina cortando o monstro (3 variações de acerto da serra)",
            files: [1, 2, 3].map(i => `assets/audio/saw-hit-0${i}.wav`),
            volume: 0.85,
            rate: 1.0,
            rateVariance: 0.06,
            pitchShift: true,
            cooldownMs: 45,
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
            cooldownMs: 70,
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
            cooldownMs: 40,
            maxVoices: 4,
            enabled: true
        },

        playerDash: {
            description: "Dash do jogador (PLACEHOLDER: reaproveita arrow-fire mais agudo até existir um whoosh próprio)",
            files: [1, 2, 3].map(i => `assets/audio/arrow-fire-0${i}.wav`),
            volume: 0.4,
            rate: 1.45,
            rateVariance: 0.06,
            pitchShift: true,
            cooldownMs: 60,
            maxVoices: 2,
            enabled: true
        },

        sawMotor: {
            description: "Motor da serra em loop (regime do circular-saw.mp3); nível/tom/brilho seguem o giro — ver SawMotorAudio",
            files: ["assets/audio/saw-motor-loop.wav"],
            volume: 0.38,
            loop: true,
            enabled: true
        },

        ambience: {
            description: "Ambiente da dungeon em loop (drone, vento, gotas, rangidos distantes)",
            files: ["assets/audio/ambience-dungeon.wav"],
            volume: 0.45,
            loop: true,
            enabled: true
        },

        uiMove: {
            description: "Foco/hover mudando entre botões (tic curto)",
            files: ["assets/audio/ui-move.wav"],
            volume: 0.3,
            rate: 1.0,
            rateVariance: 0.02,
            pitchShift: true,
            cooldownMs: 40,
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

        buttonPress: {
            description: "Placa afundando ao pisar: clique de pedra + baque + raspado + catraca do mecanismo",
            files: [1, 2].map(i => `assets/audio/button-press-0${i}.wav`),
            volume: 0.75,
            rate: 1.0,
            rateVariance: 0.04,
            pitchShift: true,
            cooldownMs: 80,
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
        },
        scrapPickup: {
            description: "Coleta de sucata (placeholder: pop do trailer; tom sobe em coletas seguidas)",
            files: [1, 2, 3].map(i => `assets/audio/trailer/pop-0${i}.wav`),
            volume: 0.32,
            rate: 1.0,
            rateVariance: 0.05,
            pitchShift: true,
            cooldownMs: 35,
            maxVoices: 4,
            enabled: true
        },
        chestOpen: {
            description: "Tampa do baú abrindo (placeholder: thunk do trailer)",
            files: [1, 2].map(i => `assets/audio/trailer/thunk-0${i}.wav`),
            volume: 0.55,
            rate: 1.1,
            rateVariance: 0.05,
            pitchShift: true,
            cooldownMs: 120,
            enabled: true
        },
        voiceBlip: {
            description: "Blip de voz do balão de fala (placeholder: blip do trailer; o tom muda por jogador)",
            files: [1, 2].map(i => `assets/audio/trailer/blip-0${i}.wav`),
            volume: 0.22,
            rate: 1.0,
            rateVariance: 0,
            pitchShift: true,
            cooldownMs: 30,
            maxVoices: 2,
            enabled: true
        },
        forgeBuy: {
            description: "Compra na bigorna (placeholder: sting do trailer)",
            files: ["assets/audio/trailer/sting.wav"],
            volume: 0.5,
            rate: 1.2,
            rateVariance: 0.03,
            pitchShift: true,
            cooldownMs: 120,
            enabled: true
        },
        forgeHammer: {
            description: "Martelada na bigorna durante a cinemática da serra (placeholder: impacto do trailer)",
            files: [1, 2, 3].map(i => `assets/audio/trailer/impact-0${i}.wav`),
            volume: 0.6,
            rate: 1.25,
            rateVariance: 0.05,
            pitchShift: true,
            cooldownMs: 80,
            enabled: true
        }
    }
};

export function getAudioClipsMap(config = AUDIO_CONFIG) {
    return Object.fromEntries(
        Object.entries(config.cues).map(([name, cue]) => [name, cue.files || []])
    );
}

export const AUDIO_CLIPS = getAudioClipsMap(AUDIO_CONFIG);
