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
export const BLOOD_COLORS = ["#5c0210", "#7a0404", "#960e11", "#a30808", "#c60f0e"];
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

// ---- Combate ----
// Zona morta perto dos players onde a arma não fere inimigos.
export const PLAYER_SAFE_ZONE = 46;

// ---- Fundo ----
export const BACKGROUND_TILE = 78; // tile que preenche o vazio fora da sala
