export const TILE = 64;        // tamanho do tile no mundo (px)
export const ROOM_COLS = 14;   // par: porta N/S de 2 tiles fica centralizada
export const ROOM_ROWS = 9;
export const EMPTY_FLOOR_TILE = -2;
export const EMPTY_FLOOR_COLOR = "#25131a";
export const GRID_COLS = 9;    // nº de células (salas) na grade do mundo
export const GRID_ROWS = 7;
export const WORLD_W = GRID_COLS * ROOM_COLS * TILE;
export const WORLD_H = GRID_ROWS * ROOM_ROWS * TILE;
export const ROOM_COUNT = 8;   // quantas salas gerar por andar
export const BLOOD_COLORS = ["#4a0612", "#5c0a18", "#6e0f1c", "#480810", "#3a0510"];
export const BLOOD_PIXEL = TILE / 16;
export const BLOOD_STAIN_CONFIG = {
    gib: { count: 3, life: Infinity, sizeMin: 2, sizeMax: 4, alpha: 0.9 }
};
export const BLOOD_STEPS = 6;  // passos ensanguentados após pisar em sangue

export const MAX_ACTIVE_GIBS = 90;
export const MAX_FOOTPRINTS = 60;

export const MAX_PLAYER_SEPARATION = 620;

export const CAM_MARGIN = 90;  // folga nas bordas (afasta a câmera do cenário)

// Câmera "drone": em vez de ficar cravada no centro da sala, ela PENDE na
// direção em que os jogadores se movem e BALANÇA (como um drone pendurado ou
// um pêndulo) ao virar/parar, assentando suave de volta. É um deslocamento
// (sway) somado ao centro, resolvido por uma mola amortecida — não altera o
// enquadramento (o clamp da sala continua valendo por cima).
//   maxOffset  — deslocamento máximo (px de mundo) no auge do movimento.
//   responseVel— velocidade média dos jogadores que satura o deslocamento.
//   stiffness  — rigidez da mola (maior = persegue o alvo mais rápido).
//   damping    — amortecimento (menor = balança mais, mais "pêndulo").
export const CAMERA_DRONE = {
    enabled: true,
    maxOffset: 70,
    responseVel: 4.2,
    stiffness: 42,
    damping: 7.5
};

export const TRANSITION_SPEED = 0.05; // ~10 frames por fase

// Passo fixo da simulação (fixed timestep). A lógica de jogo roda sempre neste
// ritmo (60Hz) independente da taxa de atualização do monitor, mantendo
// velocidade/física/timers idênticos em 60Hz, 144Hz, 240Hz etc. O render
// continua livre (requestAnimationFrame).
export const SIM_HZ = 60;
export const SIM_STEP = 1 / SIM_HZ; // segundos por passo lógico
// Teto de passos por quadro: evita a "espiral da morte" se o quadro atrasar
// muito (aba em segundo plano, stall). O tempo excedente é descartado.
export const MAX_SIM_STEPS_PER_FRAME = 5;

// Slow-motion de abate: no instante em que um inimigo é morto, a SIMULAÇÃO
// desacelera por um instante e volta suave ao normal (dá peso ao golpe, mas
// sem travar seco). O render continua livre.
//   duration  — quanto tempo (segundos reais) dura o efeito do início até
//               recuperar a velocidade cheia.
//   minScale  — fator de velocidade no pico do efeito (0..1). Ex.: 0.25 = o
//               jogo roda a 25% da velocidade no instante do abate.
export const HIT_SLOWMO = {
    duration: 0.22,
    minScale: 0.25
};

