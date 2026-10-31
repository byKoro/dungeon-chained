import { SIM_HZ } from './GameConfig.js';

// Invocador: usa a sprite do Cultista, mas em vez do pilar de fogo fica canalizando
// uma invocação (linha 4 da folha) e, a cada intervalo, materializa uma dupla de
// minions ao mesmo tempo. Números de tuning ficam aqui (ADR 0003).
export const SUMMONER = {
    hp: 3,
    speed: 1.2,
    // Só recua quando um jogador chega muito perto; fora disso fica parado conjurando.
    fleeDistance: 110,
    retreatProbeSteps: 12,
    // Intervalo entre invocações (5,5s a 60 Hz).
    summonInterval: Math.round(5.5 * SIM_HZ),
    // Frame da animação de invocar em que os minions são liberados.
    summonReleaseFrame: 6,
    // Tipos invocados simultaneamente a cada ciclo.
    summonTypes: ['hellbat', 'lavaSlime'],
    // Onde os minions nascem em relação ao invocador.
    spawnOffset: 34,
    spawnRadius: 18,
    maxMinions: 12,
    // Tint vermelho aplicado SÓ durante a animação de invocação.
    summonTint: { color: '#ff3b3b', alpha: 0.55 },
    // Ataque: pilar de fogo que sai do chão (linha 3), num ponto aleatório entre os jogadores.
    castInterval: Math.round(4 * SIM_HZ),   // intervalo entre ataques (4s)
    castReleaseFrame: 8,                     // frame em que o dano é aplicado
    castSpread: 70,                          // variação aleatória (px) em torno do meio dos players
    cast: {
        radius: 30,
        damageFirstFrame: 8,
        damageLastFrame: 11,
        // Recorte do pilar de fogo na folha do cultista (linha 3).
        cropX: 70, cropY: 10, cropW: 30, cropH: 54,
        scale: 3, anchorX: 84, anchorY: 62,
        firstFrame: 5,
        // Largura do recorte do corpo do conjurador nos frames do pilar (evita puxar o pilar embutido).
        casterCropW: 30
    },
    // Morte usa o fade padrão do jogo em vez de uma sequência da folha (evita o sumiço).
    playDeathAnimation: false
};

// Animação de invocação na linha 5 da folha do cultist. A morte usa o fade padrão
// do jogo (playDeathAnimation: false), evitando o "sumiço" da sequência da folha.
export const SUMMONER_SPRITE = {
    key: 'summoner', label: 'Invocador (Cultista)', src: 'assets/enemies/cultist.png',
    cellSize: 100, cropX: 40, cropY: 20, cropW: 38, cropH: 46,
    body: { x: 43, y: 36, w: 21, h: 24 }, drawHeight: 138,
    combat: SUMMONER,
    rows: {
        walk: { row: 1, frames: 8, fps: 7 },
        // Pilar de fogo que sai do chão (linha 3 da folha do cultista).
        cast: { row: 3, frames: 14, fps: 6, hitFrame: 8 },
        // Animação de invocar na linha 5.
        summon: { row: 5, frames: 10, fps: 6 },
        // Fonte dos gibs/último frame; a morte em si é o fade padrão.
        death: { row: 5, frames: 10, fps: 7 }
    }
};
