/**
 * GameConfig — todas as constantes de tuning do jogo num lugar só.
 *
 * Antes essas constantes estavam espalhadas pelo main.js. Centralizá-las aqui
 * deixa o balanceamento num ponto único e os módulos passam a depender de
 * dados, não de valores mágicos duplicados.
 */

// ---- Escala do mundo (tiles chunky) ----
export const TILE = 64;        // tamanho do tile no mundo (px)
export const ROOM_COLS = 14;   // par: porta N/S de 2 tiles fica centralizada
export const ROOM_ROWS = 9;
export const GRID_COLS = 9;    // nº de células (salas) na grade do mundo
export const GRID_ROWS = 7;

// Mundo inteiro (grade * célula) — usado pelo buffer de sangue.
export const WORLD_W = GRID_COLS * ROOM_COLS * TILE;
export const WORLD_H = GRID_ROWS * ROOM_ROWS * TILE;

// ---- Dungeon ----
export const ROOM_COUNT = 8;   // quantas salas gerar por andar

// ---- Sangue / partículas ----
// Tons de vinho/bordô profundos e dessaturados. São compostos sobre o piso em
// "multiply" (ver BloodCanvas.draw), então aparecem mais escuros ainda na tela:
// a ideia é que o sangue TINJA o chão e pareça fazer parte do cenário, em vez
// do vermelho saturado que "flutuava" por cima.
export const BLOOD_COLORS = ["#4a0612", "#5c0a18", "#6e0f1c", "#480810", "#3a0510"];
// 1 pixel de sangue = 1 pixel de tile (TILE / tamanho do tile fonte 16px).
export const BLOOD_PIXEL = TILE / 16;
export const BLOOD_STAIN_CONFIG = {
    gib: { count: 3, life: Infinity, sizeMin: 2, sizeMax: 4, alpha: 0.9 }
};
export const BLOOD_STEPS = 6;  // passos ensanguentados após pisar em sangue

// ---- Limites de pool de efeitos ----
export const MAX_ACTIVE_GIBS = 90;
export const MAX_FOOTPRINTS = 60;

// ---- Corrente / separação dos jogadores ----
// A corrente é elástica, mas há um teto rígido para não separarem além do que
// a câmera comporta.
export const MAX_PLAYER_SEPARATION = 620;

// ---- Câmera ----
export const CAM_MARGIN = 90;  // folga nas bordas (afasta a câmera do cenário)

// ---- Transição entre salas (fade) ----
export const TRANSITION_SPEED = 0.05; // ~10 frames por fase

// ---- Portas / corredores ----
// Quantos tiles de piso projetar para fora de cada porta (corredor de entrada).
export const DOOR_STUB_TILES = 2;
// Profundidade (px) que o jogador pode adentrar o vão antes de transicionar.
export const DOOR_ENTER_DEPTH = 70;

// ---- Regra de Spawn dos Jogadores ----
// Cada jogador nasce exatamente em um tile individual logo à frente do vão da porta (span de 2 tiles).
// P1 (Amarelo) e P2 (Azul) ocupam os dois tiles adjacentes à porta correspondente.
export const PLAYER_DOOR_SPAWN_TILES = {
    // Ao entrar pela porta Norte (descendo para a sala):
    N: {
        p1: { col: 6, row: 1 },
        p2: { col: 7, row: 1 }
    },
    // Ao entrar pela porta Sul (subindo para a sala):
    S: {
        p1: { col: 6, row: ROOM_ROWS - 2 }, // row 7
        p2: { col: 7, row: ROOM_ROWS - 2 }  // row 7
    },
    // Ao entrar pela porta Oeste (entrando pela esquerda):
    W: {
        p1: { col: 1, row: 3 },
        p2: { col: 1, row: 4 }
    },
    // Ao entrar pela porta Leste (entrando pela direita):
    E: {
        p1: { col: ROOM_COLS - 2, row: 3 }, // col 12
        p2: { col: ROOM_COLS - 2, row: 4 }  // col 12
    },
    // Spawn inicial da dungeon (centro da sala):
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

// ---- Combate ----
// Zona morta perto dos players onde a arma não fere inimigos.
export const PLAYER_SAFE_ZONE = 46;

// ---- Fundo ----
export const BACKGROUND_TILE = 78; // tile que preenche o vazio fora da sala

// ---- Iluminação / Pós-processamento ----
// Raio (em px de MUNDO) do halo de luz que cada jogador carrega. É convertido
// para px de tela pelo zoom na hora de desenhar (ver Game._render).
export const PLAYER_LIGHT_RADIUS = 260;

// Fator que define o tamanho do "pixel" chunky da elipse de luz. O pixel de
// arte na tela é (TILE/16) * zoom; multiplicamos por este fator para blocos
// mais grossos/visíveis. Maior = elipse mais "pixelona".
export const LIGHT_PIXEL_SCALE = 1.5;

/**
 * TORCHES — tochas de parede (pontos de luz naturais do cenário).
 * O tile `index` é desenhado na parede NORTE das salas e emite uma luz suave.
 * Totalmente configurável aqui.
 */
export const TORCHES = {
    enabled: true,
    index: 90,          // tile da tocha da parede NORTE (topo)
    sideIndex: 91,      // tile da tocha das paredes LATERAIS (esq/dir)
    minPerWall: 2,      // mínimo de tochas por parede
    maxPerWall: 4,      // máximo de tochas por parede
    marginTiles: 2,     // afasta das quinas (não cola nos cantos)
    minGap: 2,          // distância mínima (em tiles) entre duas tochas
    onlyCombatRooms: true, // só em salas de combate (não em corredores)

    // Tochas laterais: ficam no PISO à frente da parede lateral (coluna interna
    // adjacente). O tile 91 é desenhado encaixado na parede ESQUERDA por padrão;
    // na parede DIREITA ele é espelhado horizontalmente (flip).
    sides: {
        enabled: true,
        left: true,     // gerar tochas na parede esquerda
        right: true     // gerar tochas na parede direita
    },

    // ---- Luz emitida por cada tocha ----
    light: {
        radius: 150,            // raio da luz (px de MUNDO) — menor que a do jogador
        flatten: 0.95,          // quase circular (a tocha ilumina ao redor)
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

        // Perfil radial suave (bordas difusas, como a luz do jogador).
        falloff: [
            { offset: 0.0, alpha: 0.85 },
            { offset: 0.3, alpha: 0.5 },
            { offset: 0.55, alpha: 0.28 },
            { offset: 0.78, alpha: 0.1 },
            { offset: 1.0, alpha: 0.0 }
        ]
    }
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
        ambient: "26, 22, 34",       // cor do ambiente escuro (menor = + sombrio)
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
        intervalFrames: 95,    // intervalo entre disparos
        warnFrames: 34,        // telegrafo do indicador antes de atirar
        indicatorSize: 20,     // tamanho da forma do indicador na parede
        indicatorColor: "#ffd166",
        indicatorWarnColor: "#ff5470"
    },
    arrow: {
        speed: 7.5,            // px/frame
        length: 26,            // comprimento da flecha (forma)
        width: 5,              // espessura
        hitRadius: 10,         // raio de colisão com o player
        color: "#f4e9c1",
        headColor: "#ff5470",
        maxLifeFrames: 240     // tempo de vida máximo (fail-safe)
    },

    // ---- Botão de pressão (co-op) ----
    button: {
        radius: 26,            // raio da base do botão
        pressRadius: 30,       // raio em que um player conta como "pisando"
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