// Intro de sala de combate: ao entrar numa sala com inimigos, os jogadores
// ficam PARADOS na porta (sem controle), a câmera dá um ZOOM na sala, os
// inimigos SPAWNAM com partícula (congelados), o zoom VOLTA ao normal e só
// então os inimigos são liberados para atacar. Todas as durações em segundos.
//   zoomFactor — quanto a câmera aproxima no pico (1.35 = +35% sobre o fit).
//   zoomInTime  — tempo aproximando até o pico.
//   spawnHold   — tempo com os inimigos parados visíveis (aparição).
//   zoomOutTime — tempo voltando ao zoom normal.
export const ROOM_INTRO = {
    enabled: true,
    zoomFactor: 1.35,
    zoomInTime: 0.5,
    spawnHold: 0.7,
    zoomOutTime: 0.45
};

export const DOOR_STUB_TILES = 2;
export const DOOR_ENTER_DEPTH = 70;

export const PLAYER_DOOR_SPAWN_TILES = {
    N: {
        p1: { col: 6, row: 1 },
        p2: { col: 7, row: 1 }
    },
    S: {
        p1: { col: 6, row: ROOM_ROWS - 2 }, // row 7
        p2: { col: 7, row: ROOM_ROWS - 2 }  // row 7
    },
    W: {
        p1: { col: 1, row: 3 },
        p2: { col: 1, row: 4 }
    },
    E: {
        p1: { col: ROOM_COLS - 2, row: 3 }, // col 12
        p2: { col: ROOM_COLS - 2, row: 4 }  // col 12
    },
    CENTER: {
        p1: { col: 6, row: 4 },
        p2: { col: 7, row: 4 }
    }
};

/**
 * Retorna as posições de spawn (col, row e coordenadas px no mundo) dos jogadores
 * conforme a regra: cada um em um tile logo à frente da porta.
 *
 * @param {"N"|"S"|"E"|"W"|"CENTER"} entryDoorDir Direção da porta pela qual os players entram
 * @param {number} x0 Origem X da célula no mundo (px)
 * @param {number} y0 Origem Y da célula no mundo (px)
 * @param {number} tilePx Tamanho do tile em px (padrão TILE = 64)
 */
export function getPlayerSpawnPositions(entryDoorDir, x0 = 0, y0 = 0, tilePx = TILE) {
    const rule = PLAYER_DOOR_SPAWN_TILES[entryDoorDir] || PLAYER_DOOR_SPAWN_TILES.CENTER;
    return {
        entryDir: entryDoorDir,
        p1: {
            col: rule.p1.col,
            row: rule.p1.row,
            x: x0 + (rule.p1.col + 0.5) * tilePx,
            y: y0 + (rule.p1.row + 0.5) * tilePx
        },
        p2: {
            col: rule.p2.col,
            row: rule.p2.row,
            x: x0 + (rule.p2.col + 0.5) * tilePx,
            y: y0 + (rule.p2.row + 0.5) * tilePx
        }
    };
}

// ---- Áudio ----
export { AUDIO_CONFIG, AUDIO_CLIPS } from './AudioConfig.js';

// ---- Combate ----
// Zona morta perto dos players onde a arma não fere inimigos.
export const PLAYER_SAFE_ZONE = 46;

// Drop de coração de cura ao matar um inimigo.
//   chance   — % por abate (o campo autoral `heartDropChance` da célula, se
//              existir, substitui este valor).
//   maxLives — vida cheia. Só dropa se ALGUM jogador estiver abaixo disso, e
//              nunca mais corações no chão do que as vidas que faltam somadas
//              (ninguém precisa = nada cai; não dá para "estocar" cura).
export const HEART_DROP = {
    chance: 15,
    maxLives: 3
};

// ---- Fundo ----
export const BACKGROUND_TILE = 78; // tile que preenche o vazio fora da sala

export const HOLE_TILE = -1; // marcador de "sem piso" na grade floor[r][c]

