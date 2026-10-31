import { SIM_HZ } from './GameConfig.js';

// Invocador: usa a sprite do Cultista, mas em vez do pilar de fogo fica canalizando
// uma invocação (linha 4 da folha) e, a cada intervalo, materializa uma dupla de
// minions ao mesmo tempo. Números de tuning ficam aqui (ADR 0003).
export const SUMMONER = {
    hp: 3,
    speed: 1.2,
    preferredDistance: 300,
    distanceTolerance: 24,
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
        // Animação de invocar na linha 5.
        summon: { row: 5, frames: 10, fps: 6 },
        // Fonte dos gibs/último frame; a morte em si é o fade padrão.
        death: { row: 5, frames: 10, fps: 7 }
    }
};