// Resistência à queda em buracos. O jogador não cai só por encostar o centro
// num tile de buraco: existe uma BORDA "agarrável" onde o movimento para dentro
// é freado e um empurrão leve devolve ao piso. Só cai quem insiste além da
// borda por alguns frames seguidos (ou é arremessado fundo).
export const HOLE_FALL = Object.freeze({
    edgeMargin: 8,       // px dentro do buraco (a partir do piso) que ainda são "beirada"
    footOffset: 14,      // px abaixo do centro: a queda é medida nos PÉS (o que se vê pisando)
    inwardDamping: 0.7,  // fração da velocidade PARA DENTRO mantida por frame no buraco
    pushBack: 0.9,       // px/frame máx. de empurrão de volta ao piso (cresce com a profundidade)
    graceFrames: 12      // frames seguidos além da beirada até a queda (~0.2s)
});

// bitmask (N=1,E=2,S=4,W=8 => lado COM borda) -> índice do tile no tileset.
export const HOLE_TILES = Object.freeze({
    0:  116,  // interior puro (cercado por buraco em todos os lados)
    1:  103, // N
    2:  105, // E
    3:  102, // N+E
    4:  104, // S
    5:  115, // N+S
    6:  109, // E+S
    7:  112, // N+E+S
    8:  106, // W
    9:  101, // N+W
    10: 114, // E+W
    11: 110, // N+E+W
    12: 107, // S+W
    13: 113, // N+S+W
    14: 111, // E+S+W
    15: 100  // N+E+S+W (buraco isolado de 1 tile)
});

/**
 * Resolve o índice visual de um tile de buraco em (col,row) olhando os quatro
 * vizinhos ortogonais na grade `floor`. Um lado ganha borda quando o vizinho
 * daquele lado NÃO é buraco (é piso, parede ou fica fora da grade).
 *
 * @param {number[][]} floor grade de índices (HOLE_TILE = -1 marca buraco)
 * @param {number} col
 * @param {number} row
 * @returns {number} índice de tile de borda do buraco
 */
export function holeTileFor(floor, col, row) {
    const isHole = (c, r) => {
        const line = floor[r];
        return !!line && line[c] === HOLE_TILE;
    };
    let mask = 0;
    if (!isHole(col, row - 1)) mask |= 1; // N
    if (!isHole(col + 1, row)) mask |= 2; // E
    if (!isHole(col, row + 1)) mask |= 4; // S
    if (!isHole(col - 1, row)) mask |= 8; // W
    return HOLE_TILES[mask];
}

export const PROP_SCATTER = {
    // Tiles de piso "liso" onde um prop pode ser espalhado (centro da sala).
    floorTiles: [16],
    // Props disponíveis para o sorteio (índices do tileset).
    tiles: [59, 77, 68, 64],
    // Densidade padrão (fração dos tiles de piso livre que recebem prop).
    defaultDensity: 0.08,
    minDensity: 0.0,
    maxDensity: 0.4
};

/**
 * Espalha props pelos tiles de piso livre de uma sala, de forma determinística.
 * Evita paredes, buracos (-1), vãos/entradas de porta e qualquer tile já
 * ocupado (nas listas `occupied`). Retorna uma lista [{ col, row, index }].
 *
 * @param {number[][]} floor  matriz de tiles (−1 = buraco)
 * @param {object} opts
 *   density   fração 0..1 dos tiles livres que recebem prop
 *   tiles     índices de prop para sortear (default PROP_SCATTER.tiles)
 *   occupied  Set de chaves "col,row" a evitar (inimigos, traps, portas, etc.)
 *   rng       função 0..1 determinística
 */
export function scatterPropsOnFloor(floor, opts = {}) {
    const density = Math.max(0, Math.min(1, opts.density ?? PROP_SCATTER.defaultDensity));
    const propTiles = opts.tiles && opts.tiles.length ? opts.tiles : PROP_SCATTER.tiles;
    const occupied = opts.occupied || new Set();
    const rng = opts.rng || Math.random;
    const rows = floor.length;
    const cols = rows > 0 ? floor[0].length : 0;

    // Candidatos: tiles internos de piso liso, sem buraco e não ocupados.
    const candidates = [];
    for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
            const idx = floor[r][c];
            if (idx < 0) continue;                              // buraco
            if (!PROP_SCATTER.floorTiles.includes(idx)) continue; // só piso liso (evita beiras/portas)
            if (occupied.has(`${c},${r}`)) continue;
            candidates.push({ col: c, row: r });
        }
    }

    const target = Math.round(candidates.length * density);
    // Embaralho determinístico (Fisher-Yates com rng).
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const out = [];
    for (let i = 0; i < target && i < candidates.length; i++) {
        const { col, row } = candidates[i];
        const index = propTiles[(rng() * propTiles.length) | 0];
        out.push({ col, row, index, flip: rng() < 0.5 });
    }
    return out;
}

export const PLAYER_LIGHT_RADIUS = 260;

export const LIGHT_PIXEL_SCALE = 1.5;

export const TORCHES = {
    enabled: true,
    index: 90,          // tile da tocha da parede NORTE (topo)
    sideIndex: 91,      // tile da tocha das paredes LATERAIS (esq/dir)
    minPerWall: 2,      // mínimo de tochas por parede
    maxPerWall: 4,      // máximo de tochas por parede
    marginTiles: 2,     // afasta das quinas (não cola nos cantos)
    minGap: 2,          // distância mínima (em tiles) entre duas tochas
    onlyCombatRooms: true, // só em salas de combate (não em corredores)
    
    sides: {
        enabled: true,
        left: true,     // gerar tochas na parede esquerda
        right: true     // gerar tochas na parede direita
    },

    // ---- Luz emitida por cada tocha ----
    // A luz da tocha agora é DIRECIONAL: um FEIXE (cone) projetado da parede
    // para DENTRO da sala — muito mais imersivo que um disco de luz circular,
    // que achatava a sensação de profundidade. Mantemos ainda um pequeno HALO
    // na própria chama (a fonte brilha no seu entorno imediato), pois uma luz
    // real ilumina o ponto de origem e projeta o facho adiante.
    light: {
        pixelScale: 1.2,        // blocos pixelados da luz da tocha
        // Deslocamento (px de MUNDO) do ponto de luz em relação ao centro do
        // tile da tocha. Para tochas do NORTE, offsetY empurra a luz para baixo
        // (para dentro da sala). Para LATERAIS, offsetX empurra a luz para o
        // lado de dentro (sinal ajustado conforme esquerda/direita).
        offsetY: 26,
        offsetX: 22,
        color: "255, 190, 110", // âmbar um pouco mais quente/alaranjado que o jogador

        // Flicker próprio das tochas (mais sutil e lento que fogo agitado).
        flickerSpeed: 0.1,
        flickerBase: 0.94,
        flickerSine: 0.045,
        flickerNoise: 0.03,

        // ---- WASH de parede (preenchimento ambiente a partir das bordas) ----
        // Uma faixa de luz contínua ancorada em cada parede que PREENCHE o
        // ambiente e esvaece para o interior. Somando as quatro paredes, a sala
        // fica banhada (forte nas bordas, suave no miolo) — sem vãos escuros
        // entre as tochas. É o "preenchimento"; as áreas/halos abaixo dão o
        // destaque pontual de cada chama por cima deste banho.
        wash: {
            enabled: false,     // DESLIGADO: o banho de borda apagava o gradiente
                                // escuro dos vãos de porta e clareava a parede
                                // frontal inferior. Sem ele, as entradas voltam
                                // a ficar escuras (gradiente de corredor).
            depth: 300,         // quão fundo o banho entra na sala (px de MUNDO)
            falloff: [
                { offset: 0.0, alpha: 0.42 },  // forte junto à parede
                { offset: 0.35, alpha: 0.2 },
                { offset: 0.7, alpha: 0.06 },
                { offset: 1.0, alpha: 0.0 }    // dissolve no interior
            ]
        },

        // ---- ÁREA da tocha (mancha de luz CIRCULAR, difusa) ----
        // A tocha ilumina uma ÁREA circular à frente. O centro é empurrado para
        // DENTRO da sala (pushIn), então a luz fica concentrada no interior. O
        // raio é generoso e o falloff bem gradual, então as bordas se dissolvem
        // sem anel marcado — mancha orgânica, não um poste de luz.
        area: {
            radius: 240,        // raio da mancha circular (px de MUNDO) — maior
            flatten: 1,         // 1 = círculo perfeito (sem achatar)
            pushIn: 70,         // desloca o centro para dentro da sala (px MUNDO)
            // Perfil radial MUITO suave: muitos stops de alpha baixo espalham a
            // transição por todo o raio, dissolvendo a borda por completo.
            falloff: [
                { offset: 0.0, alpha: 0.9 },
                { offset: 0.2, alpha: 0.62 },
                { offset: 0.4, alpha: 0.38 },
                { offset: 0.6, alpha: 0.2 },
                { offset: 0.78, alpha: 0.09 },
                { offset: 0.9, alpha: 0.03 },
                { offset: 1.0, alpha: 0.0 }
            ]
        },

        // ---- HALO na fonte (a chama ilumina seu entorno imediato) ----
        glow: {
            radius: 60,         // raio pequeno (px de MUNDO) ao redor da chama
            flatten: 0.95,      // quase circular
            falloff: [
                { offset: 0.0, alpha: 0.85 },
                { offset: 0.45, alpha: 0.4 },
                { offset: 0.75, alpha: 0.14 },
                { offset: 1.0, alpha: 0.0 }
            ]
        }
    }
};

/**
 * DOOR_LIGHT — luz direcional registrada em cada vão de porta quando a sala
 * está ABERTA (destravada). Serve de indicador visual: "esta porta está aberta,
 * dá para passar". Enquanto a sala estiver TRANCADA (combate), as portas não
 * emitem luz. A luz é alongada no eixo da passagem (N/S = horizontal larga,
 * E/W = vertical larga) para "apontar" o caminho, e empurrada para DENTRO da
 * sala pelo offset, de forma que o brilho nasça no vão.
 */
export const DOOR_LIGHT = {
    enabled: true,
    // ---- Formato: SPOT/CONE saindo da porta para dentro da sala ----
    length: 180,            // alcance do feixe DENTRO da sala (px de MUNDO) no auge do flash
    spread: 0.5,            // meia-abertura do cone (radianos). Maior = cone mais aberto.
                            // O recuo do apex atrás da porta é DERIVADO desta abertura
                            // + a largura do vão, p/ a boca do cone cobrir a porta inteira.
    startFade: 0.22,        // fração do feixe (a partir da porta) em que o brilho SOBE
                            // de 0 ao pico, suavizando o corte na soleira (luz "vindo do
                            // outro lado"). 0 = corte seco; maior = entrada mais gradual.
    pixelScale: 1.3,        // blocos pixelados da luz da porta
    color: "255, 225, 90",  // AMARELO = porta aberta.

    // ---- Flash temporário (NÃO é constante) ----
    // Quando a porta abre, o efeito dispara uma vez: pulsa suavemente por um
    // instante e depois enfraquece até sumir. Controlado por um timer no Game.
    flashDuration: 1.6,     // duração total do efeito (segundos) até sumir
    pulseSpeed: 10,         // velocidade do pulso suave (rad/s)
    pulseDepth: 0.18,       // profundidade do pulso (0..1): quanto o brilho sobe/desce
    fadeExponent: 1.6       // curva do enfraquecimento (>1 = segura o brilho e cai no fim)
};

/**
 * WIND — poeira/vento ambiente que atravessa a cena, dando um aspecto vivo de
 * ventania. Partículas finas (script) que cruzam a viewport na direção do
 * vento, com rajadas que variam a intensidade e a direção devagar.
 *
 * Por padrão as partículas são desenhadas no MUNDO, ANTES da iluminação, então
 * a luz das tochas/jogadores "revela" a poeira (mais atmosférico). Para vê-las
 * na tela toda (inclusive no escuro), use layer: "screen".
 */
export const WIND = {
    enabled: true,
    count: 60,              // nº de partículas no pool (discreto)
    layer: "world",         // "world" (revelada pela luz) ou "screen" (tela toda)

    // Direção e força do vento (vetor base, px/frame no MUNDO).
    speed: 2.6,             // velocidade base ao longo do vento
    angle: 0.15,            // direção em radianos (0 = p/ direita; ~0.15 = leve diagonal)
    angleDrift: 0.0025,     // o quanto o ângulo oscila devagar (0 = direção fixa)
    angleDriftRange: 0.5,   // amplitude máx. do desvio de direção (radianos)

    // Rajadas: a intensidade do vento oscila entre calmo e forte.
    gustSpeed: 0.012,       // velocidade da oscilação de rajada
    gustMin: 0.45,          // multiplicador de velocidade no vento calmo
    gustMax: 1.35,          // multiplicador no auge da rajada

    // Movimento individual das partículas.
    sway: 0.6,              // deriva perpendicular (balanço) — evita linhas retas
    swaySpeed: 0.05,        // frequência do balanço
    speedVariation: 0.5,    // variação de velocidade entre partículas (0..1)

    // Aparência (pixel art discreta).
    color: "200, 195, 180", // poeira clara dessaturada (RGB)
    alphaMin: 0.06,         // opacidade mínima (bem sutil)
    alphaMax: 0.22,         // opacidade máxima
    sizeMin: 2,             // tamanho em "pixels de arte" (menor)
    sizeMax: 4,             // tamanho máximo
    streak: 2.2,            // comprimento do rastro (múltiplo do tamanho; 1 = sem rastro)

    // Área de emissão: margem (em px de MUNDO) além da sala, para as partículas
    // entrarem/saírem fora de vista em vez de "nascer" na tela.
    margin: 120
};

/**
 * POST_PROCESSING — todos os parâmetros de ajuste fino do PostProcessor.
 * Centralizado aqui para calibrar o visual sem abrir o código do sistema.
 */
export const POST_PROCESSING = {
    enabled: true,

    // ---- Vinheta (escurecimento radial das bordas) ----
    vignette: {
        enabled: true,
        innerRadius: 0.55,   // 0 = escurece do centro; 1 = só nos cantos
        strength: 0.7,       // opacidade máxima nas bordas
        color: "8, 5, 12",   // RGB do escurecimento (tom de masmorra)
        midStop: 0.7,        // posição do stop intermediário do gradiente
        midAlphaFactor: 0.45 // alpha no stop intermediário = strength * isto
    },

    // ---- Iluminação dinâmica (ambiente escuro + halos de luz) ----
    lighting: {
        enabled: true,
        ambient: "41, 35, 53",       // cor do ambiente escuro (menor = + sombrio) — +20% sobre 34,29,44
        lightColor: "255, 220, 150", // cor da luz (âmbar quente de tocha)
        flatten: 1,               // achatamento vertical da elipse (1 = círculo)

        // Flicker (tremulação da chama)
        flickerSpeed: 0.005,          // avanço da fase por frame
        flickerBase: 0.5,           // multiplicador base do raio/intensidade
        flickerSine: 0.05,           // amplitude da oscilação senoidal
        flickerNoise: 0.03,          // amplitude do ruído aleatório

        // Perfil radial da luz (color stops do gradiente antes do pixelado).
        // offset 0..1 = distância do centro; alpha 0..1 = intensidade.
        // Decaimento LONGO e gradual: a luz começa a diminuir já perto do
        // centro e se dissolve suavemente até o zero, sem um "anel" marcado na
        // borda. Mais stops de alpha baixo espalham a transição por todo o raio.
        falloff: [
            { offset: 0.0, alpha: 1.0 },
            { offset: 0.25, alpha: 0.6 },
            { offset: 0.45, alpha: 0.35 },
            { offset: 0.65, alpha: 0.17 },
            { offset: 0.82, alpha: 0.07 },
            { offset: 1.0, alpha: 0.0 }
        ]
    }
};

/**
 * HAZARDS — perigos de corredor (spikes, atirador de flechas) e botões de
 * pressão co-op. Tudo em px de MUNDO. As flechas, o indicador e o botão por
 * enquanto são FORMAS GEOMÉTRICAS (sprites virão depois).
 */
export const HAZARDS = {
    // ---- Spikes (espinhos no chão) ----
    // Sprite animado em assets/peaks/peaks_0..3.png (16x16 cada):
    //   frame 0 = recolhido (seguro) ... frame 3 = totalmente estendido (letal).
    spike: {
        size: TILE,            // ocupa 1 tile
        damageRadius: 26,      // raio de dano quando estendido (px de mundo)
        // Ciclo (em frames a 60fps): escondido -> subindo -> exposto -> descendo
        hiddenFrames: 70,      // tempo recolhido (seguro)
        warnFrames: 22,        // telegrafo (começa a subir; já machuca no fim)
        exposedFrames: 46,     // totalmente para fora (letal)
        retractFrames: 16,     // recolhendo
        // Fração do ciclo em que o espinho realmente fere (do fim do warn até
        // o fim do exposed). Calculado no entity a partir dos frames acima.
        drawSize: TILE * 0.9   // tamanho de desenho do sprite
    },

    // ---- Atirador de flechas (armadilha de parede) ----
    arrowTrap: {
        intervalFrames: 90,    // intervalo entre disparos (1,5 s a 60 FPS)
        warnFrames: 34,        // telegrafo do indicador antes de atirar
        indicatorSize: 20,     // tamanho da forma do indicador na parede
        indicatorColor: "#ffd166",
        indicatorWarnColor: "#ff5470"
    },
    arrow: {
        speed: 4.5,            // px/frame
        length: 26,            // comprimento da flecha (forma)
        width: 5,              // espessura
        hitRadius: 10,         // raio de colisão com o player
        color: "#f4e9c1",
        headColor: "#ff5470",
        maxLifeFrames: 360     // tempo de vida máximo (fail-safe)
    },

    // ---- Botão de pressão (co-op) ----
    button: {
        radius: 26,            // raio da base do botão (fallback geométrico)
        pressRadius: 26,       // raio (dos PÉS à tampa) em que conta como "pisando"
        pressYScale: 1.5,      // peso do eixo vertical (tampa em perspectiva)
        footOffset: 15,        // pés do player = centro + 15px (igual às pegadas)
        capOffsetY: -4,        // centro da tampa relativo ao centro do tile
        frameSize: 16,         // frame do sprite (assets/buttom/buttom_16.png)
        drawSize: 64,          // 1 tile: 16px de arte x4, igual ao cenário
        // Assistência de posicionamento (puxa os pés para o centro da tampa).
        assistRadius: 46,      // alcance (px de mundo)
        assistStrength: 0.12,  // fração da distância corrigida por frame
        // Squash & stretch (mola amortecida).
        pressSquash: 0.24,     // achatamento instantâneo ao apertar
        releaseStretch: 0.14,  // esticada ao soltar
        springK: 0.28,         // rigidez da mola
        springDamp: 0.34,      // amortecimento (menor = mais overshoot)
        baseColor: "#3a2f4a",
        ringColor: "#8a7fb0",
        idleColor: "#6bb4db",  // topo solto
        pressedColor: "#54d98b", // topo pressionado (verde)
        pulseSpeed: 0.08
    },

    // ---- Porta/trava do desafio ----
    // Enquanto o puzzle não é resolvido, o corredor fica TRANCADO (como uma
    // sala de combate). Resolver = os DOIS botões pressionados ao mesmo tempo.
    challenge: {
        holdFrames: 10,        // frames que ambos precisam ficar juntos p/ abrir
        barrierColor: "#2a2330",
        barrierGlow: "#e53170"
    }
};
